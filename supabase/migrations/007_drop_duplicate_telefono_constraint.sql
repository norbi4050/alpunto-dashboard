-- 007: eliminar constraint redundante
-- telefono ya es PRIMARY KEY de conversaciones; el UNIQUE agregado en 006 duplicaba el índice.
-- (Aplicada vía Supabase MCP el 2026-06-09)

ALTER TABLE public.conversaciones DROP CONSTRAINT IF EXISTS conversaciones_telefono_key;
