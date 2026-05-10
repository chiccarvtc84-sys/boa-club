package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boa-club/api/internal/models"
)

// Erreurs métier de MessagesService.
var (
	ErrConversationNotFound = errors.New("conversation introuvable")
	ErrNotParticipant       = errors.New("tu ne fais pas partie de cette conversation")
	ErrCannotDMSelf         = errors.New("impossible de s'envoyer un DM à soi-même")
	ErrEmptyMessage         = errors.New("message vide")
)

// MessagesService gère DM + threads de créneaux libres.
type MessagesService struct {
	db *pgxpool.Pool
}

func NewMessagesService(db *pgxpool.Pool) *MessagesService {
	return &MessagesService{db: db}
}

// OpenDM trouve la conversation directe entre `userID` et `otherID` ou la crée
// si elle n'existe pas. Idempotent : appeler 2x renvoie la même conversation.
func (s *MessagesService) OpenDM(ctx context.Context, userID, otherID uuid.UUID) (uuid.UUID, error) {
	if userID == otherID {
		return uuid.Nil, ErrCannotDMSelf
	}

	// Cherche une conversation directe partagée par les 2 users.
	var convID uuid.UUID
	err := s.db.QueryRow(ctx, `
		SELECT c.id FROM conversations c
		JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = $1
		JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = $2
		WHERE c.type = 'direct'
		LIMIT 1
	`, userID, otherID).Scan(&convID)
	if err == nil {
		return convID, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, fmt.Errorf("lookup DM : %w", err)
	}

	// Sinon : on la crée + ajout des 2 participants en transaction.
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, fmt.Errorf("begin tx : %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := tx.QueryRow(ctx, `INSERT INTO conversations (type) VALUES ('direct') RETURNING id`).Scan(&convID); err != nil {
		return uuid.Nil, fmt.Errorf("insert conversation : %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)
	`, convID, userID, otherID); err != nil {
		return uuid.Nil, fmt.Errorf("insert participants : %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, fmt.Errorf("commit : %w", err)
	}
	return convID, nil
}

// EnsureSlotThread crée la conversation slot_thread d'un créneau si elle n'existe pas.
// Y ajoute aussi le user spécifié comme participant (idempotent).
func (s *MessagesService) EnsureSlotThread(ctx context.Context, slotID, userID uuid.UUID) (uuid.UUID, error) {
	var convID uuid.UUID

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, fmt.Errorf("begin tx : %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = tx.QueryRow(ctx, `SELECT id FROM conversations WHERE slot_id = $1`, slotID).Scan(&convID)
	if errors.Is(err, pgx.ErrNoRows) {
		if err := tx.QueryRow(ctx, `
			INSERT INTO conversations (type, slot_id) VALUES ('slot_thread', $1) RETURNING id
		`, slotID).Scan(&convID); err != nil {
			return uuid.Nil, fmt.Errorf("create slot_thread : %w", err)
		}
	} else if err != nil {
		return uuid.Nil, fmt.Errorf("lookup slot_thread : %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO conversation_participants (conversation_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (conversation_id, user_id) DO NOTHING
	`, convID, userID); err != nil {
		return uuid.Nil, fmt.Errorf("add participant : %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, fmt.Errorf("commit : %w", err)
	}
	return convID, nil
}

// requireParticipant vérifie que userID est bien dans la conversation. Renvoie ErrNotParticipant sinon.
func (s *MessagesService) requireParticipant(ctx context.Context, convID, userID uuid.UUID) error {
	var exists bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM conversation_participants
			WHERE conversation_id = $1 AND user_id = $2
		)
	`, convID, userID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check participant : %w", err)
	}
	if !exists {
		return ErrNotParticipant
	}
	return nil
}

// ListDMs renvoie les conversations DM de userID, ordonnées par dernier message.
func (s *MessagesService) ListDMs(ctx context.Context, userID uuid.UUID) ([]models.ConversationSummary, error) {
	rows, err := s.db.Query(ctx, `
		SELECT
			c.id, c.type::text, c.slot_id, c.last_message_at,
			ou.id, ou.first_name, ou.last_name_initial, ou.belt::text, ou.stripes, ou.avatar_url, ou.role::text,
			(
				SELECT m.content FROM messages m
				WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
				ORDER BY m.created_at DESC LIMIT 1
			) AS last_content,
			(
				SELECT m.type::text FROM messages m
				WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
				ORDER BY m.created_at DESC LIMIT 1
			) AS last_type,
			COALESCE(p.last_read_at, '1970-01-01'::timestamptz) AS my_last_read,
			(
				SELECT COUNT(*) FROM messages m
				WHERE m.conversation_id = c.id
				  AND m.created_at > COALESCE(p.last_read_at, '1970-01-01'::timestamptz)
				  AND m.sender_id <> $1 AND m.deleted_at IS NULL
			) AS unread_count
		FROM conversations c
		JOIN conversation_participants p ON p.conversation_id = c.id AND p.user_id = $1
		LEFT JOIN conversation_participants po ON po.conversation_id = c.id AND po.user_id <> $1
		LEFT JOIN users ou ON ou.id = po.user_id
		WHERE c.type = 'direct'
		ORDER BY c.last_message_at DESC NULLS LAST
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query DMs : %w", err)
	}
	defer rows.Close()

	out := []models.ConversationSummary{}
	for rows.Next() {
		var (
			s          models.ConversationSummary
			convType   string
			otherID    *uuid.UUID
			otherFirst *string
			otherLast  *string
			otherBelt  *string
			otherStrp  *int
			otherAv    *string
			otherRole  *string
			lastType   *string
			myLastRead time.Time
		)
		if err := rows.Scan(
			&s.ID, &convType, &s.SlotID, &s.LastMessageAt,
			&otherID, &otherFirst, &otherLast, &otherBelt, &otherStrp, &otherAv, &otherRole,
			&s.LastMessage, &lastType, &myLastRead, &s.UnreadCount,
		); err != nil {
			return nil, fmt.Errorf("scan DM : %w", err)
		}
		s.Type = models.ConversationType(convType)
		if lastType != nil {
			mt := models.MessageType(*lastType)
			s.LastMessageType = &mt
		}
		if otherID != nil && otherFirst != nil {
			s.Other = &models.UserBrief{
				ID:              *otherID,
				FirstName:       *otherFirst,
				LastNameInitial: deref(otherLast),
				Belt:            models.Belt(deref(otherBelt)),
				Stripes:         derefInt(otherStrp),
				AvatarURL:       otherAv,
				IsCoach:         otherRole != nil && (*otherRole == "coach" || *otherRole == "admin"),
			}
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ListMessages renvoie les messages d'une conversation, page par page (par défaut 50 max).
// `before` permet de paginer (renvoie les messages strictement antérieurs).
func (s *MessagesService) ListMessages(ctx context.Context, convID, userID uuid.UUID, before *time.Time, limit int) ([]models.Message, error) {
	if err := s.requireParticipant(ctx, convID, userID); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var beforeArg any = "9999-01-01"
	if before != nil {
		beforeArg = *before
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			m.id, m.conversation_id, m.type::text, m.content, m.media_url, m.media_duration_seconds, m.created_at,
			u.id, u.first_name, u.last_name_initial, u.belt::text, u.stripes, u.avatar_url, u.role::text
		FROM messages m
		LEFT JOIN users u ON u.id = m.sender_id
		WHERE m.conversation_id = $1
		  AND m.created_at < $2
		  AND m.deleted_at IS NULL
		ORDER BY m.created_at DESC
		LIMIT $3
	`, convID, beforeArg, limit)
	if err != nil {
		return nil, fmt.Errorf("query messages : %w", err)
	}
	defer rows.Close()

	out := []models.Message{}
	for rows.Next() {
		var (
			m       models.Message
			msgType string
			senderID *uuid.UUID
			senderFirst *string
			senderLast *string
			senderBelt *string
			senderStrp *int
			senderAv   *string
			senderRole *string
		)
		if err := rows.Scan(
			&m.ID, &m.ConversationID, &msgType, &m.Content, &m.MediaURL, &m.MediaDurationSeconds, &m.CreatedAt,
			&senderID, &senderFirst, &senderLast, &senderBelt, &senderStrp, &senderAv, &senderRole,
		); err != nil {
			return nil, fmt.Errorf("scan message : %w", err)
		}
		m.Type = models.MessageType(msgType)
		if senderID != nil && senderFirst != nil {
			m.Sender = &models.UserBrief{
				ID:              *senderID,
				FirstName:       *senderFirst,
				LastNameInitial: deref(senderLast),
				Belt:            models.Belt(deref(senderBelt)),
				Stripes:         derefInt(senderStrp),
				AvatarURL:       senderAv,
				IsCoach:         senderRole != nil && (*senderRole == "coach" || *senderRole == "admin"),
			}
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Enrichit chaque message avec ses réactions emoji agrégées.
	if err := s.attachReactions(ctx, out, userID); err != nil {
		return nil, fmt.Errorf("attach reactions : %w", err)
	}
	return out, nil
}

// attachReactions remplit le champ Reactions de chaque message en un seul
// roundtrip SQL (group by emoji avec un BOOL_OR pour HasMine).
func (s *MessagesService) attachReactions(
	ctx context.Context,
	msgs []models.Message,
	userID uuid.UUID,
) error {
	if len(msgs) == 0 {
		return nil
	}
	ids := make([]uuid.UUID, len(msgs))
	for i, m := range msgs {
		ids[i] = m.ID
	}

	rows, err := s.db.Query(ctx, `
		SELECT message_id, emoji, COUNT(*)::int, BOOL_OR(user_id = $2)
		FROM message_reactions
		WHERE message_id = ANY($1)
		GROUP BY message_id, emoji
		ORDER BY message_id, emoji
	`, ids, userID)
	if err != nil {
		return err
	}
	defer rows.Close()

	// Index msgID -> []reactions
	byMsg := make(map[uuid.UUID][]models.MessageReaction, len(msgs))
	for rows.Next() {
		var (
			msgID   uuid.UUID
			emoji   string
			count   int
			hasMine bool
		)
		if err := rows.Scan(&msgID, &emoji, &count, &hasMine); err != nil {
			return err
		}
		byMsg[msgID] = append(byMsg[msgID], models.MessageReaction{
			Emoji:   emoji,
			Count:   count,
			HasMine: hasMine,
		})
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for i := range msgs {
		if r, ok := byMsg[msgs[i].ID]; ok {
			msgs[i].Reactions = r
		}
	}
	return nil
}

// AddReaction pose une réaction emoji sur un message.
// Idempotent : si l'utilisateur a déjà cette réaction, ne rien faire.
func (s *MessagesService) AddReaction(
	ctx context.Context,
	convID, msgID, userID uuid.UUID,
	emoji string,
) error {
	if err := s.requireParticipant(ctx, convID, userID); err != nil {
		return err
	}
	if emoji == "" || len(emoji) > 16 {
		return fmt.Errorf("emoji invalide")
	}
	// Vérifie que le message appartient bien à la conversation, sinon
	// un attaquant pourrait poser une réaction sur un message d'une conv
	// dont il n'est pas membre.
	var convCheck uuid.UUID
	err := s.db.QueryRow(ctx,
		`SELECT conversation_id FROM messages WHERE id = $1 AND deleted_at IS NULL`,
		msgID,
	).Scan(&convCheck)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrConversationNotFound
		}
		return err
	}
	if convCheck != convID {
		return ErrNotParticipant
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO message_reactions (message_id, user_id, emoji)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
	`, msgID, userID, emoji)
	return err
}

// RemoveReaction retire une réaction posée par l'utilisateur courant.
// No-op si la réaction n'existe pas.
func (s *MessagesService) RemoveReaction(
	ctx context.Context,
	convID, msgID, userID uuid.UUID,
	emoji string,
) error {
	if err := s.requireParticipant(ctx, convID, userID); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `
		DELETE FROM message_reactions
		WHERE message_id = $1 AND user_id = $2 AND emoji = $3
	`, msgID, userID, emoji)
	return err
}

// SetMute définit le `muted_until` du participant. `until` nil = unmute.
// Pour un mute "indéfini" depuis le mobile, on passe une date très loin
// dans le futur (ex: 9999-12-31).
func (s *MessagesService) SetMute(
	ctx context.Context,
	convID, userID uuid.UUID,
	until *time.Time,
) error {
	if err := s.requireParticipant(ctx, convID, userID); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `
		UPDATE conversation_participants
		SET muted_until = $3
		WHERE conversation_id = $1 AND user_id = $2
	`, convID, userID, until)
	return err
}

// MessageSearchHit : un message trouvé via la recherche FTS, avec son
// contexte de conversation (pour pouvoir naviguer dessus).
type MessageSearchHit struct {
	Message            models.Message `json:"message"`
	ConversationTitle  *string        `json:"conversation_title,omitempty"`
	ConversationType   string         `json:"conversation_type"`
	OtherParticipant   *models.UserBrief `json:"other,omitempty"`
}

// SearchMessages cherche dans toutes les conversations dont l'utilisateur
// est participant, en utilisant l'index FTS français de la migration 012.
func (s *MessagesService) SearchMessages(
	ctx context.Context,
	userID uuid.UUID,
	query string,
	limit int,
) ([]MessageSearchHit, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []MessageSearchHit{}, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			m.id, m.conversation_id, m.type::text, m.content, m.media_url,
			m.media_duration_seconds, m.created_at,
			u.id, u.first_name, u.last_name_initial, u.belt::text, u.stripes, u.avatar_url, u.role::text,
			c.type::text,
			fs.title
		FROM messages m
		JOIN conversations c ON c.id = m.conversation_id
		JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
		LEFT JOIN users u ON u.id = m.sender_id
		LEFT JOIN free_slots fs ON fs.id = c.slot_id
		WHERE m.deleted_at IS NULL
		  AND m.content IS NOT NULL
		  AND to_tsvector('french', COALESCE(m.content, '')) @@ plainto_tsquery('french', $2)
		ORDER BY m.created_at DESC
		LIMIT $3
	`, userID, query, limit)
	if err != nil {
		return nil, fmt.Errorf("search messages : %w", err)
	}
	defer rows.Close()

	out := []MessageSearchHit{}
	for rows.Next() {
		var (
			m            models.Message
			msgType      string
			senderID     *uuid.UUID
			senderFirst  *string
			senderLast   *string
			senderBelt   *string
			senderStrp   *int
			senderAv     *string
			senderRole   *string
			convType     string
			slotTitle    *string
		)
		if err := rows.Scan(
			&m.ID, &m.ConversationID, &msgType, &m.Content, &m.MediaURL, &m.MediaDurationSeconds, &m.CreatedAt,
			&senderID, &senderFirst, &senderLast, &senderBelt, &senderStrp, &senderAv, &senderRole,
			&convType, &slotTitle,
		); err != nil {
			return nil, fmt.Errorf("scan search hit : %w", err)
		}
		m.Type = models.MessageType(msgType)
		if senderID != nil && senderFirst != nil {
			m.Sender = &models.UserBrief{
				ID:              *senderID,
				FirstName:       *senderFirst,
				LastNameInitial: deref(senderLast),
				Belt:            models.Belt(deref(senderBelt)),
				Stripes:         derefInt(senderStrp),
				AvatarURL:       senderAv,
				IsCoach:         senderRole != nil && (*senderRole == "coach" || *senderRole == "admin"),
			}
		}
		out = append(out, MessageSearchHit{
			Message:           m,
			ConversationTitle: slotTitle,
			ConversationType:  convType,
		})
	}
	return out, rows.Err()
}

// SendText envoie un message texte simple.
func (s *MessagesService) SendText(ctx context.Context, convID, userID uuid.UUID, content string) (*models.Message, error) {
	if err := s.requireParticipant(ctx, convID, userID); err != nil {
		return nil, err
	}
	if content == "" {
		return nil, ErrEmptyMessage
	}

	var (
		m       models.Message
		msgType string
		first   string
		lastN   string
		beltStr string
		stripes int
		av      *string
		role    string
	)
	err := s.db.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO messages (conversation_id, sender_id, type, content)
			VALUES ($1, $2, 'text', $3)
			RETURNING id, conversation_id, type::text, content, created_at
		)
		SELECT i.id, i.conversation_id, i.type, i.content, i.created_at,
		       u.first_name, u.last_name_initial, u.belt::text, u.stripes, u.avatar_url, u.role::text
		FROM inserted i
		JOIN users u ON u.id = $2
	`, convID, userID, content).Scan(
		&m.ID, &m.ConversationID, &msgType, &m.Content, &m.CreatedAt,
		&first, &lastN, &beltStr, &stripes, &av, &role,
	)
	if err != nil {
		return nil, fmt.Errorf("insert message : %w", err)
	}
	m.Type = models.MessageType(msgType)
	m.Sender = &models.UserBrief{
		ID:              userID,
		FirstName:       first,
		LastNameInitial: lastN,
		Belt:            models.Belt(beltStr),
		Stripes:         stripes,
		AvatarURL:       av,
		IsCoach:         role == "coach" || role == "admin",
	}
	return &m, nil
}

