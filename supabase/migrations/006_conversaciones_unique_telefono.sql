-- 006: UNIQUE constraint en conversaciones.telefono
-- Necesario para que el upsert del bot (Prefer: resolution=merge-duplicates) funcione correctamente.
-- Ejecutar en Supabase Dashboard → SQL Editor

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversaciones_telefono_key'
      AND conrelid = 'public.conversaciones'::regclass
  ) THEN
    ALTER TABLE public.conversaciones
      ADD CONSTRAINT conversaciones_telefono_key UNIQUE (telefono);
    RAISE NOTICE 'Constraint conversaciones_telefono_key creado OK';
  ELSE
    RAISE NOTICE 'Constraint conversaciones_telefono_key ya existía, nada que hacer';
  END IF;
END;
$body$;

-- Agregar también contexto_cron JSONB en turnos (para que CRON-1 pueda marcar recordatorio_enviado)
ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS contexto_cron JSONB DEFAULT '{}'::jsonb;
