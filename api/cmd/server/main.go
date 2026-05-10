// Commande server : point d'entrée HTTP de l'API Boa Club.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"github.com/boa-club/api/internal/auth"
	"github.com/boa-club/api/internal/config"
	"github.com/boa-club/api/internal/database"
	"github.com/boa-club/api/internal/email"
	"github.com/boa-club/api/internal/handlers"
	"github.com/boa-club/api/internal/middleware"
	"github.com/boa-club/api/internal/push"
	"github.com/boa-club/api/internal/services"
	"github.com/boa-club/api/internal/storage"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "✗ fatal : %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	// 1. Config
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("chargement config : %w", err)
	}

	// 2. Logger global
	logger := newLogger(cfg)
	slog.SetDefault(logger)
	logger.Info("démarrage Boa Club API",
		slog.String("env", string(cfg.Env)),
		slog.String("port", cfg.Port),
	)

	// 3. Connexions externes
	ctx := context.Background()

	db, err := database.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("postgres : %w", err)
	}
	defer db.Close()
	logger.Info("✓ postgres connecté")

	rdb, err := database.NewRedis(ctx, cfg.RedisURL)
	if err != nil {
		return fmt.Errorf("redis : %w", err)
	}
	defer func() { _ = rdb.Close() }()
	logger.Info("✓ redis connecté")

	// 4. Mode Gin selon l'environnement
	if cfg.IsProd() {
		gin.SetMode(gin.ReleaseMode)
	}

	// 5. Routeur + middlewares
	router := gin.New()
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.CORS(cfg.AllowedOrigins, cfg.IsDev()))

	// 6. Services métier
	jwtMgr := auth.NewManager(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	mailer := email.New(cfg.EmailProvider, cfg.EmailAPIKey, cfg.EmailFrom, logger)
	pushSender := push.New(cfg.FCMCredentialsFile, logger)
	uploader, err := storage.New(storage.R2Config{
		AccessKeyID:     cfg.R2.AccessKeyID,
		SecretAccessKey: cfg.R2.SecretAccessKey,
		Endpoint:        cfg.R2.Endpoint,
		Bucket:          cfg.R2.Bucket,
		PublicURL:       cfg.R2.PublicURL,
	}, logger)
	if err != nil {
		return fmt.Errorf("storage : %w", err)
	}
	authSvc := services.NewAuthService(db, jwtMgr, cfg.BcryptCost, mailer, logger)
	userSvc := services.NewUserService(db)
	coursesSvc := services.NewCoursesService(db)
	slotsSvc := services.NewSlotsService(db)
	messagesSvc := services.NewMessagesService(db)
	adminSvc := services.NewAdminService(db, pushSender, logger)
	v := validator.New(validator.WithRequiredStructEnabled())

	// 7. Handlers
	healthH := handlers.NewHealthHandler(db, rdb, logger)
	authH := handlers.NewAuthHandler(authSvc, v, logger)
	meH := handlers.NewMeHandler(userSvc, v, logger)
	coursesH := handlers.NewCoursesHandler(coursesSvc, logger)
	slotsH := handlers.NewFreeSlotsHandler(slotsSvc, v, logger)
	messagesH := handlers.NewMessagesHandler(messagesSvc, slotsSvc, v, logger)
	adminH := handlers.NewAdminHandler(adminSvc, userSvc, v, logger)
	uploadsH := handlers.NewUploadsHandler(uploader, logger)

	// 8. Routes
	api := router.Group("/api")
	api.GET("/health", healthH.Check)

	// Rate-limit anti-bruteforce sur les endpoints publics sensibles.
	loginRL := middleware.IPRateLimiter(rdb, logger, "login", 10, 15*time.Minute)
	registerRL := middleware.IPRateLimiter(rdb, logger, "register", 5, 15*time.Minute)

	authGroup := api.Group("/auth")
	{
		authGroup.POST("/register", registerRL, authH.Register)
		authGroup.POST("/login", loginRL, authH.Login)
		authGroup.POST("/refresh", authH.Refresh)
		authGroup.POST("/logout", authH.Logout)
		authGroup.POST("/forgot-password", authH.ForgotPassword)
		authGroup.POST("/reset-password", authH.ResetPassword)
	}

	// Routes protégées par JWT.
	authReq := middleware.AuthRequired(jwtMgr)
	api.GET("/me", authReq, meH.Get)
	api.PATCH("/me", authReq, meH.Patch)
	api.DELETE("/me", authReq, meH.DeleteAccount)
	api.GET("/me/course-followings", authReq, meH.GetFollowings)
	api.PUT("/me/course-followings", authReq, meH.SetFollowings)
	api.POST("/me/fcm-token", authReq, meH.SetFCMToken)
	api.DELETE("/me/fcm-token", authReq, meH.ClearFCMToken)
	api.GET("/courses/week", authReq, coursesH.Week)

	// Upload de fichiers (avatars, photos de messages, notes vocales).
	api.POST("/uploads", authReq, uploadsH.Upload)

	slotsGroup := api.Group("/free-slots", authReq)
	{
		slotsGroup.GET("", slotsH.List)
		slotsGroup.POST("", slotsH.Create)
		slotsGroup.GET("/:id", slotsH.Get)
		slotsGroup.DELETE("/:id", slotsH.Cancel)
		slotsGroup.POST("/:id/join", slotsH.Join)
		slotsGroup.DELETE("/:id/join", slotsH.Leave)
		slotsGroup.GET("/:id/thread", messagesH.SlotThread)
	}

	convGroup := api.Group("/conversations", authReq)
	{
		convGroup.GET("", messagesH.ListDMs)
		convGroup.POST("/dm", messagesH.OpenDM)
		convGroup.GET("/:id/messages", messagesH.ListMessages)
		convGroup.POST("/:id/messages", messagesH.SendMessage)
		convGroup.POST("/:id/read", messagesH.MarkRead)
	}

	// Broadcasts visibles par tous les adhérents.
	api.GET("/broadcasts/active", authReq, adminH.ListActiveBroadcasts)
	api.POST("/broadcasts/:id/dismiss", authReq, adminH.DismissBroadcast)

	// Routes réservées coach/admin (vérification du rôle dans le service).
	adminGroup := api.Group("/admin", authReq)
	{
		adminGroup.POST("/broadcasts", adminH.CreateBroadcast)
		adminGroup.DELETE("/broadcasts/:id", adminH.RevokeBroadcast)
		adminGroup.POST("/courses/:id/notify", adminH.NotifyCourse)
		adminGroup.PATCH("/courses/:id", adminH.UpdateCourse)
		adminGroup.GET("/coaches", adminH.ListCoaches)
	}

	// 9. Démarrage HTTP + graceful shutdown
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("→ écoute en cours",
			slog.String("url", fmt.Sprintf("http://localhost:%s/api/health", cfg.Port)),
		)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		return fmt.Errorf("erreur serveur : %w", err)
	case sig := <-quit:
		logger.Info("signal reçu, arrêt en cours…", slog.String("signal", sig.String()))
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown : %w", err)
	}

	logger.Info("✓ arrêt propre")
	return nil
}

// newLogger renvoie un logger texte coloré en dev, JSON en prod.
func newLogger(cfg *config.Config) *slog.Logger {
	opts := &slog.HandlerOptions{Level: cfg.LogLevel}
	if cfg.IsDev() {
		return slog.New(slog.NewTextHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, opts))
}
