-- Migration 010 : ajout du mute des conversations
-- Permet à un participant de désactiver les notifs d'une conversation
-- jusqu'à une date donnée (ou indéfiniment si NULL = unmuted).

ALTER TABLE conversation_participants
    ADD COLUMN muted_until TIMESTAMPTZ;

-- Pas d'index nécessaire : la lecture se fait déjà par PK (conv_id, user_id).
COMMENT ON COLUMN conversation_participants.muted_until IS
    'NULL = pas en mute. Date dans le futur = mute actif jusqu''à cette date. Pour un mute "indéfini" on stocke une date très lointaine (ex: 9999-12-31).';
