-- ============================================================
-- BarberStack v1 — Migration 003: Agenda tables
-- ============================================================

-- dia_semana: 0=Dom, 1=Lun ... 6=Sáb
-- Múltiples franjas por día → split schedule soportado
CREATE TABLE IF NOT EXISTS horarios_barbero (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbero_id  UUID NOT NULL REFERENCES barberos(id) ON DELETE CASCADE,
  dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin    TIME NOT NULL,
  CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_horarios_barbero ON horarios_barbero(barbero_id, dia_semana);

-- hora_inicio IS NULL = día completo bloqueado
CREATE TABLE IF NOT EXISTS bloqueos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbero_id  UUID NOT NULL REFERENCES barberos(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  hora_inicio TIME,
  hora_fin    TIME,
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloqueos_barbero_fecha ON bloqueos(barbero_id, fecha);

CREATE TABLE IF NOT EXISTS metricas_diarias (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha             DATE NOT NULL UNIQUE,
  turnos_total      INTEGER NOT NULL DEFAULT 0,
  turnos_asistidos  INTEGER NOT NULL DEFAULT 0,
  turnos_cancelados INTEGER NOT NULL DEFAULT 0,
  clientes_nuevos   INTEGER NOT NULL DEFAULT 0,
  mensajes_bot      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
