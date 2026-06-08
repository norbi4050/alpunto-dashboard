-- ============================================================
-- BarberStack v1 — Migration 001: Core tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS clientes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          TEXT NOT NULL,
  whatsapp        TEXT NOT NULL UNIQUE,
  opt_in_promo    BOOLEAN NOT NULL DEFAULT false,
  visitas         INTEGER NOT NULL DEFAULT 0,
  ultima_visita   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS barberos (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot      SMALLINT NOT NULL UNIQUE CHECK (slot BETWEEN 1 AND 4),
  nombre    TEXT NOT NULL,
  whatsapp  TEXT,
  color     TEXT NOT NULL DEFAULT '#3b82f6',
  activo    BOOLEAN NOT NULL DEFAULT true,
  es_dueno  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS servicios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  precio        INTEGER NOT NULL DEFAULT 0,
  duracion_min  SMALLINT NOT NULL DEFAULT 30,
  activo        BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS turnos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  barbero_id  UUID NOT NULL REFERENCES barberos(id) ON DELETE RESTRICT,
  servicio    TEXT NOT NULL DEFAULT '',
  fecha_hora  TIMESTAMPTZ NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'agendado'
              CHECK (estado IN ('agendado','confirmado','cancelado','auto_cancelado','asistido')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turnos_barbero_fecha ON turnos(barbero_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_turnos_cliente ON turnos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha_hora);
