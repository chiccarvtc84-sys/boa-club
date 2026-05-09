package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"github.com/boa-club/api/internal/middleware"
	"github.com/boa-club/api/internal/models"
	"github.com/boa-club/api/internal/services"
)

// MeHandler : GET / PATCH /api/me — profil de l'utilisateur connecté.
type MeHandler struct {
	users     *services.UserService
	validator *validator.Validate
	logger    *slog.Logger
}

func NewMeHandler(users *services.UserService, v *validator.Validate, logger *slog.Logger) *MeHandler {
	return &MeHandler{users: users, validator: v, logger: logger}
}

// Get : GET /api/me
func (h *MeHandler) Get(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}

	user, err := h.users.GetByID(c.Request.Context(), uid)
	if err != nil {
		if errors.Is(err, services.ErrUserNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "GetByID KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// updateMeRequest : tous les champs sont optionnels (pointeurs).
// Si le client n'envoie pas la clé JSON, le champ reste inchangé.
type updateMeRequest struct {
	FirstName        *string  `json:"first_name,omitempty"        validate:"omitempty,min=1,max=100"`
	LastNameInitial  *string  `json:"last_name_initial,omitempty" validate:"omitempty,min=1,max=5"`
	Bio              *string  `json:"bio,omitempty"               validate:"omitempty,max=500"`
	Belt             *string  `json:"belt,omitempty"              validate:"omitempty,oneof=white blue purple brown black"`
	Stripes          *int     `json:"stripes,omitempty"           validate:"omitempty,min=0,max=4"`
	WeightKg         *float64 `json:"weight_kg,omitempty"         validate:"omitempty,gt=0,lt=300"`
	WeightVisibility *string  `json:"weight_visibility,omitempty" validate:"omitempty,oneof=public members private"`
	Disciplines      *[]string `json:"disciplines,omitempty"      validate:"omitempty,dive,max=100"`
	AvatarURL        *string  `json:"avatar_url,omitempty"        validate:"omitempty,url,max=500"`
}

// Patch : PATCH /api/me — modifie le profil. Tous les champs sont optionnels.
func (h *MeHandler) Patch(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}

	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "invalid_json",
			"detail": err.Error(),
		})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "validation_failed",
			"detail": err.Error(),
		})
		return
	}

	params := services.UpdateProfileParams{
		FirstName:       req.FirstName,
		LastNameInitial: req.LastNameInitial,
		Bio:             req.Bio,
		Stripes:         req.Stripes,
		WeightKg:        req.WeightKg,
		Disciplines:     req.Disciplines,
		AvatarURL:       req.AvatarURL,
	}
	if req.Belt != nil {
		b := models.Belt(*req.Belt)
		params.Belt = &b
	}
	if req.WeightVisibility != nil {
		v := models.WeightVisibility(*req.WeightVisibility)
		params.WeightVisibility = &v
	}

	user, err := h.users.UpdateProfile(c.Request.Context(), uid, params)
	if err != nil {
		if errors.Is(err, services.ErrUserNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "UpdateProfile KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, user)
}

type setFCMTokenRequest struct {
	Token string `json:"token" validate:"required,min=1,max=500"`
}

// SetFCMToken : POST /api/me/fcm-token — enregistre le device pour les push.
func (h *MeHandler) SetFCMToken(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	var req setFCMTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed"})
		return
	}
	if err := h.users.SetFCMToken(c.Request.Context(), uid, req.Token); err != nil {
		h.logger.ErrorContext(c.Request.Context(), "SetFCMToken KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ClearFCMToken : DELETE /api/me/fcm-token — appelé au logout.
func (h *MeHandler) ClearFCMToken(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	if err := h.users.ClearFCMToken(c.Request.Context(), uid); err != nil {
		h.logger.ErrorContext(c.Request.Context(), "ClearFCMToken KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

type deleteAccountRequest struct {
	// Confirmation explicite : le user doit re-saisir son password actuel.
	Password string `json:"password" validate:"required,min=1"`
}

// DeleteAccount : DELETE /api/me
//
// Suppression du compte (RGPD + obligation stores Apple/Google).
// On exige le password actuel pour empêcher un attaquant qui aurait juste
// volé un access token de supprimer le compte.
func (h *MeHandler) DeleteAccount(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	var req deleteAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json"})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed"})
		return
	}

	// Vérifie le password.
	if err := h.users.VerifyPassword(c.Request.Context(), uid, req.Password); err != nil {
		if errors.Is(err, services.ErrInvalidPassword) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_password"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "VerifyPassword KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	if err := h.users.DeleteAccount(c.Request.Context(), uid); err != nil {
		h.logger.ErrorContext(c.Request.Context(), "DeleteAccount KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

// GetFollowings : GET /api/me/course-followings
func (h *MeHandler) GetFollowings(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	keys, err := h.users.GetFollowedCourseKeys(c.Request.Context(), uid)
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "GetFollowings KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"course_keys": keys})
}

type setFollowingsRequest struct {
	CourseKeys []string `json:"course_keys" validate:"required,dive,min=1,max=50"`
}

// SetFollowings : PUT /api/me/course-followings — remplace toute la liste.
func (h *MeHandler) SetFollowings(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	var req setFollowingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if err := h.validator.Struct(req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	if err := h.users.SetFollowedCourseKeys(c.Request.Context(), uid, req.CourseKeys); err != nil {
		h.logger.ErrorContext(c.Request.Context(), "SetFollowings KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"course_keys": req.CourseKeys})
}
