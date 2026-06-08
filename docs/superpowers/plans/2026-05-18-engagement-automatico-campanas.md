# Engagement Automático + Campañas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fecha_nacimiento collection in WF08, remove confirmar_datos state from WF02, and build automated birthday/reactivation outbound + NPS dashboard section + manual campaigns UI.

**Architecture:** DB-first: migrate clientes + create 3 new tables. WF08 gets a paso 0 data-confirmation form before the calendar. WF02 drops the confirmar_datos state and goes straight to mostrarDias. Two n8n cron workflows handle automated outbound. The Next.js dashboard gains NPS components on the Analytics page and a new /campanas page (dueno only). A WF-CAMPANAS webhook workflow executes manual campaign sends.

**Tech Stack:** n8n Code nodes (vanilla JS, helpers.httpRequest), Supabase REST API via PostgREST, Next.js 14 App Router (server + client components), Tailwind CSS dark theme, TypeScript, Node.js deploy scripts (existing pattern at C:/Users/noyag/).

**n8n instance:** `nexo-terra-n8n.6fwciw.easypanel.host` · Token: see `deploy_wf02.js` line 3 · Error handler WF ID: `anEe7qyiweYG6Ar0`

---

## File Map

### Create
- `C:/Users/noyag/wf_cumpleanos_code.js` — WF-CUMPLEANOS cron code
- `C:/Users/noyag/create_wf_cumpleanos.js` — deploy/create script
- `C:/Users/noyag/wf_reactivacion_code.js` — WF-REACTIVACION cron code
- `C:/Users/noyag/create_wf_reactivacion.js` — deploy/create script
- `C:/Users/noyag/wf_campanas_code.js` — WF-CAMPANAS webhook code
- `C:/Users/noyag/create_wf_campanas.js` — deploy/create script
- `supabase/migrations/20260517_engagement.sql`
- `app/api/campanas/crear/route.ts`
- `app/api/campanas/enviar/route.ts`
- `app/api/campanas/[id]/route.ts`
- `app/api/configuracion/route.ts`
- `app/dashboard/campanas/page.tsx`
- `app/dashboard/campanas/campanas-client.tsx`
- `components/campanas/campanas-list.tsx`
- `components/campanas/nueva-campana-modal.tsx`
- `components/campanas/campana-estado-badge.tsx`
- `components/analytics/nps-score-card.tsx`
- `components/analytics/nps-trend-chart.tsx`
- `components/analytics/nps-por-profesional.tsx`
- `components/analytics/feedback-urgente.tsx`

### Modify
- `C:/Users/noyag/wf08_code.js` — add paso0Pg function + actualizar_datos handler
- `C:/Users/noyag/wf02_code.js` — remove confirmar_datos state + mostrarResumenConfirmacion
- `lib/types.ts` — add FeedbackEntry, Campana, ConfigEntry types
- `app/dashboard/analytics/page.tsx` — add NPS section below existing metrics
- `components/layout/sidebar.tsx` — add Campañas nav entry to NAV array

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260517_engagement.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260517_engagement.sql

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS ultima_reactivacion DATE;

CREATE TABLE IF NOT EXISTS config (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave      TEXT UNIQUE NOT NULL,
  valor      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO config (clave, valor)
VALUES ('dias_dormido_umbral', '180')
ON CONFLICT (clave) DO NOTHING;

CREATE TABLE IF NOT EXISTS campanas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT NOT NULL,
  template_key        TEXT NOT NULL,
  audiencia_tipo      TEXT NOT NULL,
  audiencia_valor     TEXT,
  mensaje_custom      TEXT,
  programada_para     TIMESTAMPTZ,
  estado              TEXT DEFAULT 'borrador',
  total_destinatarios INT DEFAULT 0,
  total_respondieron  INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS AlPunto_campana_envios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id  UUID REFERENCES campanas(id),
  paciente_id UUID REFERENCES clientes(id),
  telefono_wa TEXT NOT NULL,
  tipo        TEXT DEFAULT 'campana',
  estado      TEXT DEFAULT 'enviado',
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__claude_ai_Supabase__apply_migration` tool with:
- project_id: `xorjkjaimeampfdiichs`
- name: `20260517_engagement`
- query: (full SQL above)

- [ ] **Step 3: Verify tables exist**

Use `mcp__claude_ai_Supabase__execute_sql` with:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clientes'
  AND column_name IN ('fecha_nacimiento', 'ultima_reactivacion');

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('config','campanas','AlPunto_campana_envios');
```
Expected: 2 columns + 3 tables returned.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\noyag\Norberto-Documentos\AlPunto-kit\dashboard
git add supabase/migrations/20260517_engagement.sql
git commit -m "feat(db): migración engagement — fecha_nacimiento, configuracion, campanas, envios"
```

---

## Task 2: WF08 — Paso 0 Confirmación de Datos

**Files:**
- Modify: `C:/Users/noyag/wf08_code.js`

Context: WF08 is the n8n webhook that serves the HTML booking flow. Currently it handles `action=confirmar` (create turno) and the default (show calendar). We add:
1. `paso0Pg()` helper function — returns the data-confirmation HTML form
2. Handler for `action=actualizar_datos` — patches Supabase then falls through to calendar
3. Default branch `if (!action)` — returns paso 0 instead of calendar

- [ ] **Step 1: Read current wf08_code.js**

Open `C:/Users/noyag/wf08_code.js`. Locate the three markers:
- Line with `const sessionToken = $input.first().json?.query?.token` — query param extraction block
- Line with `// === CONFIRMAR ===` — confirmar handler
- Line with `// === GENERAR SLOTS ===` — slot generation (calendar)

- [ ] **Step 2: Add `paso0Pg` function**

Insert the following function immediately BEFORE the line that starts `const sessionToken`:

```javascript
function paso0Pg(pac, prof, ctx, baseUrl, tk) {
  const ini = prof.nombre.split(' ').filter(w=>w.length>1&&w[0]===w[0].toUpperCase()).map(w=>w[0]).join('').substring(0,2)||'DR';
  const dobVal = pac.fecha_nacimiento || '';
  const hoy = new Date().toISOString().split('T')[0];
  const currentNombre = (pac.nombre || ctx.pacienteNombre || '').replace(/"/g,'&quot;');
  const currentOs = pac.obra_social || ctx.obraSocial || 'Particular';
  const OBRAS = ['Particular','OSDE','Swiss Medical','Galeno','IOMA','PAMI','Medifé','Sancor Salud','OSECAC','OSPEDYC','Unión Personal'];
  const osOpts = OBRAS.map(os=>`<option value="${os}"${currentOs===os?' selected':''}>${os}</option>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="theme-color" content="#2563EB"><title>Confirmá tus datos</title><style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--p:#2563EB;--bg:#F0F4FF;--c:#FFF;--t:#1E293B;--ts:#64748B;--b:#E2E8F0}body{font-family:system-ui,sans-serif;background:var(--bg);min-height:100dvh}.app{max-width:480px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column}.hdr{background:linear-gradient(135deg,#2563EB,#8B5CF6);padding:24px 20px 28px;color:#fff}.hdr h1{font-size:20px;font-weight:700}.hdr p{font-size:14px;opacity:.85;margin-top:4px}.pc{background:var(--c);margin:-12px 16px 0;border-radius:16px;padding:16px;display:flex;align-items:center;gap:14px;position:relative;z-index:2;box-shadow:0 8px 32px rgba(37,99,235,.12)}.pa{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#8B5CF6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;flex-shrink:0}.pn{font-size:16px;font-weight:600}.pe{font-size:13px;color:var(--ts)}.pr{font-size:12px;color:#94A3B8}.fsec{padding:24px 16px;flex:1;display:flex;flex-direction:column;gap:18px}.st{font-size:17px;font-weight:700;color:var(--t)}.ss{font-size:14px;color:var(--ts);margin-top:4px;line-height:1.4}.fld{display:flex;flex-direction:column;gap:6px}.fld label{font-size:12px;font-weight:600;color:var(--ts);text-transform:uppercase;letter-spacing:.05em}.fld input,.fld select{width:100%;padding:14px 16px;border:2px solid var(--b);border-radius:12px;font-size:15px;color:var(--t);background:#fff;outline:none;-webkit-appearance:none;transition:border-color .2s}.fld input:focus,.fld select:focus{border-color:var(--p)}.hint{font-size:12px;color:#94A3B8;margin-top:4px}.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:16px;border:none;border-radius:12px;background:linear-gradient(135deg,#2563EB,#8B5CF6);color:#fff;font-size:16px;font-weight:600;cursor:pointer;min-height:52px;margin-top:8px}.btn:active{opacity:.9}.btn:disabled{opacity:.5}.sp{display:none;width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}.btn.ld .sp{display:block}.btn.ld .bl{display:none}@keyframes spin{to{transform:rotate(360deg)}}.err{background:#FEE2E2;color:#B91C1C;padding:12px;border-radius:10px;font-size:14px;display:none;margin-top:4px}.err.vis{display:block}</style></head><body><div class="app"><div class="hdr"><div><h1>${AlPunto.nombre}</h1><p>Reserva de turno</p></div></div><div class="pc"><div class="pa">${ini}</div><div><div class="pn">${prof.nombre}</div><div class="pe">${prof.especialidad}</div><div class="pr">${prof.AlPunto}</div></div></div><div class="fsec"><div><div class="st">Confirmá tus datos</div><div class="ss">Revisá que estén correctos antes de elegir el horario.</div></div><div class="fld"><label>Nombre</label><input id="nomb" type="text" value="${currentNombre}" autocomplete="name" /></div><div class="fld"><label>Obra social</label><select id="os">${osOpts}</select></div><div class="fld"><label>Fecha de nacimiento <span style="font-weight:400;text-transform:none;color:#94A3B8">(opcional)</span></label><input id="dob" type="date" value="${dobVal}" max="${hoy}" /><div class="hint">La usamos para enviarte un saludo el día de tu cumpleaños 🎂</div></div><div class="err" id="err"></div><button class="btn" id="btn" onclick="confirmar()"><span class="bl">Confirmar y elegir horario →</span><div class="sp"></div></button></div></div><script>(function(){var TK="${tk}",BU="${baseUrl}";window.confirmar=function(){var btn=document.getElementById('btn'),nomb=document.getElementById('nomb').value.trim(),os=document.getElementById('os').value,dob=document.getElementById('dob').value;if(!nomb){showErr('El nombre es requerido.');return;}btn.classList.add('ld');btn.disabled=true;hideErr();var url=BU+'?token='+encodeURIComponent(TK)+'&action=actualizar_datos&nombre='+encodeURIComponent(nomb)+'&os='+encodeURIComponent(os)+(dob?'&dob='+encodeURIComponent(dob):'');fetch(url).then(function(r){if(!r.ok)throw new Error();return r.text();}).then(function(h){document.open();document.write(h);document.close();}).catch(function(){btn.classList.remove('ld');btn.disabled=false;showErr('Error al conectar. Intentá de nuevo.');});};function showErr(m){var e=document.getElementById('err');e.textContent=m;e.classList.add('vis');}function hideErr(){document.getElementById('err').classList.remove('vis');}})();</script></body></html>`;
}
```

- [ ] **Step 3: Add `actualizar_datos` handler and default paso 0 branch**

Find the block `// === CONFIRMAR ===` and the block `// === GENERAR SLOTS ===`. Between the confirmar handler's closing `}` and the `// === GENERAR SLOTS ===` comment, insert:

