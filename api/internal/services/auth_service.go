// Package services contient la logique métier de l'API (auth, courses, slots…).
//
// Convention : aucun handler ne fait de SQL directement, tout passe par un
// service du type *Service. Les services renvoient des erreurs métier
// (ErrXxx) que les handlers traduisent en codes HTTP.
package services

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boa-club/api/internal/auth"
	"github.com/boa-club/api/internal/email"
	"github.com/boa-club/api/internal/models"
)

// Erreurs métier exposées par le service.
var (
	ErrEmailAlreadyTaken     = errors.New("email déjà utilisé")
	ErrInvalidCredentials    = errors.New("email ou mot de passe incorrect")
	ErrUserNotActive         = errors.New("compte inactif (suspendu ou supprimé)")
	ErrInvalidRefreshToken   = errors.New("refresh token invalide ou expiré")
	ErrInvalidResetToken     = errors.New("code de réinitialisation invalide ou expiré")
)

// RegisterParams : données minimales à l'inscription.
type RegisterParams struct {
	Email           string
	Password        string
	FirstName       string
	LastNameInitial string
	IP              string
	UserAgent       string
}

// LoginParams : données fournies au login.
type LoginParams struct {
	Email     string
	Password  string
	IP        string
	UserAgent string
}

// RefreshParams : données fournies au refresh.
type RefreshParams struct {
	RefreshToken string
	IP           string
	UserAgent    string
}

// AuthTokens regroupe access + refresh + leurs expirations.
type AuthTokens struct {
	AccessToken      string    `json:"access_token"`
	RefreshToken     string    `json:"refresh_token"`
	AccessExpiresAt  time.Time `json:"access_expires_at"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
}

// AuthService gère l'inscription, le login, la rotation et la révocation des tokens.
type AuthService struct {
	db         *pgxpool.Pool
	jwt        *auth.Manager
	bcryptCost int
	mailer     email.Sender
	logger     *slog.Logger
}

func NewAuthService(db *pgxpool.Pool, jwtMgr *auth.Manager, bcryptCost int, mailer email.Sender, logger *slog.Logger) *AuthService {
	return &AuthService{
		db:         db,
		jwt:        jwtMgr,
		bcryptCost: bcryptCost,
		mailer:     mailer,
		logger:     logger,
	}
}

// userColumns liste les colonnes lues pour reconstruire un *models.User.
// La pondération weight_kg étant en NUMERIC, on la lit dans une variable
// pgtype.Numeric à part puis on la convertit en *float64.
const userColumns = `
	id, email, first_name, last_name_initial, avatar_url, bio,
	belt, stripes, weight_kg, weight_visibility, disciplines,
	role, status, created_at, updated_at, last_login_at
`

// scanUser remplit un *models.User à partir d'un scanner (Row ou Rows).
// On gère le NUMERIC weight_kg via pgtype.Numeric.
func scanUser(s pgx.Row, u *models.User) error {
	var weight pgtype.Numeric
	if err := s.Scan(
		&u.ID, &u.Email, &u.FirstName, &u.LastNameInitial,
		&u.AvatarURL, &u.Bio, &u.Belt, &u.Stripes, &weight,
		&u.WeightVisibility, &u.Disciplines, &u.Role, &u.Status,
		&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
	); err != nil {
		return err
	}
	if weight.Valid {
		f, err := weight.Float64Value()
		if err == nil && f.Valid {
			v := f.Float64
			u.WeightKg = &v
		}
	}
	return nil
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// Register crée un nouveau user actif et émet un couple de tokens.
//
// Décision (cf. CLAUDE.md) : inscription libre, status='active' direct.
// Le mécanisme pending/active reste en BDD pour permettre une modération admin
// future sans changer le schéma.
func (s *AuthService) Register(ctx context.Context, p RegisterParams) (*models.User, *AuthTokens, error) {
	email := normalizeEmail(p.Email)

	hash, err := auth.HashPassword(p.Password, s.bcryptCost)
	if err != nil {
		return nil, nil, fmt.Errorf("hash password : %w", err)
	}

	row := s.db.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, first_name, last_name_initial, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING `+userColumns,
		email, hash, p.FirstName, p.LastNameInitial,
	)

	u := &models.User{}
	if err := scanUser(row, u); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
			return nil, nil, ErrEmailAlreadyTaken
		}
		return nil, nil, fmt.Errorf("insert user : %w", err)
	}

	tokens, err := s.issueTokens(ctx, u.ID, string(u.Role), p.IP, p.UserAgent)
	if err != nil {
		return nil, nil, err
	}
	return u, tokens, nil
}

