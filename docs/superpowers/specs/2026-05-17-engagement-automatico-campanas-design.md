# Engagement Automático + Campañas — Design Spec

## Goal

Agregar engagement proactivo al AlPunto Inteligente: cumpleaños automático, reactivación de pacientes dormidos, NPS con dashboard, campañas manuales template-based, y rediseño del flujo de reserva web (WF08) para confirmar datos del paciente (incluyendo fecha de nacimiento) antes de elegir horario.

## Contexto

Competidores como Darwin.AI venden "agentes outbound" como productos separados. Nosotros integramos todo esto en el producto clínico vertical — con lógica de especialidades, obras sociales y el contexto real del paciente. Esta es la profundidad que ellos no tienen.

---

## Feature 1: WF08 — Confirmación de datos + fecha de nacimiento

### Decisión
Antes de mostrar el calendario de slots, WF08 muestra un **paso 0** de confirmación de datos del paciente. El paciente puede editar nombre, obra social, y completar `fecha_nacimiento` (date picker nativo mobile).

Al confirmar, WF08 hace PATCH a Supabase y avanza al calendario. El campo `fecha_nacimiento` queda guardado para el cron de cumpleaños.

### Cambio en WF02
Se elimina el estado `confirmar_datos` del flujo WhatsApp. Después de elegir profesional, WF02 manda el link directamente (la confirmación de datos ahora ocurre en WF08). Funciones a eliminar: `mostrarResumenConfirmacion`, estado `confirmar_datos`, botones `edit_nombre / edit_os / edit_especialidad / edit_profesional / confirmar_datos_ok`.

### UX del paso 0 en WF08
```
┌─────────────────────────────────────────┐
│  [Header: PoliAlPunto Rivadavia]    │
│  [Card: Dr. Pérez — Cardiología]        │
│                                         │
│  Confirmá tus datos                     │
│  ─────────────────                      │
│  Nombre     [Juan García        ]  ✏️   │
│  Obra social [OSDE              ]  ✏️   │
│  Cumpleaños  [  /  /    ]  📅           │
│             (opcional — para no olvidarlo) │
│                                         │
│  [Confirmar y elegir horario →]         │
└─────────────────────────────────────────┘
```

- `fecha_nacimiento` es opcional (no bloquea el flujo si no la completa)
- Si el campo ya tiene valor guardado, se muestra pre-cargado
- Nombre y obra social son editables inline

### Nuevo endpoint
`PATCH /webhook/AlPunto-turnos?token=X&action=actualizar_datos`
Body: `{ nombre, obra_social, fecha_nacimiento }`
Hace PATCH a `clientes` y continúa al calendario.

---

## Feature 2: Cumpleaños automático

### Decisión
- Saludo simple: *"¡Feliz cumpleaños [nombre]! 🎂 Que tengas un gran día. — [AlPunto]"*
- Cron diario a las 09:00 AM hora Argentina (12:00 UTC)
- No cambia el estado de la conversación del paciente
- Solo envía a pacientes con `telefono_wa` y `fecha_nacimiento` set
- Requiere template Meta aprobado

### Template Meta a aprobar
```
Nombre: AlPunto_cumpleanos
Idioma: es_AR
Cuerpo: "¡Feliz cumpleaños {{1}}! 🎂 Que tengas un gran día. — {{2}}"
Variables: [nombre_paciente, nombre_AlPunto]
Categoría: UTILITY
```

### Lógica del cron (WF nuevo: WF-CUMPLEANOS)
```
1. SELECT id, nombre, telefono_wa FROM clientes
   WHERE EXTRACT(MONTH FROM fecha_nacimiento) = EXTRACT(MONTH FROM NOW())
     AND EXTRACT(DAY FROM fecha_nacimiento) = EXTRACT(DAY FROM NOW())
     AND telefono_wa IS NOT NULL
2. Para cada paciente: enviar template WhatsApp con nombre y AlPunto_NOMBRE
3. Log en tabla AlPunto_campana_envios (campana_id = NULL para automáticos)
```

---

## Feature 3: Reactivación de pacientes dormidos

### Decisión
- Cron semanal: lunes 10:00 AM Argentina
- Umbral configurable desde dashboard (default: 180 días)
- Umbral guardado en tabla `config` (clave: `dias_dormido_umbral`)
- No reenvía si el paciente ya recibió reactivación en los últimos 30 días
- Campo `ultima_reactivacion DATE` en `clientes`

