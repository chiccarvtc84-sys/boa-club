// Package config charge la configuration applicative depuis les variables
// d'environnement (avec un .env optionnel pour le dev local).
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Env string

const (
	EnvDevelopment Env = "development"
	EnvStaging     Env = "staging"
	EnvProduction  Env = "production"
)

// Config regroupe tous les paramètres applicatifs.
type Config struct {
	Port     string
	Env      Env
	LogLevel slog.Level

	DatabaseURL string
	RedisURL    string

	JWTSecret     string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration

	BcryptCost int

	EmailProvider string
	EmailAPIKey   string
	EmailFrom     string

	// FCM — chemin vers le fichier de credentials Firebase Admin (vide = mode log).
	FCMCredentialsFile string

	// CORS — liste blanche en prod (vide = tout refusé hors dev).
	AllowedOrigins []string
}

// Load lit le .env si présent, valide les variables requises, et renvoie une Config prête à l'emploi.
func Load() (*Config, error) {
	// .env optionnel : pas d'erreur s'il est absent (cas Hetzner/CI).
	_ = godotenv.Load()

	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		Env:            Env(getEnv("ENV", "development")),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		RedisURL:       os.Getenv("REDIS_URL"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		EmailProvider:  os.Getenv("EMAIL_PROVIDER"),
		EmailAPIKey:    os.Getenv("EMAIL_API_KEY"),
		EmailFrom:          getEnv("EMAIL_FROM", "noreply@boaclub.fr"),
		FCMCredentialsFile: os.Getenv("FCM_CREDENTIALS_FILE"),
		AllowedOrigins:     parseList(os.Getenv("ALLOWED_ORIGINS")),
	}

	cfg.LogLevel = parseLogLevel(getEnv("LOG_LEVEL", "info"))

	accessTTL, err := time.ParseDuration(getEnv("JWT_ACCESS_TTL", "15m"))
	if err != nil {
		return nil, fmt.Errorf("JWT_ACCESS_TTL invalide: %w", err)
	}
	cfg.JWTAccessTTL = accessTTL

	refreshTTL, err := time.ParseDuration(getEnv("JWT_REFRESH_TTL", "720h"))
	if err != nil {
		return nil, fmt.Errorf("JWT_REFRESH_TTL invalide: %w", err)
	}
	cfg.JWTRefreshTTL = refreshTTL

	cost, err := strconv.Atoi(getEnv("BCRYPT_COST", "12"))
	if err != nil {
		return nil, fmt.Errorf("BCRYPT_COST invalide: %w", err)
	}
	cfg.BcryptCost = cost

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL manquant")
	}
	if c.RedisURL == "" {
		return fmt.Errorf("REDIS_URL manquant")
	}
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET manquant")
	}
	if c.IsProd() && strings.HasPrefix(c.JWTSecret, "change_me") {
		return fmt.Errorf("JWT_SECRET doit être changé en production")
	}
	if c.BcryptCost < 10 || c.BcryptCost > 14 {
		return fmt.Errorf("BCRYPT_COST doit être entre 10 et 14 (recommandé : 12)")
	}
	switch c.Env {
	case EnvDevelopment, EnvStaging, EnvProduction:
	default:
		return fmt.Errorf("ENV invalide : %s (attendu: development|staging|production)", c.Env)
	}
	return nil
}

// IsDev renvoie true si on tourne en environnement de dev.
func (c *Config) IsDev() bool { return c.Env == EnvDevelopment }

// IsProd renvoie true si on tourne en production.
func (c *Config) IsProd() bool { return c.Env == EnvProduction }

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseLogLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func parseList(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}
