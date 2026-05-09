package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boa-club/api/internal/auth"
	"github.com/boa-club/api/internal/models"
)

// Erreurs métier UserService.
var (
	ErrUserNotFound    = errors.New("utilisateur introuvable")
	ErrInvalidBelt     = errors.New("ceinture invalide")
	ErrInvalidPassword = errors.New("mot de passe incorrect")
)

// UpdateProfileParams : tous les champs sont optionnels (pointeurs).
// Si le pointeur est nil, le champ n'est pas touché en BDD.
type UpdateProfileParams struct {
	FirstName        *string
	LastNameInitial  *string
	Bio              *string
	Belt             *models.Belt
	Stripes          *int
	WeightKg         *float64
	WeightVisibility *models.WeightVisibility
	Disciplines      *[]string
	AvatarURL        *string
}

// UserService : opérations sur les comptes utilisateurs (hors auth).
type UserService struct {
	db *pgxpool.Pool
}

func NewUserService(db *pgxpool.Pool) *UserService {
	return &UserService{db: db}
}

// GetByID renvoie le user actif (pas soft-deleted) correspondant à id.
func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var (
		u      models.User
		weight pgtype.Numeric
	)
	err := s.db.QueryRow(ctx, `
		SELECT id, email, first_name, last_name_initial, avatar_url, bio,
		       belt, stripes, weight_kg, weight_visibility, disciplines,
		       role, status, created_at, updated_at, last_login_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, id).Scan(
		&u.ID, &u.Email, &u.FirstName, &u.LastNameInitial,
		&u.AvatarURL, &u.Bio, &u.Belt, &u.Stripes, &weight,
		&u.WeightVisibility, &u.Disciplines, &u.Role, &u.Status,
		&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("select user : %w", err)
	}
	if weight.Valid {
		if f, err := weight.Float64Value(); err == nil && f.Valid {
			v := f.Float64
			u.WeightKg = &v
		}
	}
	return &u, nil
}

// VerifyPassword renvoie nil si le password fourni correspond, ErrInvalidPassword sinon.
// Utile pour confirmer une action sensible (suppression de compte).
func (s *UserService) VerifyPassword(ctx context.Context, userID uuid.UUID, password string) error {
	var hash string
	err := s.db.QueryRow(ctx, `
		SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFound
		}
		return fmt.Errorf("lookup hash : %w", err)
	}
	if err := auth.ComparePassword(hash, password); err != nil {
		return ErrInvalidPassword
	}
	return nil
}

