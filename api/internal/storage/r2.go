// Package storage : interface d'upload de fichiers vers Cloudflare R2.
//
// On utilise l'API S3-compatible de R2 via la lib minio-go, plus légère que
// l'AWS SDK officiel et largement suffisante pour notre besoin (upload simple,
// pas de fonctionnalités avancées type ACL ou lifecycle policies).
//
// Si la config R2 est incomplète (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_URL), on fournit un mock qui rejette les
// uploads avec un 503 propre. Ça permet de faire tourner l'API en dev local
// sans être obligé de configurer R2.
package storage

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// R2Config regroupe les credentials et coordonnées du bucket R2.
type R2Config struct {
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string // ex : https://abc1234.r2.cloudflarestorage.com
	Bucket          string // ex : boa-club-uploads
	PublicURL       string // ex : https://pub-xxx.r2.dev (URL publique du bucket)
}

// Uploader expose la seule opération dont on a besoin côté handlers.
type Uploader interface {
	// Upload écrit `body` (de taille `size`) dans le bucket R2 sous un nom
	// unique préfixé par `prefix`. Renvoie l'URL publique permettant de
	// consommer le fichier (ex: depuis l'app mobile via <Image source={...}>).
	Upload(ctx context.Context, prefix string, contentType string, body io.Reader, size int64) (publicURL string, err error)

	// IsConfigured vrai si on a un vrai backend R2, false en mode mock.
	IsConfigured() bool
}

type r2Uploader struct {
	client *minio.Client
	cfg    R2Config
	logger *slog.Logger
}

type mockUploader struct {
	logger *slog.Logger
}

// New retourne un Uploader. Si la config R2 est incomplète, retourne un mock
// qui rejette les uploads avec une erreur claire (utile pour le dev local).
func New(cfg R2Config, logger *slog.Logger) (Uploader, error) {
	if cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" || cfg.Endpoint == "" || cfg.Bucket == "" || cfg.PublicURL == "" {
		logger.Warn("storage : config R2 incomplète, mode mock activé (les uploads renverront 503)")
		return &mockUploader{logger: logger}, nil
	}

	// minio-go veut juste host:port (sans schéma). On déduit `secure` du
	// préfixe https:// (R2 est toujours en HTTPS, mais on prend le mode dev
	// en compte au cas où).
	host := strings.TrimPrefix(strings.TrimPrefix(cfg.Endpoint, "https://"), "http://")
	host = strings.TrimRight(host, "/")
	secure := !strings.HasPrefix(cfg.Endpoint, "http://")

	client, err := minio.New(host, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: secure,
		// R2 ignore la région mais minio-go en exige une non vide. "auto"
		// est le terme officiel R2 pour "déduit de l'account".
		Region: "auto",
	})
	if err != nil {
		return nil, fmt.Errorf("init client minio : %w", err)
	}

	logger.Info("✓ R2 configuré",
		slog.String("bucket", cfg.Bucket),
		slog.String("public_url", cfg.PublicURL),
	)
	return &r2Uploader{client: client, cfg: cfg, logger: logger}, nil
}

func (u *r2Uploader) IsConfigured() bool { return true }

func (u *r2Uploader) Upload(
	ctx context.Context,
	prefix, contentType string,
	body io.Reader,
	size int64,
) (string, error) {
	prefix = sanitizePrefix(prefix)
	ext := extensionFromMime(contentType)
	objectKey := fmt.Sprintf("%s/%s%s", prefix, uuid.NewString(), ext)

	_, err := u.client.PutObject(ctx, u.cfg.Bucket, objectKey, body, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("put object %s/%s : %w", u.cfg.Bucket, objectKey, err)
	}

	publicURL := strings.TrimRight(u.cfg.PublicURL, "/") + "/" + objectKey
	u.logger.Info("upload ok",
		slog.String("key", objectKey),
		slog.String("content_type", contentType),
		slog.Int64("size_bytes", size),
	)
	return publicURL, nil
}

func (m *mockUploader) IsConfigured() bool { return false }

func (m *mockUploader) Upload(
	ctx context.Context,
	prefix, contentType string,
	body io.Reader,
	size int64,
) (string, error) {
	m.logger.Warn("upload rejeté (R2 non configuré)",
		slog.String("prefix", prefix),
		slog.String("content_type", contentType),
		slog.Int64("size_bytes", size),
	)
	// On consomme le body pour ne pas laisser la connexion HTTP en suspens.
	_, _ = io.Copy(io.Discard, body)
	return "", fmt.Errorf("R2 non configuré sur ce serveur")
}

// sanitizePrefix nettoie le préfixe : pas de "..", pas de slash terminal/initial.
func sanitizePrefix(prefix string) string {
	prefix = strings.ReplaceAll(prefix, "..", "")
	prefix = strings.Trim(prefix, "/")
	if prefix == "" {
		return "uploads"
	}
	return prefix
}

// extensionFromMime renvoie l'extension de fichier correspondant au MIME type.
// On en a besoin pour que le browser/app affiche correctement le type de
// média à la réception (sans dépendre uniquement du Content-Type HTTP).
func extensionFromMime(mime string) string {
	switch mime {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "audio/mp4", "audio/aac", "audio/x-m4a":
		return ".m4a"
	case "audio/mpeg":
		return ".mp3"
	case "audio/wav", "audio/x-wav":
		return ".wav"
	case "video/mp4":
		return ".mp4"
	default:
		return ""
	}
}
