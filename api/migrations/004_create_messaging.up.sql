-- Migration 004 : Messagerie (conversations privées + threads de créneaux)

-- Type de conversation
CREATE TYPE conversation_type AS ENUM (
    'direct',     -- DM 1-à-1
    'slot_thread' -- discussion publique d'un créneau libre
);

-- Table des conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type conversation_type NOT NULL,

    -- Pour les threads de créneau libre uniquement
    slot_id UUID UNIQUE REFERENCES free_slots(id) ON DELETE CASCADE,

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,

    -- Une conversation 'direct' n'a pas de slot_id, un 'slot_thread' en a forcément un
    CONSTRAINT chk_slot_consistency CHECK (
        (type = 'direct' AND slot_id IS NULL) OR
        (type = 'slot_thread' AND slot_id IS NOT NULL)
    )
);

CREATE INDEX idx_conversations_slot ON conversations(slot_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);


-- Participants à une conversation
CREATE TABLE conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Pour les DM, on stocke quand l'utilisateur a vu pour la dernière fois
    last_read_at TIMESTAMPTZ,

    -- Notifications
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);


-- Type de contenu d'un message
CREATE TYPE message_type AS ENUM (
    'text',
    'photo',
    'voice',
    'system'  -- message auto: "Coach absent", "X a rejoint le créneau"
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL pour messages système

    -- Contenu
    type message_type NOT NULL DEFAULT 'text',
    content TEXT,            -- texte ou caption
    media_url TEXT,          -- URL R2 pour photo/voice
    media_duration_seconds SMALLINT,  -- durée pour les vocaux

    -- Édition / suppression
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Au moins un contenu doit être présent
    CONSTRAINT chk_content_required CHECK (
        content IS NOT NULL OR media_url IS NOT NULL OR type = 'system'
    )
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id) WHERE deleted_at IS NULL;


-- Trigger pour mettre à jour conversations.last_message_at quand un nouveau message arrive
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_message_updates_conversation
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();


COMMENT ON TABLE conversations IS 'Conversations: DM 1-à-1 ou threads de créneaux libres';
COMMENT ON TABLE conversation_participants IS 'Membres d''une conversation avec leur état de lecture';
COMMENT ON TABLE messages IS 'Messages texte, photo, vocal ou système';
