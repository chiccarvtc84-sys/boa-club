-- Migration 001 : Extensions et table users
-- Crée la fondation : utilisateurs, ceintures, rôles

-- Extension pour générer des UUID v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour la recherche full-text (utile plus tard pour la recherche d'adhérents)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Type ENUM pour les ceintures JJB
CREATE TYPE belt_color AS ENUM (
    'white',
    'blue',
    'purple',
    'brown',
    'black'
);

-- Type ENUM pour les rôles
CREATE TYPE user_role AS ENUM (
    'member',     -- adhérent standard
    'coach',      -- peut publier des notifs cours, voir tout
    'admin'       -- gestion complète (Victor)
);

-- Type ENUM pour le statut du compte
CREATE TYPE user_status AS ENUM (
    'pending',    -- inscrit, pas encore validé
    'active',     -- compte actif
    'suspended',  -- temporairement bloqué
    'deleted'     -- soft delete
);

-- Type ENUM pour la visibilité du poids
CREATE TYPE weight_visibility AS ENUM (
    'public',     -- tout le monde voit
    'members',    -- adhérents uniquement
    'private'     -- masqué
);

-- Table principale des utilisateurs
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identifiants
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Profil
    first_name VARCHAR(100) NOT NULL,
    last_name_initial VARCHAR(5) NOT NULL,  -- ex: "B." pour respecter la vie privée
    avatar_url TEXT,
    bio TEXT,

    -- JJB
    belt belt_color NOT NULL DEFAULT 'white',
    stripes SMALLINT NOT NULL DEFAULT 0 CHECK (stripes BETWEEN 0 AND 4),
    weight_kg NUMERIC(5,2),
    weight_visibility weight_visibility NOT NULL DEFAULT 'members',

    -- Disciplines pratiquées (array de strings)
    disciplines TEXT[] NOT NULL DEFAULT '{}',

    -- Rôle et statut
    role user_role NOT NULL DEFAULT 'member',
    status user_status NOT NULL DEFAULT 'pending',

    -- Vérification email
    email_verified_at TIMESTAMPTZ,
    email_verification_token VARCHAR(64),

    -- Reset password
    password_reset_token VARCHAR(64),
    password_reset_expires_at TIMESTAMPTZ,

    -- Push notifications
    fcm_token TEXT,

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Index pour les recherches courantes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Commentaires pour la documentation
COMMENT ON TABLE users IS 'Utilisateurs de l''application Boa Club';
COMMENT ON COLUMN users.last_name_initial IS 'Initiale du nom de famille (ex: "B."), respect vie privée';
COMMENT ON COLUMN users.disciplines IS 'Liste des disciplines pratiquées: JJB Gi, JJB No-Gi, MMA, Wrestling';