// Login valide l'email/password, log la tentative et émet un couple de tokens.
func (s *AuthService) Login(ctx context.Context, p LoginParams) (*models.User, *AuthTokens, error) {
	email := normalizeEmail(p.Email)

	var (
		u            models.User
		passwordHash string
		weight       pgtype.Numeric
	)
	err := s.db.QueryRow(ctx, `
		SELECT id, email, password_hash, first_name, last_name_initial,
		       avatar_url, bio, belt, stripes, weight_kg, weight_visibility,
		       disciplines, role, status, created_at, updated_at, last_login_at
		FROM users
		WHERE email = $1 AND deleted_at IS NULL
	`, email).Scan(
		&u.ID, &u.Email, &passwordHash, &u.FirstName, &u.LastNameInitial,
		&u.AvatarURL, &u.Bio, &u.Belt, &u.Stripes, &weight,
		&u.WeightVisibility, &u.Disciplines, &u.Role, &u.Status,
		&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			s.logAttempt(ctx, email, p.IP, p.UserAgent, false)
			return nil, nil, ErrInvalidCredentials
		}
		return nil, nil, fmt.Errorf("select user : %w", err)
	}

	if err := auth.ComparePassword(passwordHash, p.Password); err != nil {
		s.logAttempt(ctx, email, p.IP, p.UserAgent, false)
		return nil, nil, ErrInvalidCredentials
	}

	if u.Status != models.StatusActive {
		s.logAttempt(ctx, email, p.IP, p.UserAgent, false)
		return nil, nil, ErrUserNotActive
	}

	if weight.Valid {
		if f, err := weight.Float64Value(); err == nil && f.Valid {
			v := f.Float64
			u.WeightKg = &v
		}
	}

	s.logAttempt(ctx, email, p.IP, p.UserAgent, true)

	// Best-effort : la mise à jour de last_login_at ne doit pas faire planter le login.
	if _, err := s.db.Exec(ctx, `UPDATE users SET last_login_at = NOW() WHERE id = $1`, u.ID); err != nil {
		s.logger.WarnContext(ctx, "update last_login_at KO", slog.Any("error", err))
	}

	tokens, err := s.issueTokens(ctx, u.ID, string(u.Role), p.IP, p.UserAgent)
	if err != nil {
		return nil, nil, err
	}
	return &u, tokens, nil
}

// Refresh effectue la rotation : valide l'ancien token, le révoque, en émet un nouveau.
//
// Le tout dans une transaction pour éviter qu'un attaquant et l'utilisateur
// légitime obtiennent deux refresh tokens valides en parallèle.
func (s *AuthService) Refresh(ctx context.Context, p RefreshParams) (*AuthTokens, error) {
	hash := auth.HashRefresh(p.RefreshToken)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx : %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		userID    uuid.UUID
		expiresAt time.Time
		revokedAt *time.Time
	)
	err = tx.QueryRow(ctx, `
		SELECT user_id, expires_at, revoked_at
		FROM refresh_tokens
		WHERE token_hash = $1
		FOR UPDATE
	`, hash).Scan(&userID, &expiresAt, &revokedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidRefreshToken
		}
		return nil, fmt.Errorf("select refresh_token : %w", err)
	}

	if revokedAt != nil || time.Now().After(expiresAt) {
		return nil, ErrInvalidRefreshToken
	}

	// Charge le user pour vérifier qu'il est toujours actif et avoir son rôle.
	var (
		role   string
		status models.Status
	)
	err = tx.QueryRow(ctx, `
		SELECT role, status FROM users WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&role, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidRefreshToken
		}
		return nil, fmt.Errorf("select user : %w", err)
	}
	if status != models.StatusActive {
		return nil, ErrUserNotActive
	}

	// Révoque l'ancien refresh.
	if _, err := tx.Exec(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = NOW(), revoked_reason = 'rotated'
		WHERE token_hash = $1
	`, hash); err != nil {
		return nil, fmt.Errorf("revoke old refresh : %w", err)
	}

	// Émet un nouveau couple.
	accessToken, accessExp, err := s.jwt.GenerateAccess(userID, role)
	if err != nil {
		return nil, fmt.Errorf("generate access : %w", err)
	}
	refreshToken, refreshHash, refreshExp, err := s.jwt.GenerateRefresh()
	if err != nil {
		return nil, fmt.Errorf("generate refresh : %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, ip_address, user_agent, expires_at)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, refreshHash, nullable(p.IP), nullable(p.UserAgent), refreshExp); err != nil {
		return nil, fmt.Errorf("insert refresh_token : %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx : %w", err)
	}

	return &AuthTokens{
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresAt:  accessExp,
		RefreshExpiresAt: refreshExp,
	}, nil
}

