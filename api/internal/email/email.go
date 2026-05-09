// Package email envoie des emails transactionnels (reset password, notifs).
//
// Deux providers selon EMAIL_PROVIDER :
//   - "mock"   (par défaut en dev) : log l'email dans le terminal, pas d'envoi réel.
//   - "resend" (prod) : utilise l'API HTTP de Resend (https://resend.com).
//
// Pour activer Resend en prod, mettre dans .env :
//
//	EMAIL_PROVIDER=resend
//	EMAIL_API_KEY=re_xxxxxxxx
//	EMAIL_FROM=Boa Club <noreply@boaclub.fr>   # le domaine doit être vérifié sur Resend
package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

type Sender interface {
	Send(ctx context.Context, msg Message) error
}

type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

// New construit un Sender selon la config.
func New(provider, apiKey, from string, logger *slog.Logger) Sender {
	switch provider {
	case "resend":
		return &resendSender{apiKey: apiKey, from: from, logger: logger}
	default:
		return &mockSender{logger: logger}
	}
}

// --- Mock : log dans le terminal, pas d'envoi réel ---

type mockSender struct {
	logger *slog.Logger
}

func (s *mockSender) Send(ctx context.Context, msg Message) error {
	s.logger.InfoContext(ctx, "📧 [MOCK EMAIL]",
		slog.String("to", msg.To),
		slog.String("subject", msg.Subject),
		slog.String("text", msg.Text),
	)
	return nil
}

// --- Resend : POST https://api.resend.com/emails ---

type resendSender struct {
	apiKey string
	from   string
	logger *slog.Logger
}

type resendPayload struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html,omitempty"`
	Text    string `json:"text,omitempty"`
}

type resendError struct {
	Name    string `json:"name"`
	Message string `json:"message"`
}

func (s *resendSender) Send(ctx context.Context, msg Message) error {
	body, err := json.Marshal(resendPayload{
		From:    s.from,
		To:      msg.To,
		Subject: msg.Subject,
		HTML:    msg.HTML,
		Text:    msg.Text,
	})
	if err != nil {
		return fmt.Errorf("marshal resend payload : %w", err)
	}

	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("new request : %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("resend http : %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		var rerr resendError
		_ = json.NewDecoder(resp.Body).Decode(&rerr)
		return fmt.Errorf("resend %d : %s — %s", resp.StatusCode, rerr.Name, rerr.Message)
	}
	s.logger.InfoContext(ctx, "✓ email envoyé via Resend",
		slog.String("to", msg.To),
		slog.String("subject", msg.Subject),
	)
	return nil
}
