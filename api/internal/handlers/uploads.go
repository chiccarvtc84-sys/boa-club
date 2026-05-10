// Endpoint POST /api/uploads — upload de fichier multipart vers R2.
package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/boa-club/api/internal/middleware"
	"github.com/boa-club/api/internal/storage"
)

const (
	// 10 Mo : largement assez pour une photo de profil ou un message photo
	// (les notes vocales font typiquement < 1 Mo).
	maxUploadSize = 10 * 1024 * 1024

	multipartFieldFile   = "file"
	multipartFieldPrefix = "prefix" // optionnel : "avatars", "messages", etc.
)

// allowedMimes liste les types acceptés. On n'accepte QUE des images et de
// l'audio — pas de vidéo (trop lourd, pas dans le périmètre MVP), pas de
// fichiers exécutables (sécurité).
var allowedMimes = map[string]bool{
	"image/jpeg":   true,
	"image/jpg":    true,
	"image/png":    true,
	"image/webp":   true,
	"image/gif":    true,
	"audio/mp4":    true,
	"audio/aac":    true,
	"audio/x-m4a":  true,
	"audio/mpeg":   true,
	"audio/wav":    true,
	"audio/x-wav":  true,
}

// UploadsHandler porte la logique du POST /api/uploads.
type UploadsHandler struct {
	uploader storage.Uploader
	logger   *slog.Logger
}

func NewUploadsHandler(uploader storage.Uploader, logger *slog.Logger) *UploadsHandler {
	return &UploadsHandler{uploader: uploader, logger: logger}
}

// uploadResponse — ce qu'on renvoie au client.
type uploadResponse struct {
	URL string `json:"url"`
}

// Upload reçoit un fichier en multipart/form-data, l'envoie sur R2, et
// renvoie l'URL publique au client. Le client peut ensuite stocker cette URL
// dans avatar_url ou media_url.
//
// Le client doit envoyer :
//   - Header "Authorization: Bearer <access_token>"
//   - multipart/form-data avec un champ "file" (binaire)
//   - optionnellement, un champ "prefix" (ex: "avatars", "messages") qui
//     déterminera le sous-dossier R2 où ranger le fichier.
func (h *UploadsHandler) Upload(c *gin.Context) {
	if !h.uploader.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":  "storage_unavailable",
			"detail": "Le stockage de fichiers n'est pas configuré sur ce serveur.",
		})
		return
	}

	userID, _ := middleware.UserIDFromContext(c)

	// Limite la taille de la requête côté Gin pour éviter qu'un client
	// malveillant ne fasse exploser la RAM avec un body énorme.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize+512*1024)

	if err := c.Request.ParseMultipartForm(maxUploadSize + 512*1024); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "invalid_multipart",
			"detail": "Le fichier ne doit pas dépasser 10 Mo, ou la requête n'est pas un multipart valide.",
		})
		return
	}

	file, header, err := c.Request.FormFile(multipartFieldFile)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "missing_file",
			"detail": fmt.Sprintf("Champ multipart '%s' manquant.", multipartFieldFile),
		})
		return
	}
	defer file.Close()

	if header.Size > maxUploadSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error":  "file_too_large",
			"detail": "Le fichier ne doit pas dépasser 10 Mo.",
		})
		return
	}

	contentType := header.Header.Get("Content-Type")
	if !allowedMimes[contentType] {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{
			"error":  "mime_not_allowed",
			"detail": fmt.Sprintf("Type %s non autorisé. Acceptés : images JPEG/PNG/WebP/GIF, audio AAC/MP3/WAV.", contentType),
		})
		return
	}

	prefix := strings.TrimSpace(c.Request.FormValue(multipartFieldPrefix))
	if prefix == "" {
		prefix = "uploads"
	}

	publicURL, err := h.uploader.Upload(c.Request.Context(), prefix, contentType, file, header.Size)
	if err != nil {
		h.logger.Error("upload échoué",
			slog.Any("error", err),
			slog.String("user_id", userID.String()),
			slog.String("prefix", prefix),
			slog.String("content_type", contentType),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "upload_failed",
		})
		return
	}

	c.JSON(http.StatusOK, uploadResponse{URL: publicURL})
}
