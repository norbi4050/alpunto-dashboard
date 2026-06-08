-- ============================================================
-- BarberStack v1 — Migration 002: Bot & config tables
-- ============================================================

CREATE TABLE IF NOT EXISTS conversaciones (
  telefono        TEXT PRIMARY KEY,
  estado          TEXT NOT NULL DEFAULT 'inicio',
  handoff_humano  BOOLEAN NOT NULL DEFAULT false,
  contexto        JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_handoff ON conversaciones(handoff_humano) WHERE handoff_humano = true;
CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversaciones(updated_at DESC);

CREATE TABLE IF NOT EXISTS mensajes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telefono    TEXT NOT NULL,
  direccion   TEXT NOT NULL CHECK (direccion IN ('entrada','salida')),
  contenido   TEXT NOT NULL,
  estado_bot  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_telefono ON mensajes(telefono, created_at DESC);

CREATE TABLE IF NOT EXISTS bloqueados (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telefono    TEXT NOT NULL UNIQUE,
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS config (
  clave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
