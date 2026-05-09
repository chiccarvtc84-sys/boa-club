-- Migration 006 : Seed du planning réel du Clube Desportivo Boa
-- Données injectées une seule fois pour démarrer

-- Planning du Boa Club (basé sur le site officiel)
-- day_of_week: 0=dimanche, 1=lundi, 2=mardi, 3=mercredi, 4=jeudi, 5=vendredi, 6=samedi

INSERT INTO recurring_courses (name, day_of_week, start_time, end_time, location, discipline, intensity, is_kids) VALUES
    -- LUNDI
    ('JJB Technique',              1, '12:00', '13:00', 'Dojo Sorgues', 'jjb_gi',   'technique',     FALSE),
    ('Grappling No-Gi basique',    1, '18:30', '19:30', 'Dojo Sorgues', 'jjb_nogi', 'all_levels',    FALSE),
    ('Grappling No-Gi confirmés',  1, '19:30', '20:30', 'Dojo Sorgues', 'jjb_nogi', 'sparring_light',FALSE),
    ('MMA cours à thèmes',         1, '20:30', '21:30', 'Dojo Vedène',  'mma',      'all_levels',    FALSE),

    -- MARDI
    ('JJB basique',                2, '18:30', '19:30', 'Dojo Sorgues', 'jjb_gi',   'all_levels',    FALSE),
    ('Open Mat',                   2, '19:30', '20:30', 'Dojo Sorgues', 'open_mat', 'all_levels',    FALSE),
    ('MMA cours à thèmes',         2, '20:30', '21:30', 'Dojo Vedène',  'mma',      'all_levels',    FALSE),

    -- MERCREDI
    ('Grappling No-Gi ados',       3, '17:00', '18:00', 'Dojo Sorgues', 'jjb_nogi', 'all_levels',    TRUE),
    ('Grappling No-Gi basique',    3, '18:30', '19:30', 'Dojo Sorgues', 'jjb_nogi', 'all_levels',    FALSE),
    ('MMA cours à thèmes',         3, '20:30', '21:30', 'Dojo Vedène',  'mma',      'all_levels',    FALSE),

    -- JEUDI
    ('JJB basique',                4, '18:30', '19:30', 'Dojo Sorgues', 'jjb_gi',   'all_levels',    FALSE),
    ('Open Mat',                   4, '19:30', '20:30', 'Dojo Sorgues', 'open_mat', 'all_levels',    FALSE),

    -- VENDREDI
    ('JJB Technique',              5, '12:00', '13:00', 'Dojo Sorgues', 'jjb_gi',   'technique',     FALSE),
    ('Grappling No-Gi basique',    5, '18:30', '19:30', 'Dojo Sorgues', 'jjb_nogi', 'all_levels',    FALSE),
    ('MMA combat en cage',         5, '19:30', '20:30', 'Dojo Sorgues', 'mma',      'sparring_hard', FALSE),

    -- SAMEDI
    ('Open Mat',                   6, '10:30', '12:00', 'Dojo Sorgues', 'open_mat', 'all_levels',    FALSE),
    ('Grappling No-Gi ados',       6, '17:00', '18:00', 'Dojo Sorgues', 'jjb_nogi', 'all_levels',    TRUE);


-- Compte coach Victor (mot de passe à changer au premier login)
-- Hash bcrypt de "ChangeMe2026!" (cost 12)
INSERT INTO users (
    email, password_hash, first_name, last_name_initial,
    belt, role, status, email_verified_at,
    bio, disciplines
) VALUES (
    'victor@boaclub.fr',
    '$2a$12$LNqxDq7kzQUHdxZVx8QjN.YwK0Z3XNXqpPLKWj8.Q2vGKxR1XxYxq',
    'Victor',
    'A.',
    'black',
    'admin',
    'active',
    NOW(),
    'Fondateur du Clube Desportivo Boa. Encadre les cours JJB, Grappling et MMA à Sorgues et Vedène.',
    ARRAY['JJB Gi', 'JJB No-Gi', 'MMA']
);
