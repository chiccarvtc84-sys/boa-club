-- Rollback de la migration 007.
-- Supprime les nouveaux cours (= ceux avec un default_coach_id) et leurs coachs,
-- réactive les anciens cours du seed 006.

DELETE FROM recurring_courses WHERE default_coach_id IS NOT NULL;

UPDATE recurring_courses
SET is_active = TRUE,
    valid_until = NULL
WHERE default_coach_id IS NULL;

DELETE FROM users
WHERE email IN ('vincent@boaclub.fr', 'nassim@boaclub.fr', 'samuel@boaclub.fr');
