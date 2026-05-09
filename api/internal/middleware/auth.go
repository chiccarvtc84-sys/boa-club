package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/boa-club/api/internal/auth"
)

// Clés de stockage dans le contexte Gin (c.Set / c.Get).
const (
	ctxUserIDKey   = "auth.user_id"
	ctxUserRoleKey = "auth.user_role"
)

// AuthRequired vérifie le header Authorization Bearer, valide le JWT
// et injecte user_id + role dans le contexte Gin.
func AuthRequired(jwtMgr *auth.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_authorization_header"})
			return
		}
		const prefix = "Bearer "
		if !strings.HasPrefix(header, prefix) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_authorization_scheme"})
			return
		}
		tokenStr := strings.TrimSpace(strings.TrimPrefix(header, prefix))
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing_bearer_token"})
			return
		}

		claims, err := jwtMgr.ParseAccess(tokenStr)
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrExpiredToken):
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token_expired"})
			default:
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
			}
			return
		}

		c.Set(ctxUserIDKey, claims.UserID)
		c.Set(ctxUserRoleKey, claims.Role)
		c.Next()
	}
}

// UserIDFromContext renvoie l'UUID stocké par AuthRequired, ou (uuid.Nil, false).
func UserIDFromContext(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get(ctxUserIDKey)
	if !ok {
		return uuid.Nil, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

// UserRoleFromContext renvoie le rôle (member|coach|admin), ou ("", false).
func UserRoleFromContext(c *gin.Context) (string, bool) {
	v, ok := c.Get(ctxUserRoleKey)
	if !ok {
		return "", false
	}
	role, ok := v.(string)
	return role, ok
}
