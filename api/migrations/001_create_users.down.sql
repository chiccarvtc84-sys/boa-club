-- Annule la migration 001
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS weight_visibility;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS belt_color;
