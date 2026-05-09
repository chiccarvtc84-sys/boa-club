package services

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boa-club/api/internal/models"
)

// CoursesService : lecture du planning hebdomadaire.
type CoursesService struct {
	db *pgxpool.Pool
}

func NewCoursesService(db *pgxpool.Pool) *CoursesService {
	return &CoursesService{db: db}
}

// WeekResponse regroupe le planning template + les overrides ponctuels d'une semaine.
type WeekResponse struct {
	From      string                          `json:"from"` // YYYY-MM-DD (lundi)
	To        string                          `json:"to"`   // YYYY-MM-DD (dimanche)
	Courses   []models.RecurringCourse        `json:"courses"`
	Instances []models.CourseInstanceOverride `json:"instances"`
}

// GetWeek renvoie tous les cours récurrents actifs + les exceptions de la semaine.
// `from` doit être un lundi (ou le service normalise au lundi de la semaine de from).
func (s *CoursesService) GetWeek(ctx context.Context, from time.Time) (*WeekResponse, error) {
	monday := normalizeToMonday(from)
	sunday := monday.AddDate(0, 0, 6)

	// Cours récurrents actifs sur cette période.
	rows, err := s.db.Query(ctx, `
		SELECT
			rc.id,
			rc.course_key,
			rc.day_of_week,
			rc.start_time,
			rc.end_time,
			rc.name,
			rc.location,
			rc.discipline::text,
			rc.intensity::text,
			rc.default_coach_id,
			u.first_name
		FROM recurring_courses rc
		LEFT JOIN users u ON u.id = rc.default_coach_id AND u.deleted_at IS NULL
		WHERE rc.is_active = TRUE
		  AND rc.valid_from <= $2
		  AND (rc.valid_until IS NULL OR rc.valid_until >= $1)
		ORDER BY rc.day_of_week, rc.start_time
	`, monday, sunday)
	if err != nil {
		return nil, fmt.Errorf("query recurring_courses : %w", err)
	}
	defer rows.Close()

	var courses []models.RecurringCourse
	for rows.Next() {
		var (
			c         models.RecurringCourse
			startT    time.Time
			endT      time.Time
			intensity *string
		)
		if err := rows.Scan(
			&c.ID, &c.CourseKey, &c.DayOfWeek, &startT, &endT, &c.Name,
			&c.Location, &c.Discipline, &intensity,
			&c.CoachID, &c.CoachName,
		); err != nil {
			return nil, fmt.Errorf("scan recurring_course : %w", err)
		}
		c.StartTime = startT.Format("15:04")
		c.EndTime = endT.Format("15:04")
		if intensity != nil {
			ci := models.CourseIntensity(*intensity)
			c.Intensity = &ci
		}
		courses = append(courses, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iter : %w", err)
	}

	// Overrides (course_instances) sur la semaine demandée.
	instRows, err := s.db.Query(ctx, `
		SELECT
			ci.recurring_course_id,
			ci.scheduled_date,
			ci.status::text,
			ci.coach_late_minutes,
			ci.coach_absent_message
		FROM course_instances ci
		WHERE ci.scheduled_date BETWEEN $1 AND $2
		  AND ci.recurring_course_id IS NOT NULL
		ORDER BY ci.scheduled_date
	`, monday, sunday)
	if err != nil {
		return nil, fmt.Errorf("query course_instances : %w", err)
	}
	defer instRows.Close()

	instances := []models.CourseInstanceOverride{}
	for instRows.Next() {
		var inst models.CourseInstanceOverride
		var status string
		if err := instRows.Scan(
			&inst.RecurringCourseID, &inst.Date, &status,
			&inst.CoachLateMinutes, &inst.CoachAbsentMessage,
		); err != nil {
			return nil, fmt.Errorf("scan course_instance : %w", err)
		}
		inst.Status = models.CourseStatus(status)
		instances = append(instances, inst)
	}
	if err := instRows.Err(); err != nil {
		return nil, fmt.Errorf("instances iter : %w", err)
	}

	if courses == nil {
		courses = []models.RecurringCourse{}
	}

	return &WeekResponse{
		From:      monday.Format("2006-01-02"),
		To:        sunday.Format("2006-01-02"),
		Courses:   courses,
		Instances: instances,
	}, nil
}

// normalizeToMonday renvoie le lundi de la semaine de t (à 00:00 UTC).
func normalizeToMonday(t time.Time) time.Time {
	t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	weekday := int(t.Weekday()) // 0=Dim, 1=Lun, ..., 6=Sam
	if weekday == 0 {
		// Si dimanche → lundi de la semaine PRÉCÉDENTE.
		return t.AddDate(0, 0, -6)
	}
	return t.AddDate(0, 0, -(weekday - 1))
}
