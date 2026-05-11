// Endpoints REST du système d'amis.
//
//   GET    /api/friends                       → liste de mes amis
//   POST   /api/friends                       → ajout (body: {friend_id})
//   DELETE /api/friends/:id                   → retrait d'un ami
//   PATCH  /api/friends/:id/notifications     → toggle notifs (body: {enabled})
//
// Toutes les routes nécessitent l'authentification.
package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/boa-club/api/internal/middleware"
	"github.com/boa-club/api/internal/services"
)

type FriendsHandler struct {
	friends   *services.FriendsService
	validator *validator.Validate
	logger    *slog.Logger
}

func NewFriendsHandler(friends *services.FriendsService, v *validator.Validate, logger *slog.Logger) *FriendsHandler {
	return &FriendsHandler{friends: friends, validator: v, logger: logger}
}

// List : GET /api/friends
func (h *FriendsHandler) List(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	rows, err := h.friends.ListFriends(c.Request.Context(), uid)
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "ListFriends KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"friends": rows})
}

type addFriendRequest struct {
	FriendID string `json:"friend_id" validate:"required,uuid"`
}

// Add : POST /api/friends
func (h *FriendsHandler) Add(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	var req addFriendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	friendID, _ := uuid.Parse(req.FriendID)

	if err := h.friends.AddFriend(c.Request.Context(), uid, friendID); err != nil {
		switch {
		case errors.Is(err, services.ErrSelfFriend):
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "self_friend"})
		case errors.Is(err, services.ErrUserNotFound):
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		case errors.Is(err, services.ErrAlreadyFriend):
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "already_friend"})
		default:
			h.logger.ErrorContext(c.Request.Context(), "AddFriend KO", slog.Any("error", err))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}

// Remove : DELETE /api/friends/:id
func (h *FriendsHandler) Remove(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	friendID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	if err := h.friends.RemoveFriend(c.Request.Context(), uid, friendID); err != nil {
		if errors.Is(err, services.ErrFriendNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "friend_not_found"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "RemoveFriend KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

type setFriendNotifsRequest struct {
	Enabled *bool `json:"enabled" validate:"required"`
}

// SetNotifications : PATCH /api/friends/:id/notifications
func (h *FriendsHandler) SetNotifications(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	friendID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var req setFriendNotifsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json"})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed"})
		return
	}

	if err := h.friends.SetNotifications(c.Request.Context(), uid, friendID, *req.Enabled); err != nil {
		if errors.Is(err, services.ErrFriendNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "friend_not_found"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "SetFriendNotifs KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}
