-- 008: soporte para CRON-3 Reactivación y CRON-4 Métricas diarias
-- (Aplicada vía Supabase MCP el 2026-06-09)

-- Tracking de reactivación por cliente (CRON-3)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS ultima_reactivacion TIMESTAMPTZ;

-- UNIQUE en metricas_diarias.fecha para que el upsert del CRON-4 funcione
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'metricas_diarias_fecha_key'
      AND conrelid = 'public.metricas_diarias'::regclass
  ) THEN
    ALTER TABLE public.metricas_diarias
      ADD CONSTRAINT metricas_diarias_fecha_key UNIQUE (fecha);
  END IF;
END;
$body$;

-- Config del CRON-3 Reactivación
-- reactivacion_activa queda en false hasta que Meta apruebe el template MARKETING
-- (config template_reactivacion = nombre del template aprobado, ej: re_engagement_inactivo_v1)
INSERT INTO public.config (clave, valor) VALUES
  ('reactivacion_activa', 'false'),
  ('reactivacion_ventana_dias', '2'),
  ('reactivacion_cooldown_dias', '21'),
  ('reactivacion_max_por_dia', '15'),
  ('template_reactivacion', '')
ON CONFLICT (clave) DO NOTHING;
