-- Migration 008 : Alertes générales envoyées par les coachs/admins.
-- Apparaissent en bandeau rouge en haut du planning de tous les adhérents
-- jusqu'à expiration ou fermeture manuelle.

CREATE TABLE broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Auteur réel (utilisateur connecté qui a appuyé sur "Envoyer")
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Nom affiché côté adhérent (peut différer de author_user_id si un coach
    -- envoie au nom d'un autre — pour V1 c'est juste author.first_name).
    author_display_name VARCHAR(50) NOT NULL,

    -- Contenu
    message TEXT NOT NULL CHECK (length(message) > 0),

    -- Durée d'affichage choisie par l'auteur (1h, 6h, 24h, 72h, 168h…).
    duration_hours SMALLINT NOT NULL CHECK (duration_hours > 0),

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    -- Soft delete : permet à l'auteur de retirer une alerte avant expiration.
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_broadcasts_active ON broadcasts(expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_broadcasts_author ON broadcasts(author_user_id);


-- Fermetures individuelles : un adhérent peut "dismiss" un bandeau pour le
-- masquer côté son app sans affecter les autres.
CREATE TABLE broadcast_dismissals (
    broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (broadcast_id, user_id)
);

CREATE INDEX idx_broadcast_dismissals_user ON broadcast_dismissals(user_id);


COMMENT ON TABLE broadcasts IS 'Alertes coach/admin diffusées à tous les adhérents';
COMMENT ON TABLE broadcast_dismissals IS 'Fermetures individuelles d''un bandeau d''alerte';
