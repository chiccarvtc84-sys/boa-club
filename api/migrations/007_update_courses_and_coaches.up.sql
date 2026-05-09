-- Migration 007 : Mise à jour du planning + ajout des coachs Vincent / Nassim / Samuel
--
-- Aligne le seed BDD sur le proto :
-- - Ajoute Vincent (Grappling No-Gi débutant), Nassim (Confirmé), Samuel (Open Mat)
-- - Désactive les anciens cours (préserve l'historique au lieu de DELETE)
-- - Insère les 13 cours du nouveau planning, avec un default_coach_id par cours

-- 1. Désactiver les anciens cours (issus du seed migration 006)
UPDATE recurring_courses
SET is_active = FALSE,
    valid_until = CURRENT_DATE
WHERE default_coach_id IS NULL AND is_active = TRUE;

-- 2. Ajouter les coachs manquants. Le hash bcrypt est un placeholder ("ChangeMe2026!").
--    Ils pourront se réinscrire eux-mêmes via /api/auth/register avec leur vrai email
--    ou réinitialiser leur mot de passe quand l'endpoint forgot-password sera prêt.
INSERT INTO users (
    email, password_hash, first_name, last_name_initial,
    belt, role, status, email_verified_at, bio, disciplines
) VALUES
    ('vincent@boaclub.fr', '$2a$12$LNqxDq7kzQUHdxZVx8QjN.YwK0Z3XNXqpPLKWj8.Q2vGKxR1XxYxq',
     'Vincent', '.', 'black', 'coach', 'active', NOW(),
     'Coach Grappling No-Gi débutant.', ARRAY['JJB No-Gi']),
    ('nassim@boaclub.fr',  '$2a$12$LNqxDq7kzQUHdxZVx8QjN.YwK0Z3XNXqpPLKWj8.Q2vGKxR1XxYxq',
     'Nassim', '.', 'black', 'coach', 'active', NOW(),
     'Coach Grappling No-Gi confirmé.', ARRAY['JJB No-Gi']),
    ('samuel@boaclub.fr',  '$2a$12$LNqxDq7kzQUHdxZVx8QjN.YwK0Z3XNXqpPLKWj8.Q2vGKxR1XxYxq',
     'Samuel', '.', 'brown', 'coach', 'active', NOW(),
     'Encadre les Open Mats.', ARRAY['JJB No-Gi'])
ON CONFLICT (email) DO NOTHING;

-- 3. Insérer les nouveaux cours, avec FK vers le coach attitré.
INSERT INTO recurring_courses (
    name, day_of_week, start_time, end_time, location,
    discipline, intensity, default_coach_id, is_active
) VALUES
    -- LUNDI
    ('Grappling No-Gi débutant', 1, '18:30', '19:30', 'Dojo de Sorgues', 'jjb_nogi', 'all_levels',
     (SELECT id FROM users WHERE email='vincent@boaclub.fr'), TRUE),
    ('Grappling No-Gi Confirmé', 1, '19:30', '20:30', 'Dojo de Sorgues', 'jjb_nogi', 'sparring_light',
     (SELECT id FROM users WHERE email='nassim@boaclub.fr'),  TRUE),
    ('MMA cours à thèmes',       1, '20:30', '21:30', 'Dojo de Vedène',  'mma',      'all_levels',
     (SELECT id FROM users WHERE email='victor@boaclub.fr'),  TRUE),
    -- MARDI
    ('JJB (Gi)',                 2, '18:30', '19:30', 'Dojo de Sorgues', 'jjb_gi',   'all_levels',
     (SELECT id FROM users WHERE email='victor@boaclub.fr'),  TRUE),
    ('Open Mat',                 2, '19:30', '20:30', 'Dojo de Sorgues', 'open_mat', 'all_levels',
     (SELECT id FROM users WHERE email='samuel@boaclub.fr'),  TRUE),
    ('MMA cours à thèmes',       2, '20:30', '21:30', 'Dojo de Vedène',  'mma',      'all_levels',
     (SELECT id FROM users WHERE email='victor@boaclub.fr'),  TRUE),
    -- MERCREDI
    ('Grappling No-Gi débutant', 3, '18:30', '19:30', 'Dojo de Sorgues', 'jjb_nogi', 'all_levels',
     (SELECT id FROM users WHERE email='vincent@boaclub.fr'), TRUE),
    ('Grappling No-Gi Confirmé', 3, '19:30', '20:30', 'Dojo de Sorgues', 'jjb_nogi', 'sparring_light',
     (SELECT id FROM users WHERE email='nassim@boaclub.fr'),  TRUE),
    ('MMA cours à thèmes',       3, '20:30', '21:30', 'Dojo de Vedène',  'mma',      'all_levels',
     (SELECT id FROM users WHERE email='victor@boaclub.fr'),  TRUE),
    -- JEUDI
    ('JJB (Gi)',                 4, '18:30', '19:30', 'Dojo de Sorgues', 'jjb_gi',   'all_levels',
     (SELECT id FROM users WHERE email='victor@boaclub.fr'),  TRUE),
    ('Open Mat',                 4, '19:30', '20:30', 'Dojo de Sorgues', 'open_mat', 'all_levels',
     (SELECT id FROM users WHERE email='samuel@boaclub.fr'),  TRUE),
    -- VENDREDI
    ('Grappling No-Gi débutant', 5, '18:30', '19:30', 'Dojo de Sorgues', 'jjb_nogi', 'all_levels',
     (SELECT id FROM users WHERE email='vincent@boaclub.fr'), TRUE),
    ('Grappling No-Gi Confirmé', 5, '19:30', '20:30', 'Dojo de Sorgues', 'jjb_nogi', 'sparring_light',
     (SELECT id FROM users WHERE email='nassim@boaclub.fr'),  TRUE);
