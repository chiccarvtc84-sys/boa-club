package handlers

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/boa-club/api/internal/services"
)

// CoursesHandler : GET /api/courses/week
type CoursesHandler struct {
	courses *services.CoursesService
	logger  *slog.Logger
}

func NewCoursesHandler(courses *services.CoursesService, logger *slog.Logger) *CoursesHandler {
	return &CoursesHandler{courses: courses, logger: logger}
}

// Week : GET /api/courses/week?from=YYYY-MM-DD
//
// Renvoie les cours récurrents actifs + les exceptions ponctuelles (course_instances)
// pour la semaine contenant `from`. Si `from` est omis, la semaine courante est utilisée.
func (h *CoursesHandler) Week(c *gin.Context) {
	fromStr := c.Query("from")
	var from time.Time
	if fromStr == "" {
		from = time.Now()
	} else {
		var err error
		from, err = time.Parse("2006-01-02", fromStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error":  "invalid_from",
				"detail": "le paramètre `from` doit être au format YYYY-MM-DD",
			})
			return
		}
	}

	resp, err := h.courses.GetWeek(c.Request.Context(), from)
	if err != nil {
		h.logger.ErrorContext(c.Request.Context(), "GetWeek KO", slog.Any("error", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, resp)
}
