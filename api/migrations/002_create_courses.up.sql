-- Migration 002 : Cours du club (planning officiel)
-- Modèle: cours récurrent (template) + instances générées

-- Type discipline pour les cours
CREATE TYPE course_discipline AS ENUM (
    'jjb_gi',
    'jjb_nogi',
    'mma',
    'wrestling',
    'open_mat',
    'mixed'
);

-- Type intensité du cours
CREATE TYPE course_intensity AS ENUM (
    'technique',
    'drilling',
    'sparring_light',
    'sparring_hard',
    'all_levels'
);

-- Cours récurrents (template) - définit le planning hebdomadaire
CREATE TABLE recurring_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identité
    name VARCHAR(150) NOT NULL,
    description TEXT,

    -- Planning
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=dimanche, 1=lundi, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(100),  -- ex: "Dojo Sorgues", "Dojo Vedène"

    -- Catégorisation
    discipline course_discipline NOT NULL,
    intensity course_intensity,

    -- Public visé
    is_kids BOOLEAN NOT NULL DEFAULT FALSE,
    min_belt belt_color,  -- ceinture minimale (NULL = tous niveaux)

    -- Coach attitré (optionnel, peut changer par instance)
    default_coach_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Statut
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Période de validité (pour gérer planning d'été vs d'hiver)
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_recurring_courses_day ON recurring_courses(day_of_week) WHERE is_active = TRUE;
CREATE INDEX idx_recurring_courses_active ON recurring_courses(is_active);

CREATE TRIGGER trg_recurring_courses_updated_at
    BEFORE UPDATE ON recurring_courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Instances de cours (un cours réel à une date précise)
-- Permet de gérer les exceptions : annulation, changement de coach, retard, absence
CREATE TYPE course_status AS ENUM (
    'scheduled',   -- prévu
    'cancelled',   -- annulé par le coach
    'free_open'    -- coach absent mais cours libre maintenu
);

CREATE TABLE course_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Lien vers le cours récurrent (NULL si cours exceptionnel)
    recurring_course_id UUID REFERENCES recurring_courses(id) ON DELETE SET NULL,

    -- Override des champs si nécessaire (sinon hérite du recurring)
    name VARCHAR(150),
    location VARCHAR(100),
    coach_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Date et heure spécifiques
    scheduled_date DATE NOT NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,

    -- Statut
    status course_status NOT NULL DEFAULT 'scheduled',

    -- Notification coach (retard, absence)
    coach_late_minutes SMALLINT,  -- ex: 15 = retard de 15 min
    coach_absent_message TEXT,    -- message du coach si absent

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_instance_time CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_course_instances_date ON course_instances(scheduled_date);
CREATE INDEX idx_course_instances_recurring ON course_instances(recurring_course_id);
CREATE INDEX idx_course_instances_coach ON course_instances(coach_id);

CREATE TRIGGER trg_course_instances_updated_at
    BEFORE UPDATE ON course_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Préférences de notification par cours pour chaque utilisateur
CREATE TABLE user_course_followings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recurring_course_id UUID NOT NULL REFERENCES recurring_courses(id) ON DELETE CASCADE,

    -- Quelles notifs recevoir pour ce cours
    notify_reminder BOOLEAN NOT NULL DEFAULT TRUE,       -- rappel 1h avant
    notify_coach_late BOOLEAN NOT NULL DEFAULT TRUE,
    notify_coach_absent BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, recurring_course_id)
);

CREATE INDEX idx_user_followings_user ON user_course_followings(user_id);


COMMENT ON TABLE recurring_courses IS 'Planning hebdomadaire récurrent (templates)';
COMMENT ON TABLE course_instances IS 'Instance réelle d''un cours à une date (permet exceptions)';
COMMENT ON TABLE user_course_followings IS 'Cours suivis par chaque utilisateur (préférences notifs)';
