-- 012: email del usuario de dashboard asociado a cada barbero
-- Rol 'barbero': login con acceso solo a su agenda (Hoy / Semana / Mes).
-- El usuario se crea desde Configuración > Barberos vía /api/barberos/usuario (Admin API).
-- (Aplicada vía Supabase MCP el 2026-06-09)

ALTER TABLE public.barberos ADD COLUMN IF NOT EXISTS auth_email TEXT;
