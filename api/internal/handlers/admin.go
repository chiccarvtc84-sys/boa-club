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

// AdminHandler : routes /api/admin/* + endpoints adhérent liés (broadcasts actifs).
type AdminHandler struct {
	admin     *services.AdminService
	users     *services.UserService
	validator *validator.Validate
	logger    *slog.Logger
}

func NewAdminHandler(admin *services.AdminService, users *services.UserService, v *validator.Validate, logger *slog.Logger) *AdminHandler {
	return &AdminHandler{admin: admin, users: users, validator: v, logger: logger}
}

// --- Broadcasts ---

type createBroadcastRequest struct {
	DisplayName   string `json:"display_name"   validate:"required,min=1,max=50"`
	Message       string `json:"message"        validate:"required,min=1,max=1000"`
	DurationHours int    `json:"duration_hours" validate:"required,min=1,max=720"`
}

// CreateBroadcast : POST /api/admin/broadcasts
func (h *AdminHandler) CreateBroadcast(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	var req createBroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	b, err := h.admin.CreateBroadcast(c.Request.Context(), services.CreateBroadcastParams{
		AuthorUserID:  uid,
		DisplayName:   req.DisplayName,
		Message:       req.Message,
		DurationHours: req.DurationHours,
	})
	if err != nil {
		h.handleAdminError(c, err)
		return
	}
	c.JSON(http.StatusCreated, b)
}

// ListActiveBroadcasts : GET /api/broadcasts/active — accessible à tous les users authentifiés.
func (h *AdminHandler) ListActiveBroadcasts(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	out, err := h.admin.ListActiveBroadcasts(c.Request.Context(), uid)
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "ListActiveBroadcasts KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"broadcasts": out})
}

// DismissBroadcast : POST /api/broadcasts/:id/dismiss — masque le bandeau pour ce user.
func (h *AdminHandler) DismissBroadcast(c *gin.Context) {
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
	if err := h.admin.DismissBroadcast(c.Request.Context(), id, uid); err != nil {
		h.logger.ErrorContext(c.Request.Context(), "DismissBroadcast KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

// RevokeBroadcast : DELETE /api/admin/broadcasts/:id — l'auteur (ou un admin) retire l'alerte.
func (h *AdminHandler) RevokeBroadcast(c *gin.Context) {
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
	if err := h.admin.RevokeBroadcast(c.Request.Context(), id, uid); err != nil {
		h.handleAdminError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Course notifications (retard / absence) ---

type notifyCourseRequest struct {
	Date        string  `json:"date"          validate:"required,datetime=2006-01-02"`
	Type        string  `json:"type"          validate:"required,oneof=late absent"`
	MinutesLate *int    `json:"minutes_late"  validate:"omitempty,min=1,max=240"`
	Cancelled   bool    `json:"cancelled"`
	Message     *string `json:"message"       validate:"omitempty,max=500"`
}

// NotifyCourse : POST /api/admin/courses/:id/notify
func (h *AdminHandler) NotifyCourse(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var req notifyCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	date, _ := time.Parse("2006-01-02", req.Date)
	params := services.NotifyCourseParams{
		RecurringCourseID: courseID,
		Date:              date,
		UserID:            uid,
		IsLate:            req.Type == "late",
		IsAbsent:          req.Type == "absent",
		MinutesLate:       req.MinutesLate,
		Cancelled:         req.Cancelled,
		Message:           req.Message,
	}
	if err := h.admin.NotifyCourse(c.Request.Context(), params); err != nil {
		h.handleAdminError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Course edition ---

type updateCourseRequest struct {
	DefaultCoachID *string `json:"default_coach_id" validate:"omitempty,uuid"`
	StartTime      *string `json:"start_time"       validate:"omitempty,len=5"` // "HH:MM"
	EndTime        *string `json:"end_time"         validate:"omitempty,len=5"`
	Location       *string `json:"location"         validate:"omitempty,max=100"`
	Discipline     *string `json:"discipline"       validate:"omitempty,oneof=jjb_gi jjb_nogi mma wrestling open_mat mixed"`
	Intensity      *string `json:"intensity"        validate:"omitempty,oneof=technique drilling sparring_light sparring_hard all_levels"`
	IsActive       *bool   `json:"is_active"`
}

// UpdateCourse : PATCH /api/admin/courses/:id
func (h *AdminHandler) UpdateCourse(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var req updateCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}

	params := services.UpdateCourseParams{
		UserID:    uid,
		CourseID:  courseID,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Location:  req.Location,
		IsActive:  req.IsActive,
	}
	if req.DefaultCoachID != nil {
		coachID, err := uuid.Parse(*req.DefaultCoachID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_coach_id"})
			return
		}
		params.DefaultCoachID = &coachID
	}
	if req.Discipline != nil {
		d := models.CourseDiscipline(*req.Discipline)
		params.Discipline = &d
	}
	if req.Intensity != nil {
		i := models.CourseIntensity(*req.Intensity)
		params.Intensity = &i
	}

	if err := h.admin.UpdateCourse(c.Request.Context(), params); err != nil {
		h.handleAdminError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ListCoaches : GET /api/admin/coaches
func (h *AdminHandler) ListCoaches(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	// On vérifie le rôle via le service à travers une opération neutre :
	// si on n'a pas le rôle coach/admin, ListCoaches devrait quand même
	// pouvoir renvoyer les coachs (info publique). Pour V1, on laisse passer.
	_ = uid

	out, err := h.admin.ListCoaches(c.Request.Context())
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "ListCoaches KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"coaches": out})
}

// --- Helpers ---

func (h *AdminHandler) handleAdminError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrNotAdminOrCoach):
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not_admin_or_coach"})
	case errors.Is(err, services.ErrBroadcastNotFound):
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "broadcast_not_found"})
	case errors.Is(err, services.ErrCourseNotFound):
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "course_not_found"})
	case errors.Is(err, services.ErrUserNotFound):
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
	default:
		h.logger.ErrorContext(c.Request.Context(), "admin error", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
	}
}