// Logout révoque un refresh token. Idempotent : pas d'erreur si déjà invalide.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	hash := auth.HashRefresh(refreshToken)
	if _, err := s.db.Exec(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = NOW(), revoked_reason = 'logout'
		WHERE token_hash = $1 AND revoked_at IS NULL
	`, hash); err != nil {
		return fmt.Errorf("revoke refresh : %w", err)
	}
	return nil
}

// issueTokens génère access + refresh et stocke le hash du refresh en BDD.
func (s *AuthService) issueTokens(ctx context.Context, userID uuid.UUID, role, ip, userAgent string) (*AuthTokens, error) {
	accessToken, accessExp, err := s.jwt.GenerateAccess(userID, role)
	if err != nil {
		return nil, fmt.Errorf("generate access : %w", err)
	}
	refreshToken, refreshHash, refreshExp, err := s.jwt.GenerateRefresh()
	if err != nil {
		return nil, fmt.Errorf("generate refresh : %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, ip_address, user_agent, expires_at)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, refreshHash, nullable(ip), nullable(userAgent), refreshExp); err != nil {
		return nil, fmt.Errorf("insert refresh_token : %w", err)
	}

	return &AuthTokens{
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresAt:  accessExp,
		RefreshExpiresAt: refreshExp,
	}, nil
}

// logAttempt insère une ligne dans login_attempts (audit anti-bruteforce).
// Best-effort : on log mais on ne fait pas planter l'auth si l'insert échoue.
func (s *AuthService) logAttempt(ctx context.Context, email, ip, userAgent string, success bool) {
	ipParam := ip
	if ipParam == "" {
		// ip_address est INET NOT NULL : fallback safe.
		ipParam = "0.0.0.0"
	}
	if _, err := s.db.Exec(ctx, `
		INSERT INTO login_attempts (email, ip_address, success, user_agent)
		VALUES ($1, $2, $3, $4)
	`, email, ipParam, success, nullable(userAgent)); err != nil {
		s.logger.WarnContext(ctx, "log login_attempt KO", slog.Any("error", err))
	}
}

// nullable convertit un string vide en `nil` interface pour que pgx envoie NULL.
func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// --- Forgot / reset password ---

const resetTokenTTL = 30 * time.Minute

// RequestPasswordReset génère un code de reset, le stocke (hashé) et envoie un
// email. Anti-énumération : la fonction ne renvoie jamais d'erreur si l'email
// est inconnu (le handler retourne toujours 204).
func (s *AuthService) RequestPasswordReset(ctx context.Context, rawEmail string) {
	emailNorm := normalizeEmail(rawEmail)

	var (
		userID    uuid.UUID
		firstName string
	)
	err := s.db.QueryRow(ctx, `
		SELECT id, first_name FROM users
		WHERE email = $1 AND deleted_at IS NULL AND status != 'deleted'
	`, emailNorm).Scan(&userID, &firstName)
	if err != nil {
		// Email inconnu : on ne fait rien (anti-énumération).
		return
	}

	// Code de reset : 12 chars base32 (lisible, copiable). On stocke son SHA-256.
	tokenBytes := make([]byte, 8) // 8 bytes → 16 chars base32
	if _, err := rand.Read(tokenBytes); err != nil {
		s.logger.ErrorContext(ctx, "rand for reset token", slog.Any("error", err))
		return
	}
	rawCode := strings.TrimRight(base32.StdEncoding.EncodeToString(tokenBytes), "=")
	tokenHash := auth.HashRefresh(rawCode) // SHA-256 hex
	expiresAt := time.Now().Add(resetTokenTTL)

	if _, err := s.db.Exec(ctx, `
		UPDATE users
		SET password_reset_token = $1, password_reset_expires_at = $2
		WHERE id = $3
	`, tokenHash, expiresAt, userID); err != nil {
		s.logger.ErrorContext(ctx, "store reset token", slog.Any("error", err))
		return
	}

	// Envoi de l'email (en mode mock, ça loggera juste le code).
	subject := "Boa Club — réinitialisation de ton mot de passe"
	text := fmt.Sprintf(
		"Salut %s,\n\nTu as demandé à réinitialiser ton mot de passe Boa Club.\n\n"+
			"Ton code de réinitialisation : %s\n\n"+
			"Ce code expire dans 30 minutes. Saisis-le dans l'app pour choisir un nouveau mot de passe.\n\n"+
			"Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.\n\n"+
			"— L'équipe Boa Club",
		firstName, rawCode,
	)
	html := fmt.Sprintf(
		`<p>Salut %s,</p>
<p>Tu as demandé à réinitialiser ton mot de passe Boa Club.</p>
<p>Ton code de réinitialisation : <strong style="font-size:1.2em;letter-spacing:2px;">%s</strong></p>
<p>Ce code expire dans 30 minutes. Saisis-le dans l'app pour choisir un nouveau mot de passe.</p>
<p style="color:#666;font-size:0.9em;">Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>
<p>— L'équipe Boa Club</p>`,
		firstName, rawCode,
	)

	if err := s.mailer.Send(ctx, email.Message{
		To:      emailNorm,
		Subject: subject,
		Text:    text,
		HTML:    html,
	}); err != nil {
		s.logger.WarnContext(ctx, "send reset email KO", slog.Any("error", err))
	}
}

