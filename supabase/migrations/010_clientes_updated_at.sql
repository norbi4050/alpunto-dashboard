-- 010: clientes.updated_at
-- La tabla clientes no tenía updated_at; los CRON-3/4 (y el patrón supaUpdate de los
-- Code nodes) la incluyen en sus PATCH, que fallaban silenciosamente con error 400.
-- (Aplicada vía Supabase MCP el 2026-06-09)

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