```javascript
// === ACTUALIZAR DATOS (paso 0 submit) ===
if (action === 'actualizar_datos') {
  const nombre = ($input.first().json?.query?.nombre || '').trim();
  const os = $input.first().json?.query?.os || '';
  const dob = $input.first().json?.query?.dob || '';
  const upd = {};
  if (nombre) upd.nombre = nombre;
  if (os) upd.obra_social = os;
  if (dob) upd.fecha_nacimiento = dob;
  if (Object.keys(upd).length) {
    await supaUpdate('clientes', { id: `eq.${ctx.pacienteId}` }, upd);
    if (nombre) ctx.pacienteNombre = nombre;
    if (os) ctx.obraSocial = os;
    await supaUpdate('conversaciones', { telefono_wa: `eq.${conv.telefono_wa}` }, { contexto: ctx });
  }
  // fall through to calendar generation below
}

// === PASO 0: CONFIRMACIÓN DE DATOS (no action = first open) ===
if (!action) {
  const pacs = await supaGet('clientes', { id: `eq.${ctx.pacienteId}`, select: 'nombre,obra_social,fecha_nacimiento' });
  const pac = pacs?.[0] || {};
  return [{ json: { html: paso0Pg(pac, prof, ctx, baseUrl, sessionToken) } }];
}
```

- [ ] **Step 4: Deploy WF08**

```bash
node C:/Users/noyag/deploy_wf08.js
```

Expected output:
```
Fetching WF08...
Got WF08: AlPunto - WF08 Selector de Turnos Web — nodes: 3
Code nodes found: 1 — names: [ 'Selector de Turnos' ]
Replacing code in node: Selector de Turnos
Deploying WF08... payload size: ...
HTTP: 200
id: lNSGEWwP4VlSVES8 updatedAt: ... active: true
```

- [ ] **Step 5: Smoke test paso 0**

1. Open any existing booking URL (get a real one from n8n execution history or generate via WF-DASH-2)
2. Navigate to the URL without an `action` parameter
3. Verify: shows the data confirmation form with Nombre, Obra social, Fecha nacimiento fields
4. Fill Nombre + Fecha nacimiento, click "Confirmar y elegir horario →"
5. Verify: calendar appears (same as before)
6. Check Supabase: `SELECT nombre, fecha_nacimiento FROM clientes WHERE id = '<pacienteId>'` — confirm fecha_nacimiento saved

- [ ] **Step 6: Commit**

```bash
git add -p  # stage only the wf08_code.js if tracked; otherwise this is tracked at C:/Users/noyag/
git commit -m "feat(wf08): paso 0 confirmación de datos + fecha_nacimiento antes del calendario"
```

---

## Task 3: WF02 — Eliminar Estado confirmar_datos

**Files:**
- Modify: `C:/Users/noyag/wf02_code.js` (same file as `wf02_code_patched.js`)

Context: WF02 currently shows a WhatsApp list message asking the patient to confirm name/obra_social/profesional before booking. The spec moves that confirmation to WF08 paso 0. We need to:
1. Delete `mostrarResumenConfirmacion` function (~lines 272-295)
2. Replace all `await updateConv(phone, 'confirmar_datos', ctx); await mostrarResumenConfirmacion(phone, ctx);` pairs with `await mostrarDias(phone, ctx);`
3. Delete the entire `if (estado === 'confirmar_datos') { ... }` block (~lines 1139-1183)

There are **8 call sites** to replace and 1 state handler to delete.

- [ ] **Step 1: Delete `mostrarResumenConfirmacion` function**

Find the block starting `async function mostrarResumenConfirmacion(phone, ctx) {` and ending with its closing `}` (approximately lines 272-295). Delete the entire function.

- [ ] **Step 2: Replace all 8 call-site pairs**

Search for every occurrence of:
```javascript
await updateConv(phone, 'confirmar_datos', ctx);
await mostrarResumenConfirmacion(phone, ctx);
```

Replace each occurrence with:
```javascript
await mostrarDias(phone, ctx);
```

Note: some occurrences have a `return` statement on the next line. Keep those returns. Some occurrences are inside `if (ctx.edicion)` blocks followed by their own return — after the replacement those blocks become:
```javascript
if (ctx.edicion) {
  ctx.edicion = false;
  await mostrarDias(phone, ctx);
  return [{ json: { action: 'booking_direct', phone } }];
}
```

The exact replacements by context (use grep to find each):
1. In `esperando_especialidad` — single professional auto-selected (line ~575)
2. In `actualizando_nombre` — `ctx.edicion` true branch (line ~629)
3. In `esperando_obra_social` — `ctx.edicion` + 'Particular' branch (line ~651)
4. In `esperando_obra_social` — `ctx.edicion` + OS by index (line ~686)
5. In `esperando_obra_social` — `ctx.edicion` + OS confirmed (line ~724)
6. In `elegir_especialidad` — single prof auto-selected (line ~760)
7. In `elegirProfesional` helper — (line ~786)
8. In `esperando_booking_web` — specialty keyword detected (lines ~820, ~861)

- [ ] **Step 3: Delete the `confirmar_datos` state handler**

Find and delete the entire block:
```javascript
if (estado === 'confirmar_datos') {
  // ... (approximately 44 lines)
}
```
This block starts at `if (estado === 'confirmar_datos') {` and ends at the closing `}` before `if (estado === 'actualizar_datos') {`.

- [ ] **Step 4: Copy patched file and deploy**

```bash
copy C:\Users\noyag\wf02_code.js C:\Users\noyag\wf02_code.js.bak
node C:\Users\noyag\deploy_wf02.js
```

