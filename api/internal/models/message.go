package models

import (
	"time"

	"github.com/google/uuid"
)

// ConversationType correspond à l'ENUM Postgres `conversation_type`.
type ConversationType string

const (
	ConvDirect     ConversationType = "direct"
	ConvSlotThread ConversationType = "slot_thread"
)

// MessageType correspond à l'ENUM Postgres `message_type`.
type MessageType string

const (
	MsgText   MessageType = "text"
	MsgPhoto  MessageType = "photo"
	MsgVoice  MessageType = "voice"
	MsgSystem MessageType = "system"
)

// ConversationSummary : ligne de la liste de conversations DM.
// Pour les DM, `Other` représente l'autre participant ; pour les slot_thread,
// `SlotTitle` est rempli.
type ConversationSummary struct {
	ID              uuid.UUID        `json:"id"`
	Type            ConversationType `json:"type"`
	SlotID          *uuid.UUID       `json:"slot_id,omitempty"`
	SlotTitle       *string          `json:"slot_title,omitempty"`
	Other           *UserBrief       `json:"other,omitempty"` // Pour DM uniquement
	LastMessageAt   *time.Time       `json:"last_message_at,omitempty"`
	LastMessage     *string          `json:"last_message,omitempty"`
	LastMessageType *MessageType     `json:"last_message_type,omitempty"`
	UnreadCount     int              `json:"unread_count"`
}

// Message : un message dans une conversation.
type Message struct {
	ID                   uuid.UUID   `json:"id"`
	ConversationID       uuid.UUID   `json:"conversation_id"`
	Sender               *UserBrief  `json:"sender,omitempty"` // nil pour 'system'
	Type                 MessageType `json:"type"`
	Content              *string     `json:"content,omitempty"`
	MediaURL             *string     `json:"media_url,omitempty"`
	MediaDurationSeconds *int        `json:"media_duration_seconds,omitempty"`
	CreatedAt            time.Time   `json:"created_at"`
}