// SendMedia envoie un message photo ou note vocale (avec URL de média
// déjà uploadée sur R2). `durationSec` est ignoré pour les photos, requis
// pour les notes vocales.
func (s *MessagesService) SendMedia(
	ctx context.Context,
	convID, userID uuid.UUID,
	msgType models.MessageType,
	mediaURL string,
	durationSec *int,
) (*models.Message, error) {
	if err := s.requireParticipant(ctx, convID, userID); err != nil {
		return nil, err
	}
	if msgType != models.MsgPhoto && msgType != models.MsgVoice {
		return nil, fmt.Errorf("type invalide pour SendMedia : %s", msgType)
	}
	if mediaURL == "" {
		return nil, ErrEmptyMessage
	}

	var (
		m       models.Message
		typeStr string
		first   string
		lastN   string
		beltStr string
		stripes int
		av      *string
		role    string
	)
	err := s.db.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO messages (conversation_id, sender_id, type, media_url, media_duration_seconds)
			VALUES ($1, $2, $3::message_type, $4, $5)
			RETURNING id, conversation_id, type::text, content, media_url, media_duration_seconds, created_at
		)
		SELECT i.id, i.conversation_id, i.type, i.content, i.media_url, i.media_duration_seconds, i.created_at,
		       u.first_name, u.last_name_initial, u.belt::text, u.stripes, u.avatar_url, u.role::text
		FROM inserted i
		JOIN users u ON u.id = $2
	`, convID, userID, string(msgType), mediaURL, durationSec).Scan(
		&m.ID, &m.ConversationID, &typeStr, &m.Content, &m.MediaURL, &m.MediaDurationSeconds, &m.CreatedAt,
		&first, &lastN, &beltStr, &stripes, &av, &role,
	)
	if err != nil {
		return nil, fmt.Errorf("insert message média : %w", err)
	}
	m.Type = models.MessageType(typeStr)
	m.Sender = &models.UserBrief{
		ID:              userID,
		FirstName:       first,
		LastNameInitial: lastN,
		Belt:            models.Belt(beltStr),
		Stripes:         stripes,
		AvatarURL:       av,
		IsCoach:         role == "coach" || role == "admin",
	}
	return &m, nil
}

// MarkRead met à jour `last_read_at` du participant à maintenant.
func (s *MessagesService) MarkRead(ctx context.Context, convID, userID uuid.UUID) error {
	if err := s.requireParticipant(ctx, convID, userID); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `
		UPDATE conversation_participants
		SET last_read_at = NOW()
		WHERE conversation_id = $1 AND user_id = $2
	`, convID, userID)
	return err
}

// --- helpers ---

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
func derefInt(i *int) int {
	if i == nil {
		return 0
	}
	return *i
}