Expected:
```
HTTP: 200
id: la5XjIMeKIMoTa0q updatedAt: ... active: true
```

- [ ] **Step 5: Smoke test**

Send a WhatsApp message to the bot from a test number and go through the full booking flow: greet → speciality → professional → verify that the bot immediately sends the WF08 booking link (no confirmation step in between).

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(wf02): eliminar estado confirmar_datos — la confirmación pasa a WF08 paso 0"
```

---

## Task 4: WF-CUMPLEANOS — Cron de Cumpleaños

**Files:**
- Create: `C:/Users/noyag/wf_cumpleanos_code.js`
- Create: `C:/Users/noyag/create_wf_cumpleanos.js`

- [ ] **Step 1: Write `wf_cumpleanos_code.js`**

```javascript
// WF-CUMPLEANOS: Cron diario 12:00 UTC — envía saludo de cumpleaños
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
const PHONE_ID = '963190063548521';
const AlPunto_NOMBRE = $env.AlPunto_NOMBRE || 'PoliAlPunto Rivadavia';

async function supaGet(table, params) {
  try {
    return await helpers.httpRequest({ method: 'GET', url: `${SUPABASE_URL}/rest/v1/${table}`, qs: params || {}, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  } catch(e) { return []; }
}

async function supaInsert(table, data) {
  try {
    return await helpers.httpRequest({ method: 'POST', url: `${SUPABASE_URL}/rest/v1/${table}`, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(data) });
  } catch(e) { return null; }
}

async function sendTemplate(phone, nombre, AlPunto) {
  try {
    await helpers.httpRequest({
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: 'AlPunto_cumpleanos',
          language: { code: 'es_AR' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: nombre }, { type: 'text', text: AlPunto }] }]
        }
      })
    });
  } catch(e) {}
}

const today = new Date();
const mes = today.getUTCMonth() + 1;
const dia = today.getUTCDate();

const pacientes = await supaGet('clientes', {
  select: 'id,nombre,telefono_wa,fecha_nacimiento',
  telefono_wa: 'not.is.null',
  fecha_nacimiento: 'not.is.null'
});

const cumpleaneros = (pacientes || []).filter(p => {
  const d = new Date(p.fecha_nacimiento);
  return d.getUTCMonth() + 1 === mes && d.getUTCDate() === dia;
});

let enviados = 0;
const errores = [];
for (const p of cumpleaneros) {
  const primerNombre = (p.nombre || '').split(' ')[0] || p.nombre;
  try {
    await sendTemplate(p.telefono_wa, primerNombre, AlPunto_NOMBRE);
    await supaInsert('AlPunto_campana_envios', {
      campana_id: null,
      paciente_id: p.id,
      telefono_wa: p.telefono_wa,
      tipo: 'cumpleanos',
      estado: 'enviado'
    });
    enviados++;
  } catch(e) {
    errores.push(p.id);
  }
}

return [{ json: { fecha: `${dia}/${mes}`, cumpleaneros: cumpleaneros.length, enviados, errores } }];
```

- [ ] **Step 2: Write `create_wf_cumpleanos.js`**

```javascript
const fs = require('fs');
const https = require('https');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ';
const HOST = 'nexo-terra-n8n.6fwciw.easypanel.host';
const CODE = fs.readFileSync('C:/Users/noyag/wf_cumpleanos_code.js', 'utf8');

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({ hostname: HOST, path: `/api/v1${path}`, method, headers: { 'X-N8N-API-KEY': TOKEN, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
      let raw = ''; res.on('data', c => raw += c); res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const wf = {
    name: 'AlPunto - WF-CUMPLEANOS Saludo Cumpleaños',
    nodes: [
      { id: 'cumple-sched', name: 'Schedule Trigger', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [-400, 300],
        parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 12 * * *' }] } } },
      { id: 'cumple-code', name: 'Cumpleaños Code', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-160, 300],
        parameters: { jsCode: CODE } }
    ],
    connections: { 'Schedule Trigger': { main: [[{ node: 'Cumpleaños Code', type: 'main', index: 0 }]] } },
    settings: { timezone: 'America/Argentina/Buenos_Aires', errorWorkflow: 'anEe7qyiweYG6Ar0', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
    active: false
  };

  const { status, body } = await api('POST', '/workflows', wf);
  console.log('Create HTTP:', status);
  if (status !== 200) { console.error(body.slice(0, 500)); process.exit(1); }
  const result = JSON.parse(body);
  console.log('Created WF-CUMPLEANOS id:', result.id);

  const { status: as, body: ab } = await api('POST', `/workflows/${result.id}/activate`);
  console.log('Activate HTTP:', as, ab.slice(0, 100));
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run create script**

```bash
node C:/Users/noyag/create_wf_cumpleanos.js
```

Expected:
```
Create HTTP: 200
Created WF-CUMPLEANOS id: <new_id>
Activate HTTP: 200 ...
```

Save the new workflow ID to `reference_n8n_nexoterra.md` memory.

- [ ] **Step 4: Verify in n8n**

Open `https://nexo-terra-n8n.6fwciw.easypanel.host` → Workflows → confirm "AlPunto - WF-CUMPLEANOS" appears and is active with Schedule Trigger set to `0 12 * * *`.

- [ ] **Step 5: Test manually**

In the n8n UI, manually execute the WF-CUMPLEANOS workflow. Verify it returns `{ fecha: "18/5", cumpleaneros: 0, enviados: 0, errores: [] }` (likely 0 today — that's correct since no patients have birthday today or fecha_nacimiento isn't filled yet).

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(n8n): WF-CUMPLEANOS cron diario 12UTC — saludo cumpleaños via template"
```

---

## Task 5: WF-REACTIVACION — Cron Semanal

**Files:**
- Create: `C:/Users/noyag/wf_reactivacion_code.js`
- Create: `C:/Users/noyag/create_wf_reactivacion.js`

- [ ] **Step 1: Write `wf_reactivacion_code.js`**

```javascript
// WF-REACTIVACION: Cron lunes 13:00 UTC — pacientes dormidos
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
const PHONE_ID = '963190063548521';
const AlPunto_NOMBRE = $env.AlPunto_NOMBRE || 'PoliAlPunto Rivadavia';
const WA_NUMBER = '5491137936325';
const HOST_BOOKING = 'nexo-terra-n8n.6fwciw.easypanel.host';
const crypto = require('crypto');

async function supaGet(table, params) {
  try { return await helpers.httpRequest({ method: 'GET', url: `${SUPABASE_URL}/rest/v1/${table}`, qs: params || {}, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }); } catch(e) { return []; }
}
async function supaUpdate(table, filter, data) {
  try { await helpers.httpRequest({ method: 'PATCH', url: `${SUPABASE_URL}/rest/v1/${table}`, qs: filter, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }) }); } catch(e) {}
}
async function supaInsert(table, data) {
  try { return await helpers.httpRequest({ method: 'POST', url: `${SUPABASE_URL}/rest/v1/${table}`, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(data) }); } catch(e) { return null; }
}

async function sendTemplate(phone, nombre, AlPunto, bookingUrl) {
  try {
    await helpers.httpRequest({
      method: 'POST', url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: phone, type: 'template',
        template: {
          name: 'AlPunto_reactivacion', language: { code: 'es_AR' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: nombre }, { type: 'text', text: AlPunto }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: bookingUrl }] }
          ]
        }
      })
    });
  } catch(e) {}
}

// 1. Read dormant threshold from config
const cfgRows = await supaGet('config', { clave: 'eq.dias_dormido_umbral', select: 'valor' });
const umbral = parseInt(cfgRows?.[0]?.valor || '180');

// 2. Get all patients with phone
const pacientes = await supaGet('clientes', {
  select: 'id,nombre,telefono_wa,ultima_reactivacion',
  telefono_wa: 'not.is.null'
});

// 3. Get recent turnos to find dormant patients
const cutoff = new Date(Date.now() - umbral * 24 * 60 * 60 * 1000).toISOString();
const turnos = await supaGet('turnos', {
  select: 'paciente_id,fecha_hora,profesional_id',
  estado: 'not.in.(cancelado,auto_cancelado)'
});

// Build map: pacienteId -> { lastFecha, profesionalId }
const lastTurno = {};
for (const t of turnos || []) {
  if (!lastTurno[t.paciente_id] || t.fecha_hora > lastTurno[t.paciente_id].fecha_hora) {
    lastTurno[t.paciente_id] = { fecha_hora: t.fecha_hora, profesional_id: t.profesional_id };
  }
}

