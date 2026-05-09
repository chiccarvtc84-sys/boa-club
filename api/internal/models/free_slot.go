package models

import (
	"time"

	"github.com/google/uuid"
)

// UserBrief est la version "publique légère" d'un user, embarquée dans les
// réponses qui listent ou détaillent des entités liées (créateur d'un créneau,
// participants, etc.). Pas de password_hash, pas d'email.
type UserBrief struct {
	ID              uuid.UUID `json:"id"`
	FirstName       string    `json:"first_name"`
	LastNameInitial string    `json:"last_name_initial"`
	Belt            Belt      `json:"belt"`
	Stripes         int       `json:"stripes"`
	AvatarURL       *string   `json:"avatar_url"`
	IsCoach         bool      `json:"is_coach"`
}

// FreeSlotSummary : liste d'aperçus pour /api/free-slots.
// Pas la liste complète des participants : juste un count.
type FreeSlotSummary struct {
	ID               uuid.UUID        `json:"id"`
	Creator          UserBrief        `json:"creator"`
	ScheduledStart   time.Time        `json:"scheduled_start"`
	ScheduledEnd     time.Time        `json:"scheduled_end"`
	Title            string           `json:"title"`
	Description      *string          `json:"description,omitempty"`
	Discipline       CourseDiscipline `json:"discipline"`
	Intensity        *CourseIntensity `json:"intensity,omitempty"`
	Location         *string          `json:"location,omitempty"`
	IsCancelled      bool             `json:"is_cancelled"`
	ParticipantCount int              `json:"participant_count"`
	CreatedAt        time.Time        `json:"created_at"`
}

// FreeSlotDetail : retour de /api/free-slots/:id (avec liste complète des participants).
type FreeSlotDetail struct {
	FreeSlotSummary
	Participants []UserBrief `json:"participants"`
}
