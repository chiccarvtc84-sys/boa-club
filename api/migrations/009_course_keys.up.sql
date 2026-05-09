-- Migration 009 : ajout d'une clé logique sur les cours récurrents.
--
-- Plusieurs lignes recurring_courses peuvent représenter le même "type" de cours
-- (ex: 1 ligne par jour de la semaine où le cours a lieu). On ajoute une clé
-- partagée pour qu'un user puisse "suivre" un cours sans avoir à toucher à toutes
-- ses occurrences.

ALTER TABLE recurring_courses ADD COLUMN course_key VARCHAR(50);

UPDATE recurring_courses SET course_key = 'jjb-gi'              WHERE name = 'JJB (Gi)';
UPDATE recurring_courses SET course_key = 'grappling-debutant'  WHERE name = 'Grappling No-Gi débutant';
UPDATE recurring_courses SET course_key = 'grappling-confirme'  WHERE name = 'Grappling No-Gi Confirmé';
UPDATE recurring_courses SET course_key = 'mma'                 WHERE name LIKE 'MMA%';
UPDATE recurring_courses SET course_key = 'open-mat'            WHERE name = 'Open Mat';

-- Pour les anciens cours désactivés (migration 006) qui n'ont pas de match,
-- on dérive un slug rudimentaire à partir du nom.
UPDATE recurring_courses
SET course_key = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE course_key IS NULL;

ALTER TABLE recurring_courses ALTER COLUMN course_key SET NOT NULL;

CREATE INDEX idx_recurring_courses_key ON recurring_courses(course_key)
    WHERE is_active = TRUE;
