-- Annule la migration 005
DROP TABLE IF EXISTS notifications;
DROP TYPE IF EXISTS notification_type;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS refresh_tokens;
