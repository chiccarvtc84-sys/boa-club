-- Annule la migration 004
DROP TRIGGER IF EXISTS trg_message_updates_conversation ON messages;
DROP FUNCTION IF EXISTS update_conversation_last_message();
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversation_participants;
DROP TABLE IF EXISTS conversations;
DROP TYPE IF EXISTS message_type;
DROP TYPE IF EXISTS conversation_type;
