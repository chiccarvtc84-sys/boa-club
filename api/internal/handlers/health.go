// Package handlers contient les handlers HTTP de l'API.
package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// HealthHandler répond à GET /api/health.
type HealthHandler struct {
	db     *pgxpool.Pool
	redis  *redis.Client
	logger *slog.Logger
}

func NewHealthHandler(db *pgxpool.Pool, rdb *redis.Client, logger *slog.Logger) *HealthHandler {
	return &HealthHandler{db: db, redis: rdb, logger: logger}
}

type healthResponse struct {
	Status string `json:"status"`
	DB     string `json:"db"`
	Redis  string `json:"redis"`
}

// Check renvoie 200/ok si Postgres et Redis répondent, 503/degraded sinon.
func (h *HealthHandler) Check(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	resp := healthResponse{Status: "ok", DB: "ok", Redis: "ok"}
	code := http.StatusOK

	if err := h.db.Ping(ctx); err != nil {
		h.logger.WarnContext(ctx, "health: ping postgres KO", slog.Any("error", err))
		resp.DB = "ko"
		resp.Status = "degraded"
		code = http.StatusServiceUnavailable
	}

	if err := h.redis.Ping(ctx).Err(); err != nil {
		h.logger.WarnContext(ctx, "health: ping redis KO", slog.Any("error", err))
		resp.Redis = "ko"
		resp.Status = "degraded"
		code = http.StatusServiceUnavailable
	}

	c.JSON(code, resp)
}
