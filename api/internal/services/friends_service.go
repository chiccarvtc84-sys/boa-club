// Package services — gestion du système d'amis.
//
// Modèle simplifié sans pending/accept (cf. migration 013) : A ajoute B,
// la relation est immédiate. Pour retirer, A delete la ligne. Chaque
// utilisateur peut activer/désactiver les notifs pour chaque ami via un
// toggle stocké sur la ligne friendships.
package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrAlreadyFriend = errors.New("déjà dans ta liste d'amis")
	ErrSelfFriend    = errors.New("impossible de s'ajouter soi-même en ami")
	ErrFriendNotFound = errors.New("cet ami n'est pas dans ta liste")
)

// FriendRow : ligne renvoyée par ListFriends. Inclut les infos pour l'UI
// + le statut "online" approximatif (dernière connexion < 5 min).
type FriendRow struct {
	ID                   uuid.UUID  `json:"id"`
	FirstName            string     `json:"first_name"`
	LastNameInitial      string     `json:"last_name_initial"`
	AvatarURL            *string    `json:"avatar_url,omitempty"`
	Belt                 string     `json:"belt"`
	Stripes              int        `json:"stripes"`
	Role                 string     `json:"role"`
	NotificationsEnabled bool       `json:"notifications_enabled"`
	FriendsSince         time.Time  `json:"friends_since"`
	LastLoginAt          *time.Time `json:"last_login_at,omitempty"`
}

type FriendsService struct {
	db *pgxpool.Pool
}

func NewFriendsService(db *pgxpool.Pool) *FriendsService {
	return &FriendsService{db: db}
}

// ListFriends renvoie les amis de userID, triés par prénom.
func (s *FriendsService) ListFriends(
	ctx context.Context,
	userID uuid.UUID,
) ([]FriendRow, error) {
	rows, err := s.db.Query(ctx, `
		SELECT u.id, u.first_name, u.last_name_initial, u.avatar_url,
		       u.belt::text, u.stripes, u.role::text,
		       f.notifications_enabled, f.created_at, u.last_login_at
		FROM friendships f
		JOIN users u ON u.id = f.friend_id
		WHERE f.user_id = $1
		  AND u.deleted_at IS NULL
		  AND u.status = 'active'
		ORDER BY u.first_name, u.last_name_initial
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list friends : %w", err)
	}
	defer rows.Close()

	out := []FriendRow{}
	for rows.Next() {
		var r FriendRow
		if err := rows.Scan(
			&r.ID, &r.FirstName, &r.LastNameInitial, &r.AvatarURL,
			&r.Belt, &r.Stripes, &r.Role,
			&r.NotificationsEnabled, &r.FriendsSince, &r.LastLoginAt,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// AddFriend ajoute friendID dans la liste des amis de userID.
// Si la ligne existe déjà → ErrAlreadyFriend.
// Le CHECK SQL empêche déjà l'auto-amitié, mais on double-check pour un
// message plus parlant.
func (s *FriendsService) AddFriend(
	ctx context.Context,
	userID, friendID uuid.UUID,
) error {
	if userID == friendID {
		return ErrSelfFriend
	}
	// Vérifie que l'ami cible existe et est actif.
	var exists bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL AND status = 'active')`,
		friendID,
	).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrUserNotFound
	}

	// INSERT idempotent : si déjà présent, on remonte ErrAlreadyFriend.
	res, err := s.db.Exec(ctx, `
		INSERT INTO friendships (user_id, friend_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, userID, friendID)
	if err != nil {
		return fmt.Errorf("insert friendship : %w", err)
	}
	if res.RowsAffected() == 0 {
		return ErrAlreadyFriend
	}
	return nil
}

// RemoveFriend supprime la ligne d'amitié userID → friendID.
func (s *FriendsService) RemoveFriend(
	ctx context.Context,
	userID, friendID uuid.UUID,
) error {
	res, err := s.db.Exec(ctx,
		`DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2`,
		userID, friendID,
	)
	if err != nil {
		return fmt.Errorf("delete friendship : %w", err)
	}
	if res.RowsAffected() == 0 {
		return ErrFriendNotFound
	}
	return nil
}

// SetNotifications bascule le toggle de notifs pour un ami donné.
func (s *FriendsService) SetNotifications(
	ctx context.Context,
	userID, friendID uuid.UUID,
	enabled bool,
) error {
	res, err := s.db.Exec(ctx, `
		UPDATE friendships
		SET notifications_enabled = $3
		WHERE user_id = $1 AND friend_id = $2
	`, userID, friendID, enabled)
	if err != nil {
		return fmt.Errorf("update friendship notif : %w", err)
	}
	if res.RowsAffected() == 0 {
		return ErrFriendNotFound
	}
	return nil
}

// IsFriend retourne true si userID a déjà ajouté friendID.
// Pratique pour l'UI de la fiche membre (afficher "Ajouter" ou "Retirer").
func (s *FriendsService) IsFriend(
	ctx context.Context,
	userID, friendID uuid.UUID,
) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2)`,
		userID, friendID,
	).Scan(&exists)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return false, err
	}
	return exists, nil
}
