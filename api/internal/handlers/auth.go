package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"github.com/boa-club/api/internal/models"
	"github.com/boa-club/api/internal/services"
)

// AuthHandler expose les endpoints /api/auth/*.
type AuthHandler struct {
	svc       *services.AuthService
	validator *validator.Validate
	logger    *slog.Logger
}

func NewAuthHandler(svc *services.AuthService, v *validator.Validate, logger *slog.Logger) *AuthHandler {
	return &AuthHandler{svc: svc, validator: v, logger: logger}
}

// --- Requests ---

type registerRequest struct {
	Email           string `json:"email"             validate:"required,email,max=255"`
	Password        string `json:"password"          validate:"required,min=8,max=72"` // 72 = limite bcrypt
	FirstName       string `json:"first_name"        validate:"required,min=1,max=100"`
	LastNameInitial string `json:"last_name_initial" validate:"required,min=1,max=5"`
}

type loginRequest struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// --- Response ---

type authResponse struct {
	User   *models.User         `json:"user"`
	Tokens *services.AuthTokens `json:"tokens"`
}

// --- Endpoints ---

// Register : POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if !h.bind(c, &req) {
		return
	}

	user, tokens, err := h.svc.Register(c.Request.Context(), services.RegisterParams{
		Email:           req.Email,
		Password:        req.Password,
		FirstName:       req.FirstName,
		LastNameInitial: req.LastNameInitial,
		IP:              c.ClientIP(),
		UserAgent:       c.Request.UserAgent(),
	})
	if err != nil {
		h.handleAuthError(c, err)
		return
	}
	c.JSON(http.StatusCreated, authResponse{User: user, Tokens: tokens})
}

// Login : POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if !h.bind(c, &req) {
		return
	}

	user, tokens, err := h.svc.Login(c.Request.Context(), services.LoginParams{
		Email:     req.Email,
		Password:  req.Password,
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})
	if err != nil {
		h.handleAuthError(c, err)
		return
	}
	c.JSON(http.StatusOK, authResponse{User: user, Tokens: tokens})
}

// Refresh : POST /api/auth/refresh
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshRequest
	if !h.bind(c, &req) {
		return
	}

	tokens, err := h.svc.Refresh(c.Request.Context(), services.RefreshParams{
		RefreshToken: req.RefreshToken,
		IP:           c.ClientIP(),
		UserAgent:    c.Request.UserAgent(),
	})
	if err != nil {
		h.handleAuthError(c, err)
		return
	}
	c.JSON(http.StatusOK, tokens)
}

// --- Forgot / reset password ---

type forgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// ForgotPassword : POST /api/auth/forgot-password
// Renvoie toujours 204 (anti-énumération) : on ne dit pas si l'email existe ou non.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req forgotPasswordRequest
	if !h.bind(c, &req) {
		return
	}
	// Synchrone : l'opération (DB + envoi email) prend ~200-500ms, c'est acceptable.
	// L'API renvoie toujours 204, succès ou échec, pour éviter l'énumération d'emails.
	h.svc.RequestPasswordReset(c.Request.Context(), req.Email)
	c.Status(http.StatusNoContent)
}

type resetPasswordRequest struct {
	Code     string `json:"code"     validate:"required,min=4,max=30"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

// ResetPassword : POST /api/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req resetPasswordRequest
	if !h.bind(c, &req) {
		return
	}
	if err := h.svc.ResetPassword(c.Request.Context(), req.Code, req.Password); err != nil {
		if errors.Is(err, services.ErrInvalidResetToken) {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_reset_token"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "ResetPassword KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Logout : POST /api/auth/logout — idempotent.
func (h *AuthHandler) Logout(c *gin.Context) {
	var req logoutRequest
	if !h.bind(c, &req) {
		return
	}

	if err := h.svc.Logout(c.Request.Context(), req.RefreshToken); err != nil {
		h.logger.ErrorContext(c.Request.Context(), "logout KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Helpers ---

// bind décode le JSON, valide la struct, et écrit la réponse d'erreur le cas échéant.
// Renvoie true si la validation a réussi.
func (h *AuthHandler) bind(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "invalid_json",
			"detail": err.Error(),
		})
		return false
	}
	if err := h.validator.Struct(dst); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error":  "validation_failed",
			"detail": err.Error(),
		})
		return false
	}
	return true
}

// handleAuthError mappe les erreurs métier de services.AuthService → codes HTTP.
func (h *AuthHandler) handleAuthError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrEmailAlreadyTaken):
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "email_already_taken"})
	case errors.Is(err, services.ErrInvalidCredentials):
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_credentials"})
	case errors.Is(err, services.ErrUserNotActive):
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "account_not_active"})
	case errors.Is(err, services.ErrInvalidRefreshToken):
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_refresh_token"})
	default:
		// Erreur interne : on log le détail mais on n'expose pas au client.
		h.logger.ErrorContext(c.Request.Context(), "auth error", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
	}
}
