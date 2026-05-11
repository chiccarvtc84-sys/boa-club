// Endpoints publics liés aux autres membres : recherche + fiche publique.
//
//   GET /api/users/search?q=...        → liste paginée de matchs
//   GET /api/users/:id                 → fiche détaillée (sanitizée)
//
// L'authentification est requise (uniquement entre membres connectés).
package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/boa-club/api/internal/middleware"
	"github.com/boa-club/api/internal/services"
)

type UsersHandler struct {
	users  *services.UserService
	logger *slog.Logger
}

func NewUsersHandler(users *services.UserService, logger *slog.Logger) *UsersHandler {
	return &UsersHandler{users: users, logger: logger}
}

// SearchUsers : GET /api/users/search?q=...&limit=N
func (h *UsersHandler) SearchUsers(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	q := c.Query("q")
	limit := 30
	if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 && v <= 100 {
		limit = v
	}

	results, err := h.users.SearchUsers(c.Request.Context(), uid, q, limit)
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "SearchUsers KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": results})
}

// GetPublicProfile : GET /api/users/:id
func (h *UsersHandler) GetPublicProfile(c *gin.Context) {
	uid, ok := middleware.UserIDFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_auth_context"})
		return
	}
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	profile, err := h.users.GetPublicProfile(c.Request.Context(), uid, targetID)
	if err != nil {
		if errors.Is(err, services.ErrUserNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
			return
		}
		h.logger.ErrorContext(c.Request.Context(), "GetPublicProfile KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, profile)
}
