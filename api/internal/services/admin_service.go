package services

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boa-club/api/internal/models"
	"github.com/boa-club/api/internal/push"
)

// Erreurs métier de AdminService.
var (
	ErrNotAdminOrCoach   = errors.New("réservé aux coachs et admins")
	ErrBroadcastNotFound = errors.New("alerte introuvable")
	ErrCourseNotFound    = errors.New("cours introuvable")
)

// AdminService regroupe les opérations réservées aux rôles coach + admin.
type AdminService struct {
	db     *pgxpool.Pool
	push   push.Sender
	logger *slog.Logger
}

func NewAdminService(db *pgxpool.Pool, pushSender push.Sender, logger *slog.Logger) *AdminService {
	return &AdminService{db: db, push: pushSender, logger: logger}
}

// allActiveFCMTokens renvoie tous les FCM tokens des adhérents actifs (sauf l'auteur).
func (s *AdminService) allActiveFCMTokens(ctx context.Context, exceptUserID uuid.UUID) ([]string, error) {
	rows, err := s.db.Query(ctx, `
		SELECT fcm_token FROM users
		WHERE status = 'active' AND deleted_at IS NULL
		  AND fcm_token IS NOT NULL AND fcm_token != ''
		  AND id != $1
	`, exceptUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			out = append(out, t)
		}
	}
	return out, nil
}

// fcmTokensFollowingCourse : adhérents qui suivent ce cours et ont un fcm_token.
func (s *AdminService) fcmTokensFollowingCourse(ctx context.Context, courseID uuid.UUID) ([]string, error) {
	rows, err := s.db.Query(ctx, `
		SELECT u.fcm_token
		FROM user_course_followings ucf
		JOIN users u ON u.id = ucf.user_id
		WHERE ucf.recurring_course_id = $1
		  AND u.status = 'active' AND u.deleted_at IS NULL
		  AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			out = append(out, t)
		}
	}
	return out, nil
}

// --- Autorisation ---

// requireCoachOrAdmin renvoie ErrNotAdminOrCoach si l'utilisateur n'a pas le rôle requis.
func (s *AdminService) requireCoachOrAdmin(ctx context.Context, userID uuid.UUID) (string, error) {
	var role string
	err := s.db.QueryRow(ctx, `
		SELECT role::text FROM users WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrUserNotFound
		}
		return "", fmt.Errorf("check role : %w", err)
	}
	if role != "coach" && role != "admin" {
		return "", ErrNotAdminOrCoach
	}
	return role, nil
}

// --- Broadcasts ---

// CreateBroadcastParams : payload pour POST /api/admin/broadcasts.
type CreateBroadcastParams struct {
	AuthorUserID  uuid.UUID
	DisplayName   string // "Vincent" — affiché en haut du bandeau côté adhérents
	Message       string
	DurationHours int
}

// CreateBroadcast crée une alerte. Réservé aux coachs et admins.
func (s *AdminService) CreateBroadcast(ctx context.Context, p CreateBroadcastParams) (*models.Broadcast, error) {
	if _, err := s.requireCoachOrAdmin(ctx, p.AuthorUserID); err != nil {
		return nil, err
	}

	expiresAt := time.Now().Add(time.Duration(p.DurationHours) * time.Hour)

	var b models.Broadcast
	err := s.db.QueryRow(ctx, `
		INSERT INTO broadcasts (author_user_id, author_display_name, message, duration_hours, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, author_user_id, author_display_name, message, duration_hours, created_at, expires_at
	`, p.AuthorUserID, p.DisplayName, p.Message, p.DurationHours, expiresAt).Scan(
		&b.ID, &b.AuthorUserID, &b.AuthorDisplayName, &b.Message,
		&b.DurationHours, &b.CreatedAt, &b.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert broadcast : %w", err)
	}

	// Push notification à tous les adhérents (sauf l'auteur lui-même).
	go func() {
		bgCtx := context.Background()
		tokens, err := s.allActiveFCMTokens(bgCtx, p.AuthorUserID)
		if err != nil {
			s.logger.WarnContext(bgCtx, "broadcast push : list tokens KO", slog.Any("error", err))
			return
		}
		if len(tokens) == 0 {
			return
		}
		ok, ko := s.push.SendMulti(bgCtx, tokens, push.Notification{
			Title: fmt.Sprintf("Alerte de %s", p.DisplayName),
			Body:  p.Message,
			Data:  map[string]string{"type": "broadcast", "broadcast_id": b.ID.String()},
		})
		s.logger.InfoContext(bgCtx, "broadcast push", slog.Int("ok", ok), slog.Int("ko", ko))
	}()

	return &b, nil
}

