package models

import (
	"time"

	"github.com/google/uuid"
)

// CourseDiscipline correspond à l'ENUM Postgres `course_discipline`.
type CourseDiscipline string

const (
	DisciplineJJBGi   CourseDiscipline = "jjb_gi"
	DisciplineJJBNoGi CourseDiscipline = "jjb_nogi"
	DisciplineMMA     CourseDiscipline = "mma"
	DisciplineWrest   CourseDiscipline = "wrestling"
	DisciplineOpenMat CourseDiscipline = "open_mat"
	DisciplineMixed   CourseDiscipline = "mixed"
)

// CourseIntensity correspond à l'ENUM Postgres `course_intensity`.
type CourseIntensity string

// CourseStatus correspond à l'ENUM Postgres `course_status`.
type CourseStatus string

const (
	CourseScheduled CourseStatus = "scheduled"
	CourseCancelled CourseStatus = "cancelled"
	CourseFreeOpen  CourseStatus = "free_open"
)

// RecurringCourse est le template hebdomadaire d'un cours.
type RecurringCourse struct {
	ID         uuid.UUID        `json:"id"`
	CourseKey  string           `json:"course_key"`  // identifiant logique stable, ex: "jjb-gi"
	DayOfWeek  int              `json:"day_of_week"` // 0=Dim, 1=Lun, ..., 6=Sam
	StartTime  string           `json:"start_time"`  // "18:30"
	EndTime    string           `json:"end_time"`    // "19:30"
	Name       string           `json:"name"`
	Location   *string          `json:"location"`
	Discipline CourseDiscipline `json:"discipline"`
	Intensity  *CourseIntensity `json:"intensity,omitempty"`
	CoachID    *uuid.UUID       `json:"coach_id,omitempty"`
	CoachName  *string          `json:"coach_name,omitempty"`
}

// CourseInstanceOverride est une exception à un cours récurrent pour une date donnée
// (annulation, retard, absence). Le mobile fusionne avec le RecurringCourse.
type CourseInstanceOverride struct {
	RecurringCourseID  uuid.UUID    `json:"recurring_course_id"`
	Date               time.Time    `json:"date"`
	Status             CourseStatus `json:"status"`
	CoachLateMinutes   *int         `json:"coach_late_minutes,omitempty"`
	CoachAbsentMessage *string      `json:"coach_absent_message,omitempty"`
}
