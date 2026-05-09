package middleware

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// IPRateLimiter renvoie un middleware "fixed window" basé sur Redis :
// chaque IP a droit à `limit` requêtes pendant `window`. Au-delà → HTTP 429.
//
// `prefix` permet d'avoir des compteurs distincts par route (ex: "login", "register"),
// pour qu'un excès de tentatives sur /login n'épuise pas le budget de /register.
//
// Comportement fail-open : si Redis tombe, on laisse passer (mais on log warn).
// On préfère servir un peu trop que de tomber complètement quand le cache flanche.
func IPRateLimiter(rdb *redis.Client, logger *slog.Logger, prefix string, limit int, window time.Duration) gin.HandlerFunc {
	if logger == nil {
		logger = slog.Default()
	}
	return func(c *gin.Context) {
		key := fmt.Sprintf("rl:%s:%s", prefix, c.ClientIP())
		ctx := c.Request.Context()

		n, err := rdb.Incr(ctx, key).Result()
		if err != nil {
			logger.WarnContext(ctx, "ratelimit redis KO (fail-open)",
				slog.String("prefix", prefix),
				slog.Any("error", err),
			)
			c.Next()
			return
		}

		// Premier hit dans la fenêtre : on pose le TTL.
		if n == 1 {
			if err := rdb.Expire(ctx, key, window).Err(); err != nil {
				logger.WarnContext(ctx, "ratelimit expire KO", slog.Any("error", err))
			}
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))

		if n > int64(limit) {
			ttl, ttlErr := rdb.TTL(ctx, key).Result()
			retryAfter := int(time.Until(time.Now().Add(ttl)).Seconds())
			if ttlErr != nil || errors.Is(ttlErr, redis.Nil) || retryAfter <= 0 {
				retryAfter = int(window.Seconds())
			}
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.Header("X-RateLimit-Remaining", "0")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":               "too_many_requests",
				"retry_after_seconds": retryAfter,
			})
			return
		}

		c.Header("X-RateLimit-Remaining", strconv.Itoa(limit-int(n)))
		c.Next()
	}
}
