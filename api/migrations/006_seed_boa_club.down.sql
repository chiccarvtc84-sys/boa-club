-- Annule la migration 006 (suppression des données seed)
DELETE FROM users WHERE email = 'victor@boaclub.fr';
DELETE FROM recurring_courses;