// ListActiveBroadcasts renvoie les broadcasts actifs (non expirés, non révoqués)
// que `userID` n'a pas dismissé.
func (s *AdminService) ListActiveBroadcasts(ctx context.Context, userID uuid.UUID) ([]models.Broadcast, error) {
	rows, err := s.db.Query(ctx, `
		SELECT b.id, b.author_user_id, b.author_display_name, b.message,
		       b.duration_hours, b.created_at, b.expires_at
		FROM broadcasts b
		WHERE b.revoked_at IS NULL
		  AND b.expires_at > NOW()
		  AND NOT EXISTS (
		    SELECT 1 FROM broadcast_dismissals d
		    WHERE d.broadcast_id = b.id AND d.user_id = $1
		  )
		ORDER BY b.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query broadcasts : %w", err)
	}
	defer rows.Close()

	out := []models.Broadcast{}
	for rows.Next() {
		var b models.Broadcast
		if err := rows.Scan(
			&b.ID, &b.AuthorUserID, &b.AuthorDisplayName, &b.Message,
			&b.DurationHours, &b.CreatedAt, &b.ExpiresAt,
		); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// DismissBroadcast : l'utilisateur ferme manuellement le bandeau pour lui-même.
func (s *AdminService) DismissBroadcast(ctx context.Context, broadcastID, userID uuid.UUID) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO broadcast_dismissals (broadcast_id, user_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, broadcastID, userID)
	if err != nil {
		return fmt.Errorf("dismiss : %w", err)
	}
	return nil
}

// RevokeBroadcast : l'auteur (ou un admin) retire l'alerte avant expiration.
func (s *AdminService) RevokeBroadcast(ctx context.Context, broadcastID, userID uuid.UUID) error {
	role, err := s.requireCoachOrAdmin(ctx, userID)
	if err != nil {
		return err
	}

	var authorID uuid.UUID
	if err := s.db.QueryRow(ctx, `
		SELECT author_user_id FROM broadcasts WHERE id = $1 AND revoked_at IS NULL
	`, broadcastID).Scan(&authorID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrBroadcastNotFound
		}
		return fmt.Errorf("lookup broadcast : %w", err)
	}
	if role != "admin" && authorID != userID {
		return ErrNotAdminOrCoach
	}
	_, err = s.db.Exec(ctx, `UPDATE broadcasts SET revoked_at = NOW() WHERE id = $1`, broadcastID)
	return err
}

// --- Course notifications (retard / absence) ---

// NotifyCourseParams : POST /api/admin/courses/:id/notify
type NotifyCourseParams struct {
	RecurringCourseID uuid.UUID
	Date              time.Time
	UserID            uuid.UUID // Coach/admin qui annonce
	IsLate            bool
	MinutesLate       *int
	IsAbsent          bool
	Cancelled         bool
	Message           *string
}

// NotifyCourse crée (ou met à jour) une `course_instances` pour annoncer un retard
// ou une absence sur un cours à une date précise.
func (s *AdminService) NotifyCourse(ctx context.Context, p NotifyCourseParams) error {
	if _, err := s.requireCoachOrAdmin(ctx, p.UserID); err != nil {
		return err
	}

	// Récupère les infos du cours récurrent pour calculer scheduled_start/end.
	var (
		dayOfWeek int
		startTime time.Time
		endTime   time.Time
	)
	err := s.db.QueryRow(ctx, `
		SELECT day_of_week, start_time, end_time
		FROM recurring_courses WHERE id = $1
	`, p.RecurringCourseID).Scan(&dayOfWeek, &startTime, &endTime)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCourseNotFound
		}
		return fmt.Errorf("lookup course : %w", err)
	}

	// Combine la date demandée avec les heures du cours.
	scheduledStart := time.Date(
		p.Date.Year(), p.Date.Month(), p.Date.Day(),
		startTime.Hour(), startTime.Minute(), 0, 0, time.Local,
	)
	scheduledEnd := time.Date(
		p.Date.Year(), p.Date.Month(), p.Date.Day(),
		endTime.Hour(), endTime.Minute(), 0, 0, time.Local,
	)

	status := "scheduled"
	if p.Cancelled {
		status = "cancelled"
	} else if p.IsAbsent {
		status = "free_open"
	}

	// UPSERT sur (recurring_course_id, scheduled_date) — pas de contrainte unique
	// donc on fait DELETE + INSERT en transaction pour rester simple.
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx : %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		DELETE FROM course_instances
		WHERE recurring_course_id = $1 AND scheduled_date = $2
	`, p.RecurringCourseID, p.Date); err != nil {
		return fmt.Errorf("clear existing instance : %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO course_instances (
			recurring_course_id, scheduled_date, scheduled_start, scheduled_end,
			status, coach_late_minutes, coach_absent_message
		)
		VALUES ($1, $2, $3, $4, $5::course_status, $6, $7)
	`, p.RecurringCourseID, p.Date, scheduledStart, scheduledEnd,
		status, p.MinutesLate, p.Message); err != nil {
		return fmt.Errorf("insert instance : %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Push notification aux adhérents qui suivent ce cours.
	courseID := p.RecurringCourseID
	go func() {
		bgCtx := context.Background()
		tokens, err := s.fcmTokensFollowingCourse(bgCtx, courseID)
		if err != nil || len(tokens) == 0 {
			return
		}
		var title, body string
		if p.IsLate {
			minutes := 0
			if p.MinutesLate != nil {
				minutes = *p.MinutesLate
			}
			title = "Coach en retard"
			body = fmt.Sprintf("Retard de %d min sur ton cours. Démarrez l'échauffement.", minutes)
		} else {
			title = "Coach absent"
			body = "Le cours a été modifié."
			if p.Cancelled {
				body = "Le cours est annulé."
			} else {
				body = "Cours libre maintenu — venez quand même !"
			}
		}
		if p.Message != nil && *p.Message != "" {
			body = body + " " + *p.Message
		}
		ok, ko := s.push.SendMulti(bgCtx, tokens, push.Notification{
			Title: title,
			Body:  body,
			Data:  map[string]string{"type": "course_alert", "course_id": courseID.String()},
		})
		s.logger.InfoContext(bgCtx, "notify course push", slog.Int("ok", ok), slog.Int("ko", ko))
	}()

	return nil
}

// --- Course edition ---

// UpdateCourseParams : tous les champs sont optionnels (pointeurs).
type UpdateCourseParams struct {
	UserID         uuid.UUID // qui fait la modif (pour autorisation)
	CourseID       uuid.UUID
	DefaultCoachID *uuid.UUID
	StartTime      *string // "18:30"
	EndTime        *string // "19:30"
	Location       *string
	Discipline     *models.CourseDiscipline
	Intensity      *models.CourseIntensity
	IsActive       *bool
}

// UpdateCourse modifie un recurring_course. Réservé coach/admin.
// Le nom du cours et le jour de la semaine ne sont PAS modifiables (cf. proto).
func (s *AdminService) UpdateCourse(ctx context.Context, p UpdateCourseParams) error {
	if _, err := s.requireCoachOrAdmin(ctx, p.UserID); err != nil {
		return err
	}

	var (
		coachID    any
		startTime  any
		endTime    any
		location   any
		discipline any
		intensity  any
		isActive   any
	)
	if p.DefaultCoachID != nil {
		coachID = *p.DefaultCoachID
	}
	if p.StartTime != nil {
		startTime = *p.StartTime
	}
	if p.EndTime != nil {
		endTime = *p.EndTime
	}
	if p.Location != nil {
		location = *p.Location
	}
	if p.Discipline != nil {
		discipline = string(*p.Discipline)
	}
	if p.Intensity != nil {
		intensity = string(*p.Intensity)
	}
	if p.IsActive != nil {
		isActive = *p.IsActive
	}

	tag, err := s.db.Exec(ctx, `
		UPDATE recurring_courses SET
			default_coach_id = COALESCE($1::uuid,              default_coach_id),
			start_time       = COALESCE($2::time,              start_time),
			end_time         = COALESCE($3::time,              end_time),
			location         = COALESCE($4::varchar,           location),
			discipline       = COALESCE($5::course_discipline, discipline),
			intensity        = COALESCE($6::course_intensity,  intensity),
			is_active        = COALESCE($7::boolean,           is_active),
			updated_at       = NOW()
		WHERE id = $8
	`, coachID, startTime, endTime, location, discipline, intensity, isActive, p.CourseID)
	if err != nil {
		return fmt.Errorf("update course : %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrCourseNotFound
	}
	return nil
}

// ListCoaches renvoie les coachs et admins du club, triés par prénom.
// Utile pour le sélecteur "Coach" dans l'écran de modification de cours.
func (s *AdminService) ListCoaches(ctx context.Context) ([]models.UserBrief, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, first_name, last_name_initial, belt::text, stripes, avatar_url, role::text
		FROM users
		WHERE role IN ('coach', 'admin')
		  AND status = 'active'
		  AND deleted_at IS NULL
		ORDER BY first_name
	`)
	if err != nil {
		return nil, fmt.Errorf("query coaches : %w", err)
	}
	defer rows.Close()

	out := []models.UserBrief{}
	for rows.Next() {
		var (
			u    models.UserBrief
			role string
		)
		if err := rows.Scan(
			&u.ID, &u.FirstName, &u.LastNameInitial,
			&u.Belt, &u.Stripes, &u.AvatarURL, &role,
		); err != nil {
			return nil, err
		}
		u.IsCoach = true
		out = append(out, u)
	}
	return out, rows.Err()
}
