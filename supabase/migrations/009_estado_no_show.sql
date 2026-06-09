-- 009: agregar 'no_show' a los estados válidos de turnos
-- Permite registrar inasistencias desde el dashboard (TurnoModal).
-- (Aplicada vía Supabase MCP el 2026-06-09)

ALTER TABLE public.turnos DROP CONSTRAINT IF EXISTS turnos_estado_check;
ALTER TABLE public.turnos ADD CONSTRAINT turnos_estado_check
  CHECK (estado = ANY (ARRAY['agendado'::text, 'confirmado'::text, 'cancelado'::text, 'auto_cancelado'::text, 'asistido'::text, 'no_show'::text]));
