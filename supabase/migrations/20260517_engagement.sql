ALTER TABLE consultorio_pacientes
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS ultima_reactivacion DATE;

CREATE TABLE IF NOT EXISTS consultorio_configuracion (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave      TEXT UNIQUE NOT NULL,
  valor      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO consultorio_configuracion (clave, valor)
VALUES ('dias_dormido_umbral', '180')
ON CONFLICT (clave) DO NOTHING;

CREATE TABLE IF NOT EXISTS consultorio_campanas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT NOT NULL,
  template_key        TEXT NOT NULL,
  audiencia_tipo      TEXT NOT NULL,
  audiencia_valor     TEXT,
  mensaje_custom      TEXT,
  programada_para     TIMESTAMPTZ,
  estado              TEXT DEFAULT 'borrador',
  total_destinatarios INT DEFAULT 0,
  total_respondieron  INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS consultorio_campana_envios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id  UUID REFERENCES consultorio_campanas(id),
  paciente_id UUID REFERENCES consultorio_pacientes(id),
  telefono_wa TEXT NOT NULL,
  tipo        TEXT DEFAULT 'campana',
  estado      TEXT DEFAULT 'enviado',
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);
