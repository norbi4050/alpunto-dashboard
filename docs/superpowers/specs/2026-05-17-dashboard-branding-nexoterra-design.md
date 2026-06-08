# Dashboard Branding — Nexo Terra Design Spec

## Goal

Aplicar identidad visual de Nexo Terra al dashboard AlPunto Inteligente: logo en 3 puntos clave (login, sidebar footer, topbar), actualizar accent color a los azules de marca, mantener al cliente como protagonista.

## Decisiones de diseño

**Estrategia de marca:** B — Cliente protagonista. El nombre del AlPunto (`NEXT_PUBLIC_BARBERIA_NOMBRE`) es la marca prominente en el header del sidebar. Nexo Terra aparece de forma discreta como "by Nexo Terra" en el footer y como logomark pequeño en el topbar.

**Ubicaciones del logo:**
1. **Login page** — Reemplazar emoji 🏥 por `nexo-terra-logo.png` (48px, a color). El nombre del cliente sigue siendo el h1 debajo del logo.
2. **Sidebar footer** — Debajo del row de usuario/logout existente, agregar segunda fila con logomark (14px, invertido blanco, opacity 30%) + texto "by Nexo Terra".
3. **Topbar** — Logomark pequeño (18px, invertido blanco, opacity 35%) + label "Nexo Terra" en el lado derecho, antes de cualquier `children` de acciones.

**Colores:**
- Accent: de `#58a6ff` (azul GitHub) a `#4BA3F5` (sky blue de marca Nexo Terra).
- Botón login: de verde `#238636` a navy `#1B3D8F` de marca.
- Nuevos tokens Tailwind: `nt-navy: '#1B3D8F'`, `nt-sky: '#4BA3F5'`.
- Nav activo: `#1f3460` → `#172554` (más cercano al navy de marca).

**Favicon:** Ya está en `public/favicon.ico`. Agregar `icons` a metadata de root layout.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `tailwind.config.ts` | Agregar tokens `nt-navy`, `nt-sky`; actualizar `dash-accent` |
| `app/login/page.tsx` | Logo imagen + botón navy |
| `components/layout/sidebar.tsx` | Header refinado + fila "by Nexo Terra" en footer |
| `components/layout/topbar.tsx` | Logomark Nexo Terra en lado derecho |
| `app/layout.tsx` | Metadata favicon |

## Asset

`public/nexo-terra-logo.png` — logo oficial PNG, ya copiado al proyecto (197 KB).
