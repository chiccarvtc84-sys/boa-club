package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boa-club/api/internal/models"
)

// Erreurs métier exposées par SlotsService.
var (
	ErrSlotNotFound      = errors.New("créneau introuvable")
	ErrSlotCancelled     = errors.New("créneau annulé")
	ErrAlreadyJoined     = errors.New("tu as déjà rejoint ce créneau")
	ErrNotJoined         = errors.New("tu ne fais pas partie de ce créneau")
	ErrNotSlotCreator    = errors.New("seul le créateur peut annuler ce créneau")
	ErrSlotInvalidTime   = errors.New("horaires invalides (fin doit être après début)")
)

// SlotsService gère les créneaux libres entre adhérents.
type SlotsService struct {
	db *pgxpool.Pool
}

func NewSlotsService(db *pgxpool.Pool) *SlotsService {
	return &SlotsService{db: db}
}

// CreateSlotParams : ce qui est nécessaire pour créer un créneau.
type CreateSlotParams struct {
	CreatorID      uuid.UUID
	Title          string
	Description    *string
	ScheduledStart time.Time
	ScheduledEnd   time.Time
	Discipline     models.CourseDiscipline
	Intensity      *models.CourseIntensity
	Location       *string
}

// summaryColumns : SELECT pour reconstruire FreeSlotSummary + creator + count participants.
const summaryColumns = `
	fs.id, fs.scheduled_start, fs.scheduled_end, fs.title, fs.description,
	fs.discipline::text, fs.intensity::text, fs.location, fs.is_cancelled, fs.created_at,
	u.id, u.first_name, u.last_name_initial, u.belt::text, u.stripes, u.avatar_url, u.role::text,
	(SELECT COUNT(*) FROM free_slot_participants fsp WHERE fsp.slot_id = fs.id) AS participant_count
`

func scanSummary(s pgx.Row, sl *models.FreeSlotSummary) error {
	var (
		intensity *string
		role      string
	)
	err := s.Scan(
		&sl.ID, &sl.ScheduledStart, &sl.ScheduledEnd, &sl.Title, &sl.Description,
		&sl.Discipline, &intensity, &sl.Location, &sl.IsCancelled, &sl.CreatedAt,
		&sl.Creator.ID, &sl.Creator.FirstName, &sl.Creator.LastNameInitial,
		&sl.Creator.Belt, &sl.Creator.Stripes, &sl.Creator.AvatarURL, &role,
		&sl.ParticipantCount,
	)
	if err != nil {
		return err
	}
	if intensity != nil {
		ci := models.CourseIntensity(*intensity)
		sl.Intensity = &ci
	}
	sl.Creator.IsCoach = role == "coach" || role == "admin"
	return nil
}

