DROP INDEX IF EXISTS idx_recurring_courses_key;
ALTER TABLE recurring_courses DROP COLUMN IF EXISTS course_key;
