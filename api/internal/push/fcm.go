// Package push envoie des push notifications via Firebase Cloud Messaging (FCM).
//
// Deux modes selon FCM_CREDENTIALS_FILE :
//   - Vide ou fichier absent : mode "log" (les push sont loggées, pas envoyées).
//   - Fichier de credentials Firebase Admin : envoi réel via FCM HTTP v1.
//
// Pour récupérer le fichier de credentials :
//   Firebase Console → Project Settings → Service Accounts → "Generate new private key"
package push

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

// Notification : payload affichée à l'utilisateur.
type Notification struct {
	Title string
	Body  string
	// Data libres : utilisées pour les deep links côté mobile.
	// Ex: {"screen": "slot-detail", "slot_id": "..."}
	Data map[string]string
}

// Sender : interface pour envoyer des push à un ou plusieurs FCM tokens.
type Sender interface {
	Send(ctx context.Context, fcmToken string, notif Notification) error
	SendMulti(ctx context.Context, fcmTokens []string, notif Notification) (success, failure int)
}

// New construit le Sender selon la config.
func New(credentialsFile string, logger *slog.Logger) Sender {
	if credentialsFile == "" {
		logger.Info("push : mode log (FCM_CREDENTIALS_FILE vide)")
		return &logSender{logger: logger}
	}
	if _, err := os.Stat(credentialsFile); err != nil {
		logger.Warn("push : fichier de credentials introuvable, mode log",
			slog.String("file", credentialsFile),
			slog.Any("error", err),
		)
		return &logSender{logger: logger}
	}

	app, err := firebase.NewApp(context.Background(), nil, option.WithCredentialsFile(credentialsFile))
	if err != nil {
		logger.Error("push : init Firebase KO, mode log", slog.Any("error", err))
		return &logSender{logger: logger}
	}
	client, err := app.Messaging(context.Background())
	if err != nil {
		logger.Error("push : init messaging KO, mode log", slog.Any("error", err))
		return &logSender{logger: logger}
	}
	logger.Info("✓ push : Firebase Cloud Messaging prêt")
	return &fcmSender{client: client, logger: logger}
}

// --- Mode log : pas d'envoi réel ---

type logSender struct{ logger *slog.Logger }

func (s *logSender) Send(ctx context.Context, fcmToken string, notif Notification) error {
	s.logger.InfoContext(ctx, "📲 [LOG PUSH]",
		slog.String("token", truncate(fcmToken, 20)),
		slog.String("title", notif.Title),
		slog.String("body", notif.Body),
		slog.Any("data", notif.Data),
	)
	return nil
}

func (s *logSender) SendMulti(ctx context.Context, tokens []string, notif Notification) (int, int) {
	for _, t := range tokens {
		_ = s.Send(ctx, t, notif)
	}
	return len(tokens), 0
}

// --- Mode FCM réel ---

type fcmSender struct {
	client *messaging.Client
	logger *slog.Logger
}

func (s *fcmSender) Send(ctx context.Context, fcmToken string, notif Notification) error {
	if fcmToken == "" {
		return errors.New("fcm token vide")
	}
	msg := &messaging.Message{
		Token: fcmToken,
		Notification: &messaging.Notification{
			Title: notif.Title,
			Body:  notif.Body,
		},
		Data: notif.Data,
	}
	_, err := s.client.Send(ctx, msg)
	if err != nil {
		return fmt.Errorf("fcm send : %w", err)
	}
	return nil
}

func (s *fcmSender) SendMulti(ctx context.Context, tokens []string, notif Notification) (int, int) {
	if len(tokens) == 0 {
		return 0, 0
	}
	// FCM HTTP v1 limite à 500 tokens par batch.
	const batch = 500
	totalSuccess, totalFailure := 0, 0
	for i := 0; i < len(tokens); i += batch {
		end := i + batch
		if end > len(tokens) {
			end = len(tokens)
		}
		msg := &messaging.MulticastMessage{
			Tokens:       tokens[i:end],
			Notification: &messaging.Notification{Title: notif.Title, Body: notif.Body},
			Data:         notif.Data,
		}
		resp, err := s.client.SendEachForMulticast(ctx, msg)
		if err != nil {
			s.logger.WarnContext(ctx, "fcm multicast KO", slog.Any("error", err))
			totalFailure += end - i
			continue
		}
		totalSuccess += resp.SuccessCount
		totalFailure += resp.FailureCount
	}
	return totalSuccess, totalFailure
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