// ListUpcoming renvoie les créneaux à venir (non annulés), ordonnés par date.
func (s *SlotsService) ListUpcoming(ctx context.Context) ([]models.FreeSlotSummary, error) {
	rows, err := s.db.Query(ctx, `
		SELECT `+summaryColumns+`
		FROM free_slots fs
		JOIN users u ON u.id = fs.creator_id
		WHERE fs.is_cancelled = FALSE
		  AND fs.scheduled_end >= NOW()
		ORDER BY fs.scheduled_start ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query free_slots : %w", err)
	}
	defer rows.Close()

	out := []models.FreeSlotSummary{}
	for rows.Next() {
		var sl models.FreeSlotSummary
		if err := scanSummary(rows, &sl); err != nil {
			return nil, fmt.Errorf("scan free_slot : %w", err)
		}
		out = append(out, sl)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// GetByID renvoie le détail d'un créneau (avec la liste complète des participants).
func (s *SlotsService) GetByID(ctx context.Context, id uuid.UUID) (*models.FreeSlotDetail, error) {
	var d models.FreeSlotDetail
	err := s.db.QueryRow(ctx, `
		SELECT `+summaryColumns+`
		FROM free_slots fs
		JOIN users u ON u.id = fs.creator_id
		WHERE fs.id = $1
	`, id).Scan(
		&d.ID, &d.ScheduledStart, &d.ScheduledEnd, &d.Title, &d.Description,
		&d.Discipline, scanIntoIntensityPtr(&d.Intensity), &d.Location, &d.IsCancelled, &d.CreatedAt,
		&d.Creator.ID, &d.Creator.FirstName, &d.Creator.LastNameInitial,
		&d.Creator.Belt, &d.Creator.Stripes, &d.Creator.AvatarURL,
		scanIntoCoachFlag(&d.Creator.IsCoach),
		&d.ParticipantCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSlotNotFound
		}
		return nil, fmt.Errorf("select free_slot : %w", err)
	}

	// Charger les participants.
	d.Participants = []models.UserBrief{}
	rows, err := s.db.Query(ctx, `
		SELECT u.id, u.first_name, u.last_name_initial, u.belt::text, u.stripes, u.avatar_url, u.role::text
		FROM free_slot_participants fsp
		JOIN users u ON u.id = fsp.user_id
		WHERE fsp.slot_id = $1
		ORDER BY fsp.joined_at ASC
	`, id)
	if err != nil {
		return nil, fmt.Errorf("query participants : %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var p models.UserBrief
		var role string
		if err := rows.Scan(&p.ID, &p.FirstName, &p.LastNameInitial, &p.Belt, &p.Stripes, &p.AvatarURL, &role); err != nil {
			return nil, fmt.Errorf("scan participant : %w", err)
		}
		p.IsCoach = role == "coach" || role == "admin"
		d.Participants = append(d.Participants, p)
	}
	return &d, nil
}

// Create insère un créneau, sa source 'manual', et auto-rejoint le créateur.
func (s *SlotsService) Create(ctx context.Context, p CreateSlotParams) (*models.FreeSlotDetail, error) {
	if !p.ScheduledEnd.After(p.ScheduledStart) {
		return nil, ErrSlotInvalidTime
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx : %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var slotID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO free_slots (creator_id, title, description, scheduled_start, scheduled_end, discipline, intensity, location)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`,
		p.CreatorID, p.Title, p.Description, p.ScheduledStart, p.ScheduledEnd,
		string(p.Discipline), strPtrFromIntensity(p.Intensity), p.Location,
	).Scan(&slotID)
	if err != nil {
		return nil, fmt.Errorf("insert free_slot : %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO free_slots_origins (slot_id, origin_type) VALUES ($1, 'manual')
	`, slotID); err != nil {
		return nil, fmt.Errorf("insert free_slots_origins : %w", err)
	}

	// Auto-join du créateur.
	if _, err := tx.Exec(ctx, `
		INSERT INTO free_slot_participants (slot_id, user_id) VALUES ($1, $2)
	`, slotID, p.CreatorID); err != nil {
		return nil, fmt.Errorf("auto-join creator : %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx : %w", err)
	}

	return s.GetByID(ctx, slotID)
}

// Join : ajoute l'utilisateur à la liste des participants. Idempotent.
func (s *SlotsService) Join(ctx context.Context, slotID, userID uuid.UUID) error {
	// Vérifie que le slot existe et n'est pas annulé.
	var isCancelled bool
	if err := s.db.QueryRow(ctx, `SELECT is_cancelled FROM free_slots WHERE id = $1`, slotID).Scan(&isCancelled); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSlotNotFound
		}
		return fmt.Errorf("check slot : %w", err)
	}
	if isCancelled {
		return ErrSlotCancelled
	}

	tag, err := s.db.Exec(ctx, `
		INSERT INTO free_slot_participants (slot_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (slot_id, user_id) DO NOTHING
	`, slotID, userID)
	if err != nil {
		return fmt.Errorf("insert participant : %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrAlreadyJoined
	}
	return nil
}

// Leave : retire l'utilisateur. Si c'est le créateur qui part, on ne touche pas
// au créneau (le créneau survit avec un creator_id pointant toujours sur lui).
func (s *SlotsService) Leave(ctx context.Context, slotID, userID uuid.UUID) error {
	tag, err := s.db.Exec(ctx, `
		DELETE FROM free_slot_participants
		WHERE slot_id = $1 AND user_id = $2
	`, slotID, userID)
	if err != nil {
		return fmt.Errorf("delete participant : %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotJoined
	}
	return nil
}

// Cancel : marque le créneau comme annulé. Seul le créateur peut.
func (s *SlotsService) Cancel(ctx context.Context, slotID, userID uuid.UUID, reason string) error {
	var creatorID uuid.UUID
	if err := s.db.QueryRow(ctx, `SELECT creator_id FROM free_slots WHERE id = $1`, slotID).Scan(&creatorID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSlotNotFound
		}
		return fmt.Errorf("check creator : %w", err)
	}
	if creatorID != userID {
		return ErrNotSlotCreator
	}
	var reasonParam any
	if reason != "" {
		reasonParam = reason
	}
	if _, err := s.db.Exec(ctx, `
		UPDATE free_slots
		SET is_cancelled = TRUE, cancelled_at = NOW(), cancelled_reason = $2
		WHERE id = $1
	`, slotID, reasonParam); err != nil {
		return fmt.Errorf("cancel slot : %w", err)
	}
	return nil
}

// --- helpers ---

// scanIntoIntensityPtr crée un scanner qui décode un text NULLABLE en *CourseIntensity.
// pgx ne permet pas de scan direct dans un *CourseIntensity sans hint.
type intensityScanner struct{ dst **models.CourseIntensity }

func (s intensityScanner) Scan(src any) error {
	if src == nil {
		*s.dst = nil
		return nil
	}
	str, ok := src.(string)
	if !ok {
		// pgx 5 envoie parfois []byte
		if b, okB := src.([]byte); okB {
			str = string(b)
		} else {
			return fmt.Errorf("intensityScanner: unexpected type %T", src)
		}
	}
	ci := models.CourseIntensity(str)
	*s.dst = &ci
	return nil
}

func scanIntoIntensityPtr(dst **models.CourseIntensity) intensityScanner {
	return intensityScanner{dst: dst}
}

// scanIntoCoachFlag : convertit role text en bool IsCoach (coach ou admin).
type coachFlagScanner struct{ dst *bool }

func (s coachFlagScanner) Scan(src any) error {
	var str string
	switch v := src.(type) {
	case string:
		str = v
	case []byte:
		str = string(v)
	case nil:
		*s.dst = false
		return nil
	default:
		return fmt.Errorf("coachFlagScanner: unexpected type %T", src)
	}
	*s.dst = str == "coach" || str == "admin"
	return nil
}

func scanIntoCoachFlag(dst *bool) coachFlagScanner {
	return coachFlagScanner{dst: dst}
}

func strPtrFromIntensity(i *models.CourseIntensity) any {
	if i == nil {
		return nil
	}
	return string(*i)
}
