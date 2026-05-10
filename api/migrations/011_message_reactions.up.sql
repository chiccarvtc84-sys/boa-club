-- Migration 011 : réactions emoji sur les messages (style WhatsApp)
-- Un user peut poser plusieurs réactions différentes sur un même message
-- (PK composée message + user + emoji). Pour retirer, DELETE de la ligne.

CREATE TABLE message_reactions (
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       VARCHAR(16) NOT NULL,    -- les emojis font max 4 codepoints UTF-8 ≈ 16 octets
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
