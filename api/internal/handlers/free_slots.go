package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/boa-club/api/internal/middleware"
	"github.com/boa-club/api/internal/models"
	"github.com/boa-club/api/internal/services"
)

// FreeSlotsHandler : routes /api/free-slots/*
type FreeSlotsHandler struct {
	slots     *services.SlotsService
	validator *validator.Validate
	logger    *slog.Logger
}

func NewFreeSlotsHandler(slots *services.SlotsService, v *validator.Validate, logger *slog.Logger) *FreeSlotsHandler {
	return &FreeSlotsHandler{slots: slots, validator: v, logger: logger}
}

// List : GET /api/free-slots — créneaux à venir, ordonnés par date.
func (h *FreeSlotsHandler) List(c *gin.Context) {
	out, err := h.slots.ListUpcoming(c.Request.Context())
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "ListUpcoming KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"slots": out})
}

// Get : GET /api/free-slots/:id
func (h *FreeSlotsHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	d, err := h.slots.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, services.ErrSlotNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "slot_not_found"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "GetByID KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, d)
}

type createSlotRequest struct {
	Title          string    `json:"title"           validate:"required,min=1,max=150"`
	Description    *string   `json:"description"     validate:"omitempty,max=1000"`
	ScheduledStart time.Time `json:"scheduled_start" validate:"required"`
	ScheduledEnd   time.Time `json:"scheduled_end"   validate:"required"`
	Discipline     string    `json:"discipline"      validate:"required,oneof=jjb_gi jjb_nogi mma wrestling open_mat mixed"`
	Intensity      *string   `json:"intensity"       validate:"omitempty,oneof=technique drilling sparring_light sparring_hard all_levels"`
	Location       *string   `json:"location"        validate:"omitempty,max=100"`
}

// Create : POST /api/free-slots
func (h *FreeSlotsHandler) Create(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}

	var req createSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}

	params := services.CreateSlotParams{
		CreatorID:      uid,
		Title:          req.Title,
		Description:    req.Description,
		ScheduledStart: req.ScheduledStart,
		ScheduledEnd:   req.ScheduledEnd,
		Discipline:     models.CourseDiscipline(req.Discipline),
		Location:       req.Location,
	}
	if req.Intensity != nil {
		ci := models.CourseIntensity(*req.Intensity)
		params.Intensity = &ci
	}

	d, err := h.slots.Create(c.Request.Context(), params)
	if err != nil {
		if errors.Is(err, services.ErrSlotInvalidTime) {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_time"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "Create KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusCreated, d)
}

// Join : POST /api/free-slots/:id/join
func (h *FreeSlotsHandler) Join(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	if err := h.slots.Join(c.Request.Context(), id, uid); err != nil {
		switch {
		case errors.Is(err, services.ErrSlotNotFound):
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "slot_not_found"})
		case errors.Is(err, services.ErrSlotCancelled):
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "slot_cancelled"})
		case errors.Is(err, services.ErrAlreadyJoined):
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "already_joined"})
		default:
			h.logger.ErrorContext(c.Request.Context(), "Join KO", slog.Any("error", err))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}

// Leave : DELETE /api/free-slots/:id/join
func (h *FreeSlotsHandler) Leave(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	if err := h.slots.Leave(c.Request.Context(), id, uid); err != nil {
		if errors.Is(err, services.ErrNotJoined) {
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "not_joined"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "Leave KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

type cancelSlotRequest struct {
	Reason string `json:"reason" validate:"omitempty,max=500"`
}

// Cancel : DELETE /api/free-slots/:id (annulation par le créateur)
func (h *FreeSlotsHandler) Cancel(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	// Reason peut être absent (DELETE sans body) ou présent (DELETE avec body JSON).
	var req cancelSlotRequest
	_ = c.ShouldBindJSON(&req) // best-effort, le body est optionnel.

	if err := h.slots.Cancel(c.Request.Context(), id, uid, req.Reason); err != nil {
		switch {
		case errors.Is(err, services.ErrSlotNotFound):
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "slot_not_found"})
		case errors.Is(err, services.ErrNotSlotCreator):
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not_slot_creator"})
		default:
			h.logger.ErrorContext(c.Request.Context(), "Cancel KO", slog.Any("error", err))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}
