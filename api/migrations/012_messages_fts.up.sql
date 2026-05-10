-- Migration 012 : index Full-Text Search sur les messages
-- Permet une recherche rapide via to_tsvector('french', content).
-- L'index GIN est efficace pour les requêtes @@ tsquery.

CREATE INDEX IF NOT EXISTS idx_messages_fts
    ON messages
    USING GIN (to_tsvector('french', COALESCE(content, '')));