### Template Meta a aprobar
```
Nombre: AlPunto_reactivacion
Idioma: es_AR
Cuerpo: "Hola {{1}}, hace tiempo que no te vemos en {{2}}. 
¿Querés agendar un turno? Hacé clic en el botón 👇"
Botón: CTA URL → [link de booking web]
Variables: [nombre_paciente, nombre_AlPunto]
Categoría: UTILITY
```

### Lógica del cron (WF nuevo: WF-REACTIVACION)
```
1. Leer umbral desde config WHERE clave = 'dias_dormido_umbral'
2. SELECT p.id, p.nombre, p.telefono_wa FROM clientes p
   LEFT JOIN turnos t ON t.paciente_id = p.id
   WHERE p.telefono_wa IS NOT NULL
     AND (p.ultima_reactivacion IS NULL OR p.ultima_reactivacion < NOW() - INTERVAL '30 days')
   GROUP BY p.id
   HAVING MAX(t.fecha_hora) < NOW() - INTERVAL '{umbral} days'
      OR MAX(t.fecha_hora) IS NULL
3. Para cada paciente:
   a. Generar bookingToken → guardar en ctx de conversación con estado 'esperando_booking_web'
   b. Enviar template con nombre, AlPunto y URL de booking
   c. UPDATE clientes SET ultima_reactivacion = TODAY WHERE id = p.id
4. Log en AlPunto_campana_envios
```

---

## Feature 4: NPS con Dashboard

### Decisión
- Nueva sección en la página de Analytics existente
- Lee la tabla `feedback` (ya existe con `turno_id`, `calificacion`, `comentario`)
- Métricas: score promedio, trend semanal, desglose por profesional, feedback urgente

### Componentes
```
NPS Section en /dashboard/analytics
├── NpsScoreCard          — promedio últimos 30 días + tendencia vs. 30 días anteriores
├── NpsTrendChart         — línea semanal de score promedio (últimas 8 semanas)
├── NpsPorProfesional     — tabla: profesional / score / cantidad de ratings
└── FeedbackUrgente       — lista de ratings 1-2 estrellas con comentario (solo rol dueño)
```

### Alerta feedback urgente
- Aparece en la sección solo si hay ratings ≤ 2 en los últimos 7 días
- Muestra: nombre del paciente (si está disponible), profesional, fecha, comentario
- Solo visible para rol `dueno`

---

## Feature 5: Campañas manuales

### Decisión
- Nueva página `/dashboard/campanas` — solo rol `dueno`
- Template-based (compliance WhatsApp): 4 templates pre-aprobados
- Audiencias configurables: todos / por especialidad / dormidos X días
- Programación: ahora o fecha+hora futura
- Historial con métricas de entrega y respuesta

### Templates disponibles
| Key | Nombre | Uso | Botón |
|---|---|---|---|
| `reactivacion` | Reactivación | Pacientes dormidos | ✅ CTA booking |
| `control_anual` | Control anual | Recordar chequeo | ✅ CTA booking |
| `libre` | Mensaje libre | Campañas estacionales, info | ❌ solo texto |
| `cumpleanos` | Cumpleaños | (automático — no disponible manual) | — |

Template `libre`:
```
"Hola {{1}}, {{2}} te informa: {{3}}"
Variables: [nombre_paciente, nombre_AlPunto, mensaje_personalizado (max 100 chars)]
```

### UX del campaign builder
```
/dashboard/campanas
├── Lista de campañas (historial)
│   ├── Nombre / template / fecha / estado / enviados / respondieron
│   └── Botón "Nueva campaña"
│
└── Modal "Nueva campaña"
    ├── Paso 1: Template (reactivacion | control_anual | libre)
    ├── Paso 2: Audiencia
    │   ├── Todos los pacientes
    │   ├── Por especialidad (select)
    │   └── Dormidos más de X días (input)
    ├── Paso 3: Preview del mensaje (con datos reales del primer paciente)
    ├── Paso 4: Programar (ahora / fecha+hora)
    └── Confirmar → POST /api/campanas/crear
```

### Ejecución de campaña
- El dashboard crea el registro en `campanas` con estado `borrador`
- POST `/api/campanas/enviar` dispara el WF de n8n que hace los envíos en lotes
- WF actualiza estado a `enviando` → `completada`
- Cada envío registrado en `AlPunto_campana_envios`

---

## Base de datos

