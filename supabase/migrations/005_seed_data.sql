-- ============================================================
-- BarberStack v1 — Migration 005: Seed data AlPunto Barbería
-- ============================================================

INSERT INTO barberos (slot, nombre, whatsapp, color, activo, es_dueno) VALUES
  (1, 'Barbero 1', NULL,           '#3b82f6', true, false),
  (2, 'Barbero 2', NULL,           '#10b981', true, false),
  (3, 'Barbero 3', NULL,           '#f59e0b', true, false),
  (4, 'Agustín',   '5493755414064','#8b5cf6', true, true)
ON CONFLICT (slot) DO NOTHING;

INSERT INTO servicios (nombre, precio, duracion_min, activo) VALUES
  ('Corte clásico',  14000, 30, true),
  ('Corte + barba',  17000, 45, true),
  ('Solo barba',     10000, 20, true),
  ('Corte niño',     14000, 25, true)
ON CONFLICT DO NOTHING;

INSERT INTO config (clave, valor) VALUES
  ('bot_nivel',          '3'),
  ('mensaje_bienvenida', '¡Hola! 👋 Soy BarberBot de AlPunto. Puedo ayudarte a reservar un turno. ¿Querés sacar un turno?'),
  ('mensaje_ausencia',   'Por el momento no estamos disponibles. Te respondemos a la brevedad 🙏'),
  ('promo_activa',       'false'),
  ('promo_dia',          '1'),
  ('promo_descuento',    '20'),
  ('horario_apertura',   '08:00'),
  ('horario_cierre',     '20:30'),
  ('timezone',           'America/Argentina/Buenos_Aires')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