// ResetPassword vérifie le code, met à jour le password et révoque toutes les
// sessions (refresh tokens) de l'utilisateur pour des raisons de sécurité.
func (s *AuthService) ResetPassword(ctx context.Context, rawCode, newPassword string) error {
	if rawCode == "" {
		return ErrInvalidResetToken
	}
	tokenHash := auth.HashRefresh(strings.ToUpper(strings.TrimSpace(rawCode)))

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx : %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		userID    uuid.UUID
		expiresAt *time.Time
	)
	err = tx.QueryRow(ctx, `
		SELECT id, password_reset_expires_at
		FROM users
		WHERE password_reset_token = $1 AND deleted_at IS NULL
	`, tokenHash).Scan(&userID, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidResetToken
		}
		return fmt.Errorf("lookup token : %w", err)
	}
	if expiresAt == nil || time.Now().After(*expiresAt) {
		return ErrInvalidResetToken
	}

	hashed, err := auth.HashPassword(newPassword, s.bcryptCost)
	if err != nil {
		return fmt.Errorf("hash password : %w", err)
	}

	// Met à jour le password ET invalide le token de reset.
	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET password_hash = $1,
		    password_reset_token = NULL,
		    password_reset_expires_at = NULL,
		    updated_at = NOW()
		WHERE id = $2
	`, hashed, userID); err != nil {
		return fmt.Errorf("update password : %w", err)
	}

	// Sécurité : révoque tous les refresh tokens existants → l'user devra se relogger
	// partout.
	if _, err := tx.Exec(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = NOW(), revoked_reason = 'password_reset'
		WHERE user_id = $1 AND revoked_at IS NULL
	`, userID); err != nil {
		return fmt.Errorf("revoke sessions : %w", err)
	}

	return tx.Commit(ctx)
}
