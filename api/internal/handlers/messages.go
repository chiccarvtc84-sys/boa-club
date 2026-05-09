package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/boa-club/api/internal/middleware"
	"github.com/boa-club/api/internal/services"
)

// MessagesHandler : routes /api/conversations/* + /api/free-slots/:id/messages.
type MessagesHandler struct {
	messages  *services.MessagesService
	slots     *services.SlotsService
	validator *validator.Validate
	logger    *slog.Logger
}

func NewMessagesHandler(
	messages *services.MessagesService,
	slots *services.SlotsService,
	v *validator.Validate,
	logger *slog.Logger,
) *MessagesHandler {
	return &MessagesHandler{messages: messages, slots: slots, validator: v, logger: logger}
}

// ListDMs : GET /api/conversations
func (h *MessagesHandler) ListDMs(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	out, err := h.messages.ListDMs(c.Request.Context(), uid)
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "ListDMs KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversations": out})
}

type openDMRequest struct {
	UserID string `json:"user_id" validate:"required,uuid"`
}

// OpenDM : POST /api/conversations/dm — trouve ou crée un DM avec le user fourni.
func (h *MessagesHandler) OpenDM(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	var req openDMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	otherID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_user_id"})
		return
	}
	convID, err := h.messages.OpenDM(c.Request.Context(), uid, otherID)
	if err != nil {
		if errors.Is(err, services.ErrCannotDMSelf) {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "cannot_dm_self"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "OpenDM KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversation_id": convID})
}

// ListMessages : GET /api/conversations/:id/messages?before=...&limit=...
func (h *MessagesHandler) ListMessages(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	convID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var before *time.Time
	if v := c.Query("before"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_before"})
			return
		}
		before = &t
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	out, err := h.messages.ListMessages(c.Request.Context(), convID, uid, before, limit)
	if err != nil {
		if errors.Is(err, services.ErrNotParticipant) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not_participant"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "ListMessages KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"messages": out})
}

type sendMessageRequest struct {
	Content string `json:"content" validate:"required,min=1,max=5000"`
}

// SendMessage : POST /api/conversations/:id/messages
func (h *MessagesHandler) SendMessage(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	convID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var req sendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	m, err := h.messages.SendText(c.Request.Context(), convID, uid, req.Content)
	if err != nil {
		if errors.Is(err, services.ErrNotParticipant) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not_participant"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "SendText KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusCreated, m)
}

// MarkRead : POST /api/conversations/:id/read
func (h *MessagesHandler) MarkRead(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	convID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	if err := h.messages.MarkRead(c.Request.Context(), convID, uid); err != nil {
		if errors.Is(err, services.ErrNotParticipant) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not_participant"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "MarkRead KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

// SlotThread : GET /api/free-slots/:id/thread → renvoie l'ID de la conversation
// associée. La crée à la demande, et inscrit le user comme participant si c'est
// un participant du créneau.
func (h *MessagesHandler) SlotThread(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	slotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	// Vérifie d'abord que le slot existe et que le user en est bien participant.
	d, err := h.slots.GetByID(c.Request.Context(), slotID)
	if err != nil {
		if errors.Is(err, services.ErrSlotNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "slot_not_found"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "SlotThread GetByID KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	isParticipant := false
	for _, p := range d.Participants {
		if p.ID == uid {
			isParticipant = true
			break
		}
	}
	if !isParticipant {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not_slot_participant"})
		return
	}

	convID, err := h.messages.EnsureSlotThread(c.Request.Context(), slotID, uid)
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "EnsureSlotThread KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversation_id": convID, "slot_id": slotID})
}