// Get first active professional as fallback
const profs = await supaGet('barberos', { activo: 'eq.true', select: 'id', limit: '1' });
const defaultProfId = profs?.[0]?.id || null;

const reactivLimit = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const dormidos = (pacientes || []).filter(p => {
  const ult = lastTurno[p.id];
  const dormido = !ult || ult.fecha_hora < cutoff;
  const noReactivado = !p.ultima_reactivacion || p.ultima_reactivacion < reactivLimit;
  return dormido && noReactivado;
});

let enviados = 0;
const today = new Date().toISOString().split('T')[0];

for (const p of dormidos) {
  const profId = lastTurno[p.id]?.profesional_id || defaultProfId;
  if (!profId) continue;

  // Find or create conversation, set bookingToken
  const convs = await supaGet('conversaciones', { telefono_wa: `eq.${p.telefono_wa}`, select: '*' });
  const conv = convs?.[0];
  const bookingToken = crypto.randomUUID();
  const ctx = conv?.contexto || {};
  ctx.bookingToken = bookingToken;
  ctx.profesionalId = profId;
  ctx.pacienteId = p.id;
  ctx.pacienteNombre = p.nombre;

  if (conv) {
    await supaUpdate('conversaciones', { telefono_wa: `eq.${p.telefono_wa}` }, { estado: 'esperando_booking_web', contexto: ctx });
  } else {
    await supaInsert('conversaciones', { telefono_wa: p.telefono_wa, estado: 'esperando_booking_web', handoff_humano: false, contexto: ctx });
  }

  const bookingUrl = `https://${HOST_BOOKING}/webhook/AlPunto-turnos?token=${bookingToken}`;
  const primerNombre = (p.nombre || '').split(' ')[0] || p.nombre;
  await sendTemplate(p.telefono_wa, primerNombre, AlPunto_NOMBRE, bookingUrl);

  await supaUpdate('clientes', { id: `eq.${p.id}` }, { ultima_reactivacion: today });
  await supaInsert('AlPunto_campana_envios', { campana_id: null, paciente_id: p.id, telefono_wa: p.telefono_wa, tipo: 'reactivacion', estado: 'enviado' });
  enviados++;
}

