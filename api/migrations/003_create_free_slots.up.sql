-- Migration 003 : Créneaux libres entre adhérents (cœur du produit)
-- Un adhérent publie, d'autres rejoignent. Pas de validation, pas de limite.

CREATE TABLE free_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Créateur
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Quand
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,

    -- Quoi
    title VARCHAR(150) NOT NULL,
    description TEXT,
    discipline course_discipline NOT NULL,
    intensity course_intensity,

    -- Où
    location VARCHAR(100),  -- Dojo Sorgues, Dojo Vedène, autre

    -- Statut
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    cancelled_reason TEXT,

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_slot_time_order CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_free_slots_start ON free_slots(scheduled_start) WHERE is_cancelled = FALSE;
CREATE INDEX idx_free_slots_creator ON free_slots(creator_id);
CREATE INDEX idx_free_slots_discipline ON free_slots(discipline) WHERE is_cancelled = FALSE;

CREATE TRIGGER trg_free_slots_updated_at
    BEFORE UPDATE ON free_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Participants à un créneau libre
CREATE TABLE free_slot_participants (
    slot_id UUID NOT NULL REFERENCES free_slots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (slot_id, user_id)
);

CREATE INDEX idx_slot_participants_user ON free_slot_participants(user_id);
CREATE INDEX idx_slot_participants_slot ON free_slot_participants(slot_id);


-- Source d'un créneau libre (utile pour la génération auto depuis un cours absent)
CREATE TABLE free_slots_origins (
    slot_id UUID PRIMARY KEY REFERENCES free_slots(id) ON DELETE CASCADE,

    -- Si le créneau a été généré automatiquement depuis un cours dont le coach est absent
    triggered_by_course_instance_id UUID REFERENCES course_instances(id) ON DELETE SET NULL,

    -- Type de source
    origin_type VARCHAR(30) NOT NULL DEFAULT 'manual',  -- 'manual', 'auto_coach_absent', 'imported'

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


COMMENT ON TABLE free_slots IS 'Créneaux libres publiés par les adhérents pour s''entraîner ensemble';
COMMENT ON TABLE free_slot_participants IS 'Adhérents qui ont rejoint un créneau libre';
COMMENT ON TABLE free_slots_origins IS 'Origine d''un créneau libre (manuel ou auto-généré)';
