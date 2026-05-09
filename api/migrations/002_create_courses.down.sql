-- Annule la migration 002
DROP TABLE IF EXISTS user_course_followings;
DROP TABLE IF EXISTS course_instances;
DROP TABLE IF EXISTS recurring_courses;
DROP TYPE IF EXISTS course_status;
DROP TYPE IF EXISTS course_intensity;
DROP TYPE IF EXISTS course_discipline;
