package models

import (
	"time"

	"github.com/google/uuid"
)

// Broadcast est une alerte coach/admin diffusée à tous les adhérents.
type Broadcast struct {
	ID                uuid.UUID `json:"id"`
	AuthorUserID      uuid.UUID `json:"author_user_id"`
	AuthorDisplayName string    `json:"author_display_name"`
	Message           string    `json:"message"`
	DurationHours     int       `json:"duration_hours"`
	CreatedAt         time.Time `json:"created_at"`
	ExpiresAt         time.Time `json:"expires_at"`
}
