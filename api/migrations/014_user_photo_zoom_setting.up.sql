-- Migration 014 : option "autoriser l'agrandissement de ma photo de profil"
--
-- Permet à un membre de bloquer le zoom plein écran de sa photo par d'autres
-- adhérents (privacy setting). Par défaut, on autorise (TRUE) — c'est le
-- comportement actuel.

ALTER TABLE users
    ADD COLUMN allow_photo_zoom BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.allow_photo_zoom IS
    'Si FALSE, les autres adhérents ne peuvent pas agrandir la photo de profil au tap (le tap est désactivé côté mobile). Le propriétaire peut toujours agrandir la sienne.';