### Modificar: `clientes`
```sql
ALTER TABLE clientes
  ADD COLUMN fecha_nacimiento DATE,
  ADD COLUMN ultima_reactivacion DATE;
```

### Crear: `config`
```sql
CREATE TABLE config (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO config (clave, valor)
VALUES ('dias_dormido_umbral', '180');
```

### Crear: `campanas`
```sql
CREATE TABLE campanas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT NOT NULL,
  template_key        TEXT NOT NULL,        -- 'reactivacion' | 'control_anual' | 'libre'
  audiencia_tipo      TEXT NOT NULL,        -- 'todos' | 'especialidad' | 'dormidos'
  audiencia_valor     TEXT,                 -- nombre especialidad o cantidad de días
  mensaje_custom      TEXT,                 -- solo para template 'libre'
  programada_para     TIMESTAMPTZ,
  estado              TEXT DEFAULT 'borrador',  -- borrador | enviando | completada | cancelada
  total_destinatarios INT DEFAULT 0,
  total_respondieron  INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id)
);
```

### Crear: `AlPunto_campana_envios`
```sql
CREATE TABLE AlPunto_campana_envios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id  UUID REFERENCES campanas(id),  -- NULL para automáticos (cumpleaños)
  paciente_id UUID REFERENCES clientes(id),
  telefono_wa TEXT NOT NULL,
  tipo        TEXT DEFAULT 'campana',  -- 'campana' | 'cumpleanos' | 'reactivacion'
  estado      TEXT DEFAULT 'enviado',  -- enviado | respondio
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Archivos afectados

### n8n — workflows nuevos
| Workflow | Trigger | Función |
|---|---|---|
| WF-CUMPLEANOS | Cron diario 12:00 UTC | Detectar cumpleaños del día y enviar template |
| WF-REACTIVACION | Cron lunes 13:00 UTC | Detectar dormidos y enviar template con booking link |
| WF-CAMPANAS | Webhook (POST desde dashboard) | Ejecutar campaña manual: leer destinatarios y enviar |

### n8n — workflows modificados
| Workflow | Cambio |
|---|---|
| WF02 | Eliminar estado `confirmar_datos` y función `mostrarResumenConfirmacion`. Ir directo de `esperando_profesional` → `mostrarDias` |
| WF08 | Agregar paso 0 de confirmación de datos (nombre, obra social, fecha_nacimiento) antes del calendario de slots |

### Dashboard — páginas nuevas
```
app/dashboard/campanas/
  page.tsx                      — lista + historial de campañas (server component)
  campanas-client.tsx           — client component con modal
components/campanas/
  campanas-list.tsx             — tabla de historial
  nueva-campana-modal.tsx       — wizard 4 pasos
  campana-resultado-badge.tsx   — chip de estado con métricas
```

### Dashboard — páginas modificadas
```
app/dashboard/analytics/
  page.tsx                      — agregar sección NPS abajo
components/analytics/
  nps-score-card.tsx            — score + tendencia            [NUEVO]
  nps-trend-chart.tsx           — gráfico semanal              [NUEVO]
  nps-por-profesional.tsx       — tabla por profesional        [NUEVO]
  feedback-urgente.tsx          — alertas 1-2 estrellas        [NUEVO]
components/pacientes/
  pacientes-table.tsx           — agregar columna fecha_nacimiento editable
```

### API routes nuevas
```
app/api/campanas/
  crear/route.ts                — POST: crear campaña en borrador, calcular destinatarios
  enviar/route.ts               — POST: disparar WF-CAMPANAS en n8n
  [id]/route.ts                 — GET: detalle + métricas de una campaña
app/api/configuracion/
  route.ts                      — GET/PATCH: leer y actualizar config
```

### Base de datos
```
supabase/migrations/20260517_engagement.sql   — DDL de todas las tablas nuevas y ALTER TABLE
```

---

## Orden de implementación recomendado

1. **DB migration** — base de todo lo demás
2. **WF08 paso 0** — toca el flujo crítico de booking, mejor tenerlo pronto
3. **WF02 simplificado** — sacar confirmar_datos
4. **WF-CUMPLEANOS** — workflow más simple, validar infraestructura de cron
5. **WF-REACTIVACION** — cron más complejo, reutiliza lo aprendido del anterior
6. **NPS en Analytics** — solo dashboard, no toca n8n
7. **Campañas dashboard + WF-CAMPANAS** — feature más compleja, al final
