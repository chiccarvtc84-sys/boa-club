-- Migration 005 : Sessions et auth (refresh tokens stockés en BDD)
-- Permet de révoquer une session côté serveur (utile en cas de déconnexion forcée)

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Hash du token (jamais stocké en clair)
    token_hash VARCHAR(255) NOT NULL UNIQUE,

    -- Infos de l'appareil pour aider l'utilisateur à reconnaître ses sessions
    device_name VARCHAR(150),
    device_os VARCHAR(50),
    ip_address INET,
    user_agent TEXT,

    -- Validité
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(100),

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;


-- Tentatives de connexion (anti-bruteforce)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    success BOOLEAN NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email_time ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, created_at DESC);


-- Notifications push envoyées (audit + anti-doublons)
CREATE TYPE notification_type AS ENUM (
    'course_reminder',         -- 1h avant un cours suivi
    'coach_late',              -- coach a annoncé un retard
    'coach_absent',            -- coach absent
    'free_slot_new',           -- nouveau créneau publié
    'free_slot_join',          -- quelqu'un a rejoint mon créneau
    'free_slot_cancelled',     -- un créneau auquel je participe est annulé
    'message_dm',              -- message privé reçu
    'message_slot_thread'      -- message dans un thread de créneau
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    type notification_type NOT NULL,
    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,

    -- Données associées (deep link vers le bon écran)
    data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Statut
    read_at TIMESTAMPTZ,
    sent_to_fcm_at TIMESTAMPTZ,
    fcm_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_all ON notifications(user_id, created_at DESC);


COMMENT ON TABLE refresh_tokens IS 'Tokens de rafraîchissement pour la rotation JWT';
COMMENT ON TABLE login_attempts IS 'Historique des tentatives de connexion (anti-bruteforce)';
COMMENT ON TABLE notifications IS 'Notifications envoyées aux utilisateurs (push + in-app)';