return [{ json: { umbral, dormidos: dormidos.length, enviados } }];
```

- [ ] **Step 2: Write `create_wf_reactivacion.js`**

Same structure as `create_wf_cumpleanos.js`. Change:
- `wf_cumpleanos_code.js` → `wf_reactivacion_code.js`
- `name`: `'AlPunto - WF-REACTIVACION Pacientes Dormidos'`
- cron: `'0 13 * * 1'` (Mondays 13:00 UTC)
- node id: `'reactiv-sched'`, `'reactiv-code'`
- node name: `'Schedule Trigger'`, `'Reactivacion Code'`

Full file:
```javascript
const fs = require('fs');
const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ';
const HOST = 'nexo-terra-n8n.6fwciw.easypanel.host';
const CODE = fs.readFileSync('C:/Users/noyag/wf_reactivacion_code.js', 'utf8');
function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({ hostname: HOST, path: `/api/v1${path}`, method, headers: { 'X-N8N-API-KEY': TOKEN, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
      let raw = ''; res.on('data', c => raw += c); res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
async function main() {
  const wf = {
    name: 'AlPunto - WF-REACTIVACION Pacientes Dormidos',
    nodes: [
      { id: 'reactiv-sched', name: 'Schedule Trigger', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [-400, 300],
        parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 13 * * 1' }] } } },
      { id: 'reactiv-code', name: 'Reactivacion Code', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-160, 300], parameters: { jsCode: CODE } }
    ],
    connections: { 'Schedule Trigger': { main: [[{ node: 'Reactivacion Code', type: 'main', index: 0 }]] } },
    settings: { timezone: 'America/Argentina/Buenos_Aires', errorWorkflow: 'anEe7qyiweYG6Ar0', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
    active: false
  };
  const { status, body } = await api('POST', '/workflows', wf);
  console.log('Create HTTP:', status);
  if (status !== 200) { console.error(body.slice(0, 500)); process.exit(1); }
  const result = JSON.parse(body);
  console.log('Created WF-REACTIVACION id:', result.id);
  const { status: as, body: ab } = await api('POST', `/workflows/${result.id}/activate`);
  console.log('Activate HTTP:', as, ab.slice(0, 100));
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run create script**

```bash
node C:/Users/noyag/create_wf_reactivacion.js
```

Expected: `Create HTTP: 200` + workflow ID.

- [ ] **Step 4: Test manually in n8n UI**

Manually trigger WF-REACTIVACION in n8n. Verify it returns `{ umbral: 180, dormidos: N, enviados: N }` without errors.

- [ ] **Step 5: Update memory**

Add WF-REACTIVACION ID to `reference_n8n_nexoterra.md`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(n8n): WF-REACTIVACION cron lunes 13UTC — pacientes dormidos con booking link"
```

---

## Task 6: NPS Section in Analytics

**Files:**
- Modify: `lib/types.ts`
- Create: `components/analytics/nps-score-card.tsx`
- Create: `components/analytics/nps-trend-chart.tsx`
- Create: `components/analytics/nps-por-profesional.tsx`
- Create: `components/analytics/feedback-urgente.tsx`
- Modify: `app/dashboard/analytics/page.tsx`

All paths relative to `C:/Users/noyag/Norberto-Documentos/AlPunto-kit/dashboard/`.

- [ ] **Step 1: Add types to `lib/types.ts`**

Append to the file:

```typescript
export interface FeedbackRow {
  id: string
  calificacion: number
  comentario: string | null
  created_at: string
  turno_id: string
}

export interface Campana {
  id: string
  nombre: string
  template_key: 'reactivacion' | 'control_anual' | 'libre'
  audiencia_tipo: 'todos' | 'especialidad' | 'dormidos'
  audiencia_valor: string | null
  mensaje_custom: string | null
  programada_para: string | null
  estado: 'borrador' | 'enviando' | 'completada' | 'cancelada'
  total_destinatarios: number
  total_respondieron: number
  created_at: string
}
```

- [ ] **Step 2: Create `components/analytics/nps-score-card.tsx`**

```typescript
// components/analytics/nps-score-card.tsx
interface Props {
  score: number        // avg rating últimos 30 días (0 if no data)
  count: number        // cantidad de ratings
  tendencia: number    // avg prev 30 días for comparison
}

export function NpsScoreCard({ score, count, tendencia }: Props) {
  const diff = score - tendencia
  const hasData = count > 0
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex items-center gap-5">
      <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full bg-[#0d1117] border-2 border-[#30363d] flex-shrink-0">
        <span className="text-3xl font-bold text-[#f0f6fc]">{hasData ? score.toFixed(1) : '—'}</span>
        <span className="text-[10px] text-[#8b949e]">/ 5</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#f0f6fc]">Satisfacción de pacientes</p>
        <p className="text-xs text-[#8b949e] mt-0.5">{count} respuesta{count !== 1 ? 's' : ''} este mes</p>
        {hasData && tendencia > 0 && (
          <p className={`text-xs mt-1 font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)} vs. mes anterior
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/analytics/nps-trend-chart.tsx`**

```typescript
// components/analytics/nps-trend-chart.tsx
interface Week { label: string; avg: number; count: number }

interface Props { weeks: Week[] }

export function NpsTrendChart({ weeks }: Props) {
  const max = Math.max(...weeks.map(w => w.avg), 5)
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
      <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-4">Score semanal NPS (últimas 8 semanas)</p>
      <div className="flex items-end gap-2 h-24">
        {weeks.map(w => (
          <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-[#8b949e]">{w.count > 0 ? w.avg.toFixed(1) : ''}</span>
            <div className="w-full rounded-t-sm bg-[#4BA3F5] transition-all"
              style={{ height: w.count > 0 ? `${(w.avg / max) * 80}px` : '2px', opacity: w.count > 0 ? 1 : 0.2 }} />
            <span className="text-[9px] text-[#8b949e] truncate w-full text-center">{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/analytics/nps-por-profesional.tsx`**

```typescript
// components/analytics/nps-por-profesional.tsx
interface ProfRow { nombre: string; especialidad: string; avg: number; count: number }

interface Props { rows: ProfRow[] }

export function NpsPorProfesional({ rows }: Props) {
  if (!rows.length) return null
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#21262d]">
        <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">NPS por profesional</p>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-[#0d1117] text-[11px] text-[#8b949e] uppercase tracking-wide">
            <th className="text-left px-5 py-2">Profesional</th>
            <th className="text-right px-5 py-2">Score</th>
            <th className="text-right px-5 py-2">Respuestas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.nombre} className="border-t border-[#21262d]">
              <td className="px-5 py-2.5">
                <p className="text-sm text-[#e6edf3] font-medium">{r.nombre}</p>
                <p className="text-[11px] text-[#8b949e]">{r.especialidad}</p>
              </td>
              <td className="px-5 py-2.5 text-right">
                <span className={`text-sm font-bold ${r.avg >= 4 ? 'text-green-400' : r.avg >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {r.avg.toFixed(1)}
                </span>
              </td>
              <td className="px-5 py-2.5 text-right text-sm text-[#8b949e]">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Create `components/analytics/feedback-urgente.tsx`**

```typescript
// components/analytics/feedback-urgente.tsx
interface UrgentItem {
  id: string
  calificacion: number
  comentario: string | null
  created_at: string
  turno_id: string
}

interface Props { items: UrgentItem[] }

export function FeedbackUrgente({ items }: Props) {
  if (!items.length) return null
  return (
    <div className="bg-[#161b22] border border-red-900/40 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-red-900/40 bg-red-950/20 flex items-center gap-2">
        <span className="text-red-400 text-sm">⚠</span>
        <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Feedback urgente — últimos 7 días</p>
      </div>
      <div className="divide-y divide-[#21262d]">
        {items.map(item => (
          <div key={item.id} className="px-5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400 font-bold text-sm">{'★'.repeat(item.calificacion)}{'☆'.repeat(5 - item.calificacion)}</span>
              <span className="text-[11px] text-[#8b949e]">{new Date(item.created_at).toLocaleDateString('es-AR')}</span>
            </div>
            {item.comentario && <p className="text-sm text-[#e6edf3] leading-relaxed">{item.comentario}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Update `app/dashboard/analytics/page.tsx`**

Add the NPS data query to `getAnalytics`, then render the 4 NPS components below the existing 4-stat grid.

In the `getAnalytics` function, add a 4th query to `Promise.all`:
```typescript
// add to Promise.all in getAnalytics():
supabase
  .from('feedback')
  .select('id, calificacion, comentario, created_at, turno_id')
  .gte('created_at', subDays(ahora, 60).toISOString())
  .order('created_at', { ascending: false }),
```

After the existing destructuring add:
```typescript
const feedbackRaw = feedbackResult.data ?? []
```

Compute NPS metrics (add after the `semanas` computation):
```typescript
const ahora30 = subDays(ahora, 30)
const prev30Start = subDays(ahora, 60)
const fb30 = feedbackRaw.filter(f => new Date(f.created_at) >= ahora30)
const fbPrev = feedbackRaw.filter(f => new Date(f.created_at) >= prev30Start && new Date(f.created_at) < ahora30)
const npsScore = fb30.length > 0 ? Math.round((fb30.reduce((s, f) => s + f.calificacion, 0) / fb30.length) * 10) / 10 : 0
const npsTendencia = fbPrev.length > 0 ? Math.round((fbPrev.reduce((s, f) => s + f.calificacion, 0) / fbPrev.length) * 10) / 10 : 0

const npsWeeks = [0,1,2,3,4,5,6,7].map(i => {
  const fin = subDays(ahora, i * 7)
  const ini = subDays(fin, 7)
  const wf = feedbackRaw.filter(f => new Date(f.created_at) >= ini && new Date(f.created_at) < fin)
  const avg = wf.length > 0 ? Math.round((wf.reduce((s, f) => s + f.calificacion, 0) / wf.length) * 10) / 10 : 0
  return { label: `Sem ${8-i}`, avg, count: wf.length }
}).reverse()

const urgente = fb30.filter(f => f.calificacion <= 2)
```

Then add NPS turnos join to get profesional names. Since the query above only returns `turno_id`, fetch turnos separately in `getAnalytics`:
```typescript
// Add to Promise.all:
supabase
  .from('turnos')
  .select('id, profesional_id, barberos(nombre, especialidad)')
  .in('id', feedbackRaw.map(f => f.turno_id).filter(Boolean))
```

Build `npsProfs` map and compute per-professional averages.

Add imports at top of `page.tsx`:
```typescript
import { NpsScoreCard } from '@/components/analytics/nps-score-card'
import { NpsTrendChart } from '@/components/analytics/nps-trend-chart'
import { NpsPorProfesional } from '@/components/analytics/nps-por-profesional'
import { FeedbackUrgente } from '@/components/analytics/feedback-urgente'
import { subDays } from 'date-fns'
```

Add rendering after the 4-stat grid (inside `<div className="flex-1 overflow-y-auto...">`):
```tsx
{/* NPS Section */}
<div className="mt-2 flex flex-col gap-4">
  <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Satisfacción de Pacientes (NPS)</p>
  <NpsScoreCard score={npsScore} count={fb30.length} tendencia={npsTendencia} />
  <NpsTrendChart weeks={npsWeeks} />
  <NpsPorProfesional rows={npsPorProf} />
  <FeedbackUrgente items={urgente} />
</div>
```

- [ ] **Step 7: Type-check**

```bash
cd C:\Users\noyag\Norberto-Documentos\AlPunto-kit\dashboard
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts app/dashboard/analytics/page.tsx components/analytics/
git commit -m "feat(dashboard): sección NPS en Analytics — score, trend, por profesional, feedback urgente"
```

---

## Task 7: API Routes — Campañas + Configuración

**Files:**
- Create: `app/api/campanas/crear/route.ts`
- Create: `app/api/campanas/enviar/route.ts`
- Create: `app/api/campanas/[id]/route.ts`
- Create: `app/api/configuracion/route.ts`

All routes follow the existing pattern: `createClient()` from `@/lib/supabase/server`, `getRole()` check, `NextResponse.json()`.

The n8n WF-CAMPANAS webhook URL will be set as env var `N8N_CAMPANAS_WEBHOOK_URL`. Its path will be known after Task 9.

- [ ] **Step 1: Create `app/api/campanas/crear/route.ts`**

```typescript
// app/api/campanas/crear/route.ts
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { nombre, template_key, audiencia_tipo, audiencia_valor, mensaje_custom, programada_para } = body

  if (!nombre || !template_key || !audiencia_tipo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Calculate destinatarios count
  let destinatariosQuery = supabase.from('clientes').select('id', { count: 'exact', head: true }).not('telefono_wa', 'is', null)
  if (audiencia_tipo === 'especialidad' && audiencia_valor) {
    const { data: profs } = await supabase.from('barberos').select('id').eq('especialidad', audiencia_valor)
    const profIds = (profs ?? []).map(p => p.id)
    if (profIds.length > 0) {
      const { data: pacIds } = await supabase.from('turnos').select('paciente_id').in('profesional_id', profIds)
      const uniq = [...new Set((pacIds ?? []).map(t => t.paciente_id))]
      destinatariosQuery = supabase.from('clientes').select('id', { count: 'exact', head: true }).in('id', uniq)
    }
  }
  const { count: total } = await destinatariosQuery

  const { data, error } = await supabase.from('campanas').insert({
    nombre, template_key, audiencia_tipo, audiencia_valor: audiencia_valor || null,
    mensaje_custom: mensaje_custom || null,
    programada_para: programada_para || null,
    total_destinatarios: total ?? 0,
    estado: 'borrador',
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campana: data })
}
```

- [ ] **Step 2: Create `app/api/campanas/enviar/route.ts`**

```typescript
// app/api/campanas/enviar/route.ts
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { campana_id } = await req.json()
  if (!campana_id) return NextResponse.json({ error: 'campana_id requerido' }, { status: 400 })

  // Mark as enviando
  await supabase.from('campanas').update({ estado: 'enviando' }).eq('id', campana_id)

  // Trigger n8n WF-CAMPANAS
  const webhookUrl = process.env.N8N_CAMPANAS_WEBHOOK_URL
  if (!webhookUrl) return NextResponse.json({ error: 'N8N_CAMPANAS_WEBHOOK_URL not configured' }, { status: 500 })

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': process.env.DASHBOARD_SECRET_KEY ?? '' },
      body: JSON.stringify({ campana_id }),
    })
    if (!res.ok) throw new Error(`n8n returned ${res.status}`)
  } catch (e) {
    await supabase.from('campanas').update({ estado: 'borrador' }).eq('id', campana_id)
    return NextResponse.json({ error: 'Error al disparar campaña' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `app/api/campanas/[id]/route.ts`**

```typescript
// app/api/campanas/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: campana } = await supabase.from('campanas').select('*').eq('id', params.id).single()
  if (!campana) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const { count: respondieron } = await supabase
    .from('AlPunto_campana_envios')
    .select('*', { count: 'exact', head: true })
    .eq('campana_id', params.id)
    .eq('estado', 'respondio')

  return NextResponse.json({ campana: { ...campana, total_respondieron: respondieron ?? 0 } })
}
```

- [ ] **Step 4: Create `app/api/configuracion/route.ts`**

```typescript
// app/api/configuracion/route.ts
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase.from('config').select('clave, valor')
  return NextResponse.json({ config: Object.fromEntries((data ?? []).map(r => [r.clave, r.valor])) })
}

export async function PATCH(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates: Record<string, string> = await req.json()
  for (const [clave, valor] of Object.entries(updates)) {
    await supabase.from('config')
      .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/campanas/ app/api/configuracion/
git commit -m "feat(api): rutas campanas (crear, enviar, detalle) + configuracion GET/PATCH"
```

---

## Task 8: Campañas Dashboard Page

**Files:**
- Create: `app/dashboard/campanas/page.tsx`
- Create: `app/dashboard/campanas/campanas-client.tsx`
- Create: `components/campanas/campanas-list.tsx`
- Create: `components/campanas/nueva-campana-modal.tsx`
- Create: `components/campanas/campana-estado-badge.tsx`
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Add Campañas to sidebar NAV**

In `components/layout/sidebar.tsx`, add entry to the `NAV` array after `analytics`:

```typescript
{ href: '/dashboard/campanas', label: 'Campañas', icon: '📣', roles: ['dueno'] as UserRole[] },
```

- [ ] **Step 2: Create `components/campanas/campana-estado-badge.tsx`**

```typescript
// components/campanas/campana-estado-badge.tsx
type Estado = 'borrador' | 'enviando' | 'completada' | 'cancelada'

const styles: Record<Estado, string> = {
  borrador: 'bg-[#21262d] text-[#8b949e]',
  enviando: 'bg-blue-900/40 text-blue-400',
  completada: 'bg-green-900/40 text-green-400',
  cancelada: 'bg-red-900/40 text-red-400',
}

const labels: Record<Estado, string> = {
  borrador: 'Borrador', enviando: 'Enviando…', completada: 'Completada', cancelada: 'Cancelada',
}

export function CampanaEstadoBadge({ estado }: { estado: string }) {
  const e = (estado as Estado) || 'borrador'
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${styles[e] ?? styles.borrador}`}>
      {labels[e] ?? estado}
    </span>
  )
}
```

- [ ] **Step 3: Create `components/campanas/campanas-list.tsx`**

```typescript
// components/campanas/campanas-list.tsx
import type { Campana } from '@/lib/types'
import { CampanaEstadoBadge } from './campana-estado-badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TEMPLATE_LABELS: Record<string, string> = {
  reactivacion: 'Reactivación',
  control_anual: 'Control anual',
  libre: 'Mensaje libre',
}

interface Props { campanas: Campana[]; onNueva: () => void }

export function CampanasList({ campanas, onNueva }: Props) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#f0f6fc]">Campañas</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">{campanas.length} campaña{campanas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onNueva}
          className="bg-[#1B3D8F] hover:bg-[#2251c5] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
          + Nueva campaña
        </button>
      </div>

      {campanas.length === 0 ? (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-10 text-center">
          <p className="text-[#8b949e] text-sm">Todavía no hay campañas.</p>
          <p className="text-[#8b949e] text-xs mt-1">Creá una para enviar mensajes masivos a tus pacientes.</p>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0d1117] text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">
                <th className="text-left px-5 py-3">Nombre</th>
                <th className="text-left px-5 py-3">Template</th>
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-right px-5 py-3">Enviados</th>
                <th className="text-left px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {campanas.map(c => (
                <tr key={c.id} className="border-t border-[#21262d] hover:bg-[#1a1f2e] transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-[#e6edf3]">{c.nombre}</td>
                  <td className="px-5 py-3 text-sm text-[#8b949e]">{TEMPLATE_LABELS[c.template_key] ?? c.template_key}</td>
                  <td className="px-5 py-3 text-sm text-[#8b949e]">
                    {c.programada_para
                      ? format(new Date(c.programada_para), "d MMM HH:mm", { locale: es })
                      : format(new Date(c.created_at), "d MMM", { locale: es })}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-[#8b949e]">{c.total_destinatarios}</td>
                  <td className="px-5 py-3"><CampanaEstadoBadge estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Create `components/campanas/nueva-campana-modal.tsx`**

```typescript
// components/campanas/nueva-campana-modal.tsx
'use client'
import { useState } from 'react'
import type { Campana } from '@/lib/types'

const TEMPLATES = [
  { key: 'reactivacion', label: 'Reactivación', desc: 'Para pacientes que no vienen hace tiempo. Incluye botón de booking.' },
  { key: 'control_anual', label: 'Control anual', desc: 'Recordatorio de chequeo anual. Incluye botón de booking.' },
  { key: 'libre', label: 'Mensaje libre', desc: 'Texto personalizado (máx. 100 chars). Sin botón.' },
]

const AUDIENCIAS = [
  { key: 'todos', label: 'Todos los pacientes' },
  { key: 'especialidad', label: 'Por especialidad' },
  { key: 'dormidos', label: 'Dormidos más de X días' },
]

interface Props {
  onClose: () => void
  onCreated: (c: Campana) => void
}

export function NuevaCampanaModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1)
  const [template, setTemplate] = useState('')
  const [audiencia, setAudiencia] = useState('todos')
  const [audienciaValor, setAudienciaValor] = useState('')
  const [mensajeCustom, setMensajeCustom] = useState('')
  const [nombre, setNombre] = useState('')
  const [programar, setProgramar] = useState(false)
  const [programadaPara, setProgramadaPara] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/campanas/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre || `Campaña ${new Date().toLocaleDateString('es-AR')}`,
          template_key: template,
          audiencia_tipo: audiencia,
          audiencia_valor: audienciaValor || null,
          mensaje_custom: template === 'libre' ? mensajeCustom : null,
          programada_para: programar && programadaPara ? new Date(programadaPara).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onCreated(data.campana)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear campaña')
      setSaving(false)
    }
  }

  async function enviar(campanaId: string) {
    const res = await fetch('/api/campanas/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campana_id: campanaId }),
    })
    if (!res.ok) setError('Campaña creada pero no se pudo enviar. Intentá de nuevo.')
    else onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md flex flex-col gap-0 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#21262d]">
          <div>
            <h2 className="text-sm font-bold text-[#f0f6fc]">Nueva campaña</h2>
            <p className="text-xs text-[#8b949e] mt-0.5">Paso {step} de 4</p>
          </div>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3] text-lg">✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 min-h-[280px]">
          {/* Step 1: Template */}
          {step === 1 && (
            <>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Elegí el template</p>
              {TEMPLATES.map(t => (
                <button key={t.key} onClick={() => setTemplate(t.key)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${template === t.key ? 'border-[#4BA3F5] bg-[#172554]' : 'border-[#30363d] hover:border-[#4BA3F5]/40'}`}>
                  <p className="text-sm font-semibold text-[#f0f6fc]">{t.label}</p>
                  <p className="text-xs text-[#8b949e] mt-0.5">{t.desc}</p>
                </button>
              ))}
              {template === 'libre' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#8b949e]">Mensaje personalizado <span className="font-normal">(máx. 100 chars)</span></label>
                  <textarea value={mensajeCustom} onChange={e => setMensajeCustom(e.target.value.slice(0, 100))}
                    rows={3} maxLength={100}
                    className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5] resize-none"
                    placeholder="Ej: Ya llegaron los turnos de invierno. ¡Agendá el tuyo!" />
                  <p className="text-xs text-[#8b949e] text-right">{mensajeCustom.length}/100</p>
                </div>
              )}
            </>
          )}

          {/* Step 2: Audience */}
          {step === 2 && (
            <>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Audiencia</p>
              {AUDIENCIAS.map(a => (
                <button key={a.key} onClick={() => setAudiencia(a.key)}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${audiencia === a.key ? 'border-[#4BA3F5] bg-[#172554]' : 'border-[#30363d] hover:border-[#4BA3F5]/40'}`}>
                  <p className="text-sm font-semibold text-[#f0f6fc]">{a.label}</p>
                </button>
              ))}
              {audiencia === 'especialidad' && (
                <input value={audienciaValor} onChange={e => setAudienciaValor(e.target.value)}
                  placeholder="Ej: Cardiología"
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5]" />
              )}
              {audiencia === 'dormidos' && (
                <div className="flex items-center gap-2">
                  <input type="number" value={audienciaValor} onChange={e => setAudienciaValor(e.target.value)}
                    placeholder="180" min="7" max="365"
                    className="w-24 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5]" />
                  <span className="text-sm text-[#8b949e]">días sin visitar</span>
                </div>
              )}
            </>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Preview del mensaje</p>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
                <p className="text-xs text-[#8b949e] mb-2 font-medium">Así verá el mensaje el paciente:</p>
                {template === 'reactivacion' && (
                  <p className="text-sm text-[#e6edf3] leading-relaxed">Hola <strong>Juan</strong>, hace tiempo que no te vemos en <strong>PoliAlPunto Rivadavia</strong>. ¿Querés agendar un turno? 👇</p>
                )}
                {template === 'control_anual' && (
                  <p className="text-sm text-[#e6edf3] leading-relaxed">Hola <strong>Juan</strong>, es hora de tu control anual en <strong>PoliAlPunto Rivadavia</strong>. ¿Lo agendamos? 👇</p>
                )}
                {template === 'libre' && (
                  <p className="text-sm text-[#e6edf3] leading-relaxed">Hola <strong>Juan</strong>, <strong>PoliAlPunto Rivadavia</strong> te informa: {mensajeCustom || '<mensaje personalizado>'}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#8b949e]">Nombre de la campaña</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder={`Campaña ${new Date().toLocaleDateString('es-AR')}`}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5]" />
              </div>
            </>
          )}

          {/* Step 4: Schedule */}
          {step === 4 && (
            <>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">¿Cuándo enviamos?</p>
              <button onClick={() => setProgramar(false)}
                className={`text-left p-3 rounded-xl border-2 transition-colors ${!programar ? 'border-[#4BA3F5] bg-[#172554]' : 'border-[#30363d] hover:border-[#4BA3F5]/40'}`}>
                <p className="text-sm font-semibold text-[#f0f6fc]">Enviar ahora</p>
              </button>
              <button onClick={() => setProgramar(true)}
                className={`text-left p-3 rounded-xl border-2 transition-colors ${programar ? 'border-[#4BA3F5] bg-[#172554]' : 'border-[#30363d] hover:border-[#4BA3F5]/40'}`}>
                <p className="text-sm font-semibold text-[#f0f6fc]">Programar para después</p>
              </button>
              {programar && (
                <input type="datetime-local" value={programadaPara} onChange={e => setProgramadaPara(e.target.value)}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5]" />
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#21262d] flex items-center justify-between gap-3">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </button>
          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !template}
              className="bg-[#1B3D8F] hover:bg-[#2251c5] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Siguiente →
            </button>
          ) : (
            <button onClick={async () => {
              await crear()
            }} disabled={saving}
              className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Creando…' : 'Confirmar y enviar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

Note: The modal calls `crear()` which creates the campaign. If `programar=false`, the dashboard should also call `enviar` immediately after creation. Adjust `crear()` to call `enviar(data.campana.id)` when not scheduling:

```typescript
async function crear() {
  setSaving(true)
  setError(null)
  try {
    const res = await fetch('/api/campanas/crear', { ... })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    if (!programar) {
      await enviar(data.campana.id)
    } else {
      onCreated(data.campana)
    }
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Error')
    setSaving(false)
  }
}
```

- [ ] **Step 5: Create `app/dashboard/campanas/campanas-client.tsx`**

```typescript
// app/dashboard/campanas/campanas-client.tsx
'use client'
import { useState } from 'react'
import type { Campana } from '@/lib/types'
import { CampanasList } from '@/components/campanas/campanas-list'
import { NuevaCampanaModal } from '@/components/campanas/nueva-campana-modal'

interface Props { initial: Campana[] }

export function CampanasClient({ initial }: Props) {
  const [campanas, setCampanas] = useState(initial)
  const [showModal, setShowModal] = useState(false)

  function handleCreated(c: Campana) {
    setCampanas(prev => [c, ...prev])
    setShowModal(false)
  }

  return (
    <>
      <CampanasList campanas={campanas} onNueva={() => setShowModal(true)} />
      {showModal && (
        <NuevaCampanaModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
```

- [ ] **Step 6: Create `app/dashboard/campanas/page.tsx`**

```typescript
// app/dashboard/campanas/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { CampanasClient } from './campanas-client'

export default async function CampanasPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch { redirect('/login') }
  if (!user) redirect('/login')
  if (getRole(user!.user_metadata) !== 'dueno') redirect('/dashboard')

  const { data: campanas } = await supabase
    .from('campanas')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Campañas" subtitle="Mensajes masivos para tus pacientes" />
      <div className="flex-1 overflow-y-auto p-6">
        <CampanasClient initial={campanas ?? []} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/campanas/ components/campanas/ components/layout/sidebar.tsx
git commit -m "feat(dashboard): página Campañas — lista, wizard 4 pasos, badge estado"
```

---

## Task 9: WF-CAMPANAS — Webhook de Ejecución

**Files:**
- Create: `C:/Users/noyag/wf_campanas_code.js`
- Create: `C:/Users/noyag/create_wf_campanas.js`

- [ ] **Step 1: Write `wf_campanas_code.js`**

```javascript
// WF-CAMPANAS: Webhook POST — ejecuta campaña manual
const helpers = this.helpers;
const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const WA_TOKEN = $env.META_WHATSAPP_TOKEN;
const PHONE_ID = '963190063548521';
const AlPunto_NOMBRE = $env.AlPunto_NOMBRE || 'PoliAlPunto Rivadavia';
const HOST_BOOKING = 'nexo-terra-n8n.6fwciw.easypanel.host';
const DASHBOARD_KEY = 'a5ecd694f6e42087848c3b28561dd0d9ac40ce88b14a212b';
const crypto = require('crypto');

async function supaGet(table, params) {
  try { return await helpers.httpRequest({ method: 'GET', url: `${SUPABASE_URL}/rest/v1/${table}`, qs: params || {}, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }); } catch(e) { return []; }
}
async function supaUpdate(table, filter, data) {
  try { await helpers.httpRequest({ method: 'PATCH', url: `${SUPABASE_URL}/rest/v1/${table}`, qs: filter, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); } catch(e) {}
}
async function supaInsert(table, data) {
  try { return await helpers.httpRequest({ method: 'POST', url: `${SUPABASE_URL}/rest/v1/${table}`, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(data) }); } catch(e) { return null; }
}

async function sendTemplate(phone, templateName, bodyParams, ctaUrl) {
  const components = [{ type: 'body', parameters: bodyParams.map(t => ({ type: 'text', text: t })) }];
  if (ctaUrl) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: ctaUrl }] });
  try {
    await helpers.httpRequest({
      method: 'POST', url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template: { name: templateName, language: { code: 'es_AR' }, components } })
    });
  } catch(e) {}
}

// Auth check
const authKey = $input.first().json?.headers?.['x-dashboard-key'] || '';
if (authKey !== DASHBOARD_KEY) return [{ json: { error: 'Unauthorized' } }];

const campana_id = $input.first().json?.body?.campana_id;
if (!campana_id) return [{ json: { error: 'campana_id required' } }];

// Load campaign
const campanas = await supaGet('campanas', { id: `eq.${campana_id}`, select: '*' });
const campana = campanas?.[0];
if (!campana) return [{ json: { error: 'Campaign not found' } }];

// Build audience
let pacientes = await supaGet('clientes', { select: 'id,nombre,telefono_wa', telefono_wa: 'not.is.null' });

if (campana.audiencia_tipo === 'especialidad' && campana.audiencia_valor) {
  const profs = await supaGet('barberos', { especialidad: `eq.${campana.audiencia_valor}`, select: 'id' });
  const profIds = (profs || []).map(p => p.id);
  if (profIds.length > 0) {
    const turnos = await supaGet('turnos', { select: 'paciente_id', profesional_id: `in.(${profIds.join(',')})` });
    const pacIds = new Set((turnos || []).map(t => t.paciente_id));
    pacientes = (pacientes || []).filter(p => pacIds.has(p.id));
  }
} else if (campana.audiencia_tipo === 'dormidos' && campana.audiencia_valor) {
  const umbral = parseInt(campana.audiencia_valor);
  const cutoff = new Date(Date.now() - umbral * 24 * 60 * 60 * 1000).toISOString();
  const turnos = await supaGet('turnos', { select: 'paciente_id,fecha_hora', estado: 'not.in.(cancelado,auto_cancelado)' });
  const lastTurno = {};
  for (const t of turnos || []) {
    if (!lastTurno[t.paciente_id] || t.fecha_hora > lastTurno[t.paciente_id]) lastTurno[t.paciente_id] = t.fecha_hora;
  }
  pacientes = (pacientes || []).filter(p => !lastTurno[p.id] || lastTurno[p.id] < cutoff);
}

// Send
let enviados = 0;
const firstProf = (await supaGet('barberos', { activo: 'eq.true', select: 'id', limit: '1' }))?.[0]?.id;

for (const p of pacientes || []) {
  const primerNombre = (p.nombre || '').split(' ')[0] || p.nombre;

  if (campana.template_key === 'reactivacion') {
    const bookingToken = crypto.randomUUID();
    const convs = await supaGet('conversaciones', { telefono_wa: `eq.${p.telefono_wa}`, select: '*' });
    const conv = convs?.[0];
    const ctx = conv?.contexto || {};
    ctx.bookingToken = bookingToken;
    ctx.pacienteId = p.id;
    ctx.pacienteNombre = p.nombre;
    if (firstProf) ctx.profesionalId = firstProf;
    if (conv) {
      await supaUpdate('conversaciones', { telefono_wa: `eq.${p.telefono_wa}` }, { estado: 'esperando_booking_web', contexto: ctx });
    } else {
      await supaInsert('conversaciones', { telefono_wa: p.telefono_wa, estado: 'esperando_booking_web', handoff_humano: false, contexto: ctx });
    }
    const bookingUrl = `https://${HOST_BOOKING}/webhook/AlPunto-turnos?token=${bookingToken}`;
    await sendTemplate(p.telefono_wa, 'AlPunto_reactivacion', [primerNombre, AlPunto_NOMBRE], bookingUrl);
  } else if (campana.template_key === 'control_anual') {
    const bookingToken = crypto.randomUUID();
    const convs = await supaGet('conversaciones', { telefono_wa: `eq.${p.telefono_wa}`, select: '*' });
    const conv = convs?.[0];
    const ctx = conv?.contexto || {};
    ctx.bookingToken = bookingToken;
    ctx.pacienteId = p.id;
    ctx.pacienteNombre = p.nombre;
    if (firstProf) ctx.profesionalId = firstProf;
    if (conv) {
      await supaUpdate('conversaciones', { telefono_wa: `eq.${p.telefono_wa}` }, { estado: 'esperando_booking_web', contexto: ctx });
    } else {
      await supaInsert('conversaciones', { telefono_wa: p.telefono_wa, estado: 'esperando_booking_web', handoff_humano: false, contexto: ctx });
    }
    const bookingUrl = `https://${HOST_BOOKING}/webhook/AlPunto-turnos?token=${bookingToken}`;
    await sendTemplate(p.telefono_wa, 'AlPunto_control_anual', [primerNombre, AlPunto_NOMBRE], bookingUrl);
  } else if (campana.template_key === 'libre') {
    const msg = campana.mensaje_custom || '';
    await sendTemplate(p.telefono_wa, 'AlPunto_libre', [primerNombre, AlPunto_NOMBRE, msg], null);
  }

  await supaInsert('AlPunto_campana_envios', {
    campana_id,
    paciente_id: p.id,
    telefono_wa: p.telefono_wa,
    tipo: 'campana',
    estado: 'enviado'
  });
  enviados++;
}

await supaUpdate('campanas', { id: `eq.${campana_id}` }, { estado: 'completada', total_destinatarios: pacientes?.length || 0 });

return [{ json: { campana_id, enviados } }];
```

- [ ] **Step 2: Write `create_wf_campanas.js`**

```javascript
const fs = require('fs');
const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDY4MjJlMS1jMWExLTRiOGUtYmI5OC1jNjM1ZDNhNDE4MDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2ODkzNTE0LCJleHAiOjE3Nzk0MTg4MDB9.r3_wo7cFyxwJUAj00DabfZ2RwjE8XM0BY4EypQNdEIQ';
const HOST = 'nexo-terra-n8n.6fwciw.easypanel.host';
const CODE = fs.readFileSync('C:/Users/noyag/wf_campanas_code.js', 'utf8');
function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({ hostname: HOST, path: `/api/v1${path}`, method, headers: { 'X-N8N-API-KEY': TOKEN, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
      let raw = ''; res.on('data', c => raw += c); res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
async function main() {
  const wf = {
    name: 'AlPunto - WF-CAMPANAS Ejecución Manual',
    nodes: [
      { id: 'camp-webhook', name: 'Webhook Campanas', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-400, 300],
        parameters: { httpMethod: 'POST', path: 'campana-ejecutar', responseMode: 'responseNode', options: {} } },
      { id: 'camp-code', name: 'Campanas Code', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-160, 300],
        parameters: { jsCode: CODE } },
      { id: 'camp-respond', name: 'Respond', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [80, 300],
        parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 } } }
    ],
    connections: {
      'Webhook Campanas': { main: [[{ node: 'Campanas Code', type: 'main', index: 0 }]] },
      'Campanas Code': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] }
    },
    settings: { timezone: 'America/Argentina/Buenos_Aires', errorWorkflow: 'anEe7qyiweYG6Ar0', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
    active: false
  };
  const { status, body } = await api('POST', '/workflows', wf);
  console.log('Create HTTP:', status);
  if (status !== 200) { console.error(body.slice(0, 500)); process.exit(1); }
  const result = JSON.parse(body);
  console.log('Created WF-CAMPANAS id:', result.id);
  console.log('Webhook path: /webhook/campana-ejecutar');
  console.log('Full URL: https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/campana-ejecutar');
  const { status: as } = await api('POST', `/workflows/${result.id}/activate`);
  console.log('Activate HTTP:', as);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run create script**

```bash
node C:/Users/noyag/create_wf_campanas.js
```

Expected:
```
Create HTTP: 200
Created WF-CAMPANAS id: <new_id>
Webhook path: /webhook/campana-ejecutar
Full URL: https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/campana-ejecutar
Activate HTTP: 200
```

- [ ] **Step 4: Set env var in dashboard**

In `.env.local` (or EasyPanel env vars for production):
```
N8N_CAMPANAS_WEBHOOK_URL=https://nexo-terra-n8n.6fwciw.easypanel.host/webhook/campana-ejecutar
```

Also confirm `DASHBOARD_SECRET_KEY=a5ecd694f6e42087848c3b28561dd0d9ac40ce88b14a212b` is set (already in use by other DASH webhooks).

- [ ] **Step 5: End-to-end test**

1. Go to `/dashboard/campanas` (logged in as dueno)
2. Click "Nueva campaña"
3. Select template "Mensaje libre", write a short message
4. Audience: "Todos los pacientes"
5. Step 4: "Enviar ahora" → Confirmar
6. Verify in n8n: execution log shows WF-CAMPANAS ran successfully
7. Verify in Supabase: `SELECT * FROM AlPunto_campana_envios ORDER BY sent_at DESC LIMIT 5`

- [ ] **Step 6: Update memory and commit**

Add WF-CAMPANAS ID to `reference_n8n_nexoterra.md`.

```bash
git add .
git commit -m "feat(n8n): WF-CAMPANAS webhook POST — ejecución de campañas manuales"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| WF08 paso 0 confirmación de datos | Task 2 |
| WF08 PATCH fecha_nacimiento a Supabase | Task 2 (actualizar_datos handler) |
| WF02 eliminar confirmar_datos | Task 3 |
| DB migration (fecha_nacimiento, ultima_reactivacion, 3 new tables) | Task 1 |
| WF-CUMPLEANOS cron 12:00 UTC + template | Task 4 |
| WF-REACTIVACION cron lunes 13:00 UTC + bookingToken + 30d no-repeat | Task 5 |
| NPS en Analytics (4 components) | Task 6 |
| NPS alerta urgente solo rol dueno | Task 6 (analytics page checks role) |
| Campañas API routes | Task 7 |
| Campañas dashboard UI + modal wizard | Task 8 |
| Sidebar nav item Campañas | Task 8 step 1 |
| WF-CAMPANAS webhook execution | Task 9 |
| configuracion GET/PATCH route | Task 7 step 4 |
| AlPunto_campana_envios log for birthday/reactivation | Tasks 4, 5 |

**Not in plan (requires external action — manual task for Carlos):**
- Submitting Meta template approvals for `AlPunto_cumpleanos`, `AlPunto_reactivacion`, `AlPunto_control_anual`, `AlPunto_libre` — needs to be done in Meta Business Manager before the workflows can send outbound messages.
- Setting `AlPunto_NOMBRE` env var in n8n if not already set (falls back to hardcoded value).
