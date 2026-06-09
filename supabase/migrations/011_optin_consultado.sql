-- 011: flag para preguntar el opt-in de promos UNA sola vez por cliente
-- opt_in_promo guarda la respuesta; opt_in_consultado distingue "no consultado" de "dijo que no".
-- El bot pregunta tras la primera confirmación de turno (estado preguntando_optin).
-- (Aplicada vía Supabase MCP el 2026-06-09)

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS opt_in_consultado BOOLEAN DEFAULT false;