// DeleteAccount applique un soft-delete RGPD sur le compte de l'utilisateur :
//   - email anonymisé (libère l'adresse pour une réinscription future),
//   - password_hash effacé,
//   - status='deleted' + deleted_at=NOW(),
//   - tous les refresh tokens révoqués → toutes les sessions invalidées,
//   - bio, fcm_token, avatar_url effacés.
//
// Les données associées (messages envoyés, créneaux créés) restent en BDD
// avec creator_id intact, mais l'utilisateur n'est plus identifiable
// publiquement (le frontend lit only first_name + last_name_initial qui
// peuvent rester ou être masqués selon le besoin).
//
// Non réversible. À ne jamais déclencher sans confirmation explicite.
func (s *UserService) DeleteAccount(ctx context.Context, userID uuid.UUID) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx : %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Anonymise les données personnelles. On garde first_name/last_name_initial
	// pour que les conversations passées restent lisibles (sinon l'historique
	// d'autres users devient cryptique), mais on pourrait les remplacer aussi.
	if _, err := tx.Exec(ctx, `
		UPDATE users SET
			email = 'deleted_' || id::text || '@deleted.local',
			password_hash = '',
			bio = NULL,
			avatar_url = NULL,
			fcm_token = NULL,
			weight_kg = NULL,
			status = 'deleted',
			deleted_at = NOW(),
			updated_at = NOW(),
			password_reset_token = NULL,
			password_reset_expires_at = NULL
		WHERE id = $1 AND deleted_at IS NULL
	`, userID); err != nil {
		return fmt.Errorf("delete user : %w", err)
	}

	// Révoque toutes les sessions actives.
	if _, err := tx.Exec(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = NOW(), revoked_reason = 'account_deleted'
		WHERE user_id = $1 AND revoked_at IS NULL
	`, userID); err != nil {
		return fmt.Errorf("revoke sessions : %w", err)
	}

	// Retire des followings notifs (plus besoin).
	if _, err := tx.Exec(ctx, `DELETE FROM user_course_followings WHERE user_id = $1`, userID); err != nil {
		return fmt.Errorf("clear followings : %w", err)
	}

	return tx.Commit(ctx)
}

// SetFCMToken enregistre le token FCM/Expo Push d'un device pour ce user.
// Pas d'historique : un user = un device pour V1 (multi-devices en V1.1).
func (s *UserService) SetFCMToken(ctx context.Context, userID uuid.UUID, token string) error {
	_, err := s.db.Exec(ctx, `
		UPDATE users SET fcm_token = $1, updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
	`, token, userID)
	if err != nil {
		return fmt.Errorf("set fcm token : %w", err)
	}
	return nil
}

// ClearFCMToken : appelé au logout.
func (s *UserService) ClearFCMToken(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Exec(ctx, `UPDATE users SET fcm_token = NULL WHERE id = $1`, userID)
	return err
}

// GetFCMToken renvoie le token enregistré pour l'envoi de push.
func (s *UserService) GetFCMToken(ctx context.Context, userID uuid.UUID) (string, error) {
	var token *string
	err := s.db.QueryRow(ctx, `SELECT fcm_token FROM users WHERE id = $1`, userID).Scan(&token)
	if err != nil {
		return "", err
	}
	if token == nil {
		return "", nil
	}
	return *token, nil
}

// GetFollowedCourseKeys renvoie la liste des `course_key` distincts auxquels
// l'utilisateur est abonné via user_course_followings.
func (s *UserService) GetFollowedCourseKeys(ctx context.Context, userID uuid.UUID) ([]string, error) {
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT rc.course_key
		FROM user_course_followings ucf
		JOIN recurring_courses rc ON rc.id = ucf.recurring_course_id
		WHERE ucf.user_id = $1
		ORDER BY rc.course_key
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query followings : %w", err)
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		out = append(out, key)
	}
	return out, rows.Err()
}

// SetFollowedCourseKeys remplace toute la liste des cours suivis par `keys`.
// Insère une row par recurring_course actif qui matche un des keys donnés.
func (s *UserService) SetFollowedCourseKeys(ctx context.Context, userID uuid.UUID, keys []string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx : %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM user_course_followings WHERE user_id = $1`, userID); err != nil {
		return fmt.Errorf("clear : %w", err)
	}

	if len(keys) > 0 {
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_course_followings (user_id, recurring_course_id)
			SELECT $1, id FROM recurring_courses
			WHERE is_active = TRUE AND course_key = ANY($2::text[])
			ON CONFLICT DO NOTHING
		`, userID, keys); err != nil {
			return fmt.Errorf("insert followings : %w", err)
		}
	}

	return tx.Commit(ctx)
}

// UpdateProfile met à jour les champs de profil non-nil dans `p`.
//
// Convention : si un pointeur est `nil`, le champ n'est pas touché.
// Pour clear bio/weight_kg → on enverra un endpoint dédié plus tard.
func (s *UserService) UpdateProfile(ctx context.Context, id uuid.UUID, p UpdateProfileParams) (*models.User, error) {
	// COALESCE($val, existing_col) : si $val est NULL, on garde la colonne actuelle.
	var (
		firstName       any
		lastInitial     any
		bio             any
		belt            any
		stripes         any
		weightKg        any
		weightVis       any
		disciplines     any
		avatarURL       any
	)
	if p.FirstName != nil {
		firstName = *p.FirstName
	}
	if p.LastNameInitial != nil {
		lastInitial = *p.LastNameInitial
	}
	if p.Bio != nil {
		bio = *p.Bio
	}
	if p.Belt != nil {
		belt = string(*p.Belt)
	}
	if p.Stripes != nil {
		stripes = *p.Stripes
	}
	if p.WeightKg != nil {
		weightKg = *p.WeightKg
	}
	if p.WeightVisibility != nil {
		weightVis = string(*p.WeightVisibility)
	}
	if p.Disciplines != nil {
		disciplines = *p.Disciplines
	}
	if p.AvatarURL != nil {
		avatarURL = *p.AvatarURL
	}

	var (
		u      models.User
		weight pgtype.Numeric
	)
	err := s.db.QueryRow(ctx, `
		UPDATE users SET
			first_name        = COALESCE($1::varchar, first_name),
			last_name_initial = COALESCE($2::varchar, last_name_initial),
			bio               = COALESCE($3::text, bio),
			belt              = COALESCE($4::belt_color, belt),
			stripes           = COALESCE($5::smallint, stripes),
			weight_kg         = COALESCE($6::numeric, weight_kg),
			weight_visibility = COALESCE($7::weight_visibility, weight_visibility),
			disciplines       = COALESCE($8::text[], disciplines),
			avatar_url        = COALESCE($9::text, avatar_url),
			updated_at        = NOW()
		WHERE id = $10 AND deleted_at IS NULL
		RETURNING id, email, first_name, last_name_initial, avatar_url, bio,
		          belt, stripes, weight_kg, weight_visibility, disciplines,
		          role, status, created_at, updated_at, last_login_at
	`,
		firstName, lastInitial, bio, belt, stripes,
		weightKg, weightVis, disciplines, avatarURL, id,
	).Scan(
		&u.ID, &u.Email, &u.FirstName, &u.LastNameInitial,
		&u.AvatarURL, &u.Bio, &u.Belt, &u.Stripes, &weight,
		&u.WeightVisibility, &u.Disciplines, &u.Role, &u.Status,
		&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("update user : %w", err)
	}
	if weight.Valid {
		if f, err := weight.Float64Value(); err == nil && f.Valid {
			v := f.Float64
			u.WeightKg = &v
		}
	}
	return &u, nil
}
