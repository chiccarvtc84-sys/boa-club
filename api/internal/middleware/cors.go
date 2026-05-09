package middleware

import "github.com/gin-gonic/gin"

// CORS renvoie un middleware Gin avec :
//   - en dev : tous les origins acceptés (*),
//   - en prod : liste blanche stricte fournie par allowedOrigins.
func CORS(allowedOrigins []string, isDev bool) gin.HandlerFunc {
	allowSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowSet[o] = struct{}{}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		switch {
		case isDev:
			c.Header("Access-Control-Allow-Origin", "*")
		case origin != "":
			if _, ok := allowSet[origin]; ok {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Header("Access-Control-Expose-Headers", "Content-Length")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
