-- Migration 013 : système d'amis (relation symétrique simple sans approbation)
--
-- Choix : pas de demande en attente / accept-decline. Une seule ligne A→B
-- suffit pour qu'A considère B comme ami. Si on veut une vraie réciprocité
-- (les 2 doivent s'ajouter), c'est codé côté service en filtrant les
-- friendships où il existe la ligne miroir B→A.
--
-- Pour la V1, on suit la sémantique "follow" : A ajoute B en ami sans
-- demander la permission. C'est aligné sur l'expérience "annuaire club"
-- (tout le monde est déjà confirmé adhérent).

CREATE TABLE friendships (
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Bascule de notification : si true, on push une notif quand l'ami a
    -- une activité (rejoint un créneau, ceinture promue, etc.).
    notifications_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id),
    -- Auto-amitié interdite.
    CHECK (user_id != friend_id)
);

-- Lookup inverse "qui m'a ajouté en ami" (utile pour les notifs).
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
