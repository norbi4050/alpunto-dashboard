-- ============================================================
-- BarberStack v1 — Migration 004: RLS policies
-- n8n usa service_role key → bypassa RLS (by design)
-- Dashboard usa authenticated → tiene acceso total
-- ============================================================

ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE barberos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_barbero  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_diarias  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_clientes"       ON clientes         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_barberos"       ON barberos         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_servicios"      ON servicios        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_turnos"         ON turnos           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_conversaciones" ON conversaciones   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_mensajes"       ON mensajes         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bloqueados"     ON bloqueados       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_config"         ON config           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_horarios"       ON horarios_barbero FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bloqueos"       ON bloqueos         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_metricas"       ON metricas_diarias FOR ALL TO authenticated USING (true) WITH CHECK (true);
