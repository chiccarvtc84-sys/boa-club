// Package middleware regroupe les middlewares HTTP communs (logs, CORS, auth…).
package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger renvoie un middleware Gin qui log chaque requête via slog.
// Le niveau de log dépend du status : 5xx -> error, 4xx -> warn, sinon info.
func Logger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		if c.Request.URL.RawQuery != "" {
			path = path + "?" + c.Request.URL.RawQuery
		}

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		attrs := []slog.Attr{
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("latency", latency),
			slog.String("ip", c.ClientIP()),
		}
		if len(c.Errors) > 0 {
			attrs = append(attrs, slog.String("errors", c.Errors.String()))
		}

		level := slog.LevelInfo
		switch {
		case status >= 500:
			level = slog.LevelError
		case status >= 400:
			level = slog.LevelWarn
		}

		logger.LogAttrs(c.Request.Context(), level, "request", attrs...)
	}
}

// Recovery rattrape les paniques, log via slog et renvoie un 500 propre.
func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, err any) {
		logger.ErrorContext(c.Request.Context(), "panique récupérée",
			slog.Any("error", err),
			slog.String("path", c.Request.URL.Path),
		)
		c.AbortWithStatusJSON(500, gin.H{"error": "internal server error"})
	})
}
