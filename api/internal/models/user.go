// Package models contient les types métier partagés (User, Course, Slot…).
package models

import (
	"time"

	"github.com/google/uuid"
)

// Belt est la couleur de ceinture JJB.
type Belt string

const (
	BeltWhite  Belt = "white"
	BeltBlue   Belt = "blue"
	BeltPurple Belt = "purple"
	BeltBrown  Belt = "brown"
	BeltBlack  Belt = "black"
)

// Role d'un utilisateur dans l'application.
type Role string

const (
	RoleMember Role = "member"
	RoleCoach  Role = "coach"
	RoleAdmin  Role = "admin"
)

// Status du compte.
type Status string

const (
	StatusPending   Status = "pending"
	StatusActive    Status = "active"
	StatusSuspended Status = "suspended"
	StatusDeleted   Status = "deleted"
)

// WeightVisibility règle qui peut voir le poids d'un user.
type WeightVisibility string

const (
	WeightPublic  WeightVisibility = "public"
	WeightMembers WeightVisibility = "members"
	WeightPrivate WeightVisibility = "private"
)

// User est la représentation publique d'un utilisateur.
// Le password_hash n'est volontairement pas inclus : il ne doit jamais sortir
// de la couche service.
type User struct {
	ID               uuid.UUID        `json:"id"`
	Email            string           `json:"email"`
	FirstName        string           `json:"first_name"`
	LastNameInitial  string           `json:"last_name_initial"`
	AvatarURL        *string          `json:"avatar_url"`
	Bio              *string          `json:"bio"`
	Belt             Belt             `json:"belt"`
	Stripes          int              `json:"stripes"`
	WeightKg         *float64         `json:"weight_kg,omitempty"`
	WeightVisibility WeightVisibility `json:"weight_visibility"`
	Disciplines      []string         `json:"disciplines"`
	Role             Role             `json:"role"`
	Status           Status           `json:"status"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
	LastLoginAt      *time.Time       `json:"last_login_at,omitempty"`
}
