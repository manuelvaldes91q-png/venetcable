# Active Context: MikroTik RouterOS v6 Monitoring System

## Current State

**Status**: Panel de monitoreo profesional estilo Grafana en español, con tráfico WAN en tiempo real, latencia/pérdida de paquetes, monitoreo de antenas, y gestión de dispositivos.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] **MikroTik Monitoring System**:
  - [x] Database schema (5 tables: devices, system_metrics, interface_metrics, routing_metrics, firewall_metrics)
  - [x] AES-256-GCM encryption for credential storage
  - [x] MikroTik API client via node-routeros (RouterOS v6 compatible)
  - [x] Device CRUD API (`/api/devices`)
  - [x] Metrics collection & history API (`/api/metrics`)
  - [x] Dashboard summary API (`/api/dashboard`)
  - [x] Grafana-style dashboard with Recharts (CPU, Memory, Traffic, Firewall charts)
  - [x] Device management page with add/remove
  - [x] Auto-refresh polling (30s dashboard, 15s metrics)
- [x] **Antenna Monitoring Module**:
  - [x] Database tables: `antennas` (name, ssid, frequency, channel width, mode, location) + `antennaReadings` (signal, noise, CCQ, rates, clients)
  - [x] API CRUD for antennas (`/api/antennas` — GET/POST/PATCH/DELETE)
  - [x] API for readings (`/api/antennas/readings` — GET/POST)
  - [x] Antenna dashboard page (`/dashboard/antennas`) with manual entry forms
  - [x] Signal quality indicators (Excellent/Good/Fair/Poor/Bad)
  - [x] Historical charts: Signal & Noise, SNR, CCQ over time
  - [x] Reading history table with full detail
- [x] **Rediseño Profesional Grafana**:
  - [x] Paleta de colores Grafana exacta (#0b0c0e, #181b1f, #2c3039, #3b82f6, #73bf69, #f2495c)
  - [x] Top navigation bar con branding y navegación activa
  - [x] Panel styling (borde sutil, header, body) para todos los componentes
  - [x] Gauges circulares para CPU y RAM en tarjetas de dispositivos
  - [x] Gradientes suaves en gráficos de área (Recharts)
  - [x] Tooltip oscuro profesional con sombra
  - [x] Tablas con hover rows y estilo uniforme
  - [x] Botones con categorías (primary, secondary, danger, success)
  - [x] Inputs/selects estilizados acorde al tema
  - [x] Indicadores de estado con glow (verde/rojo/naranja)
  - [x] Interfaz 100% en español
  - [x] Componente TopNav compartido con reloj en vivo
- [x] **Monitoreo WAN y Latencia**:
  - [x] Campo `wanInterfaceName` en tabla devices para marcar interfaz WAN
  - [x] Tabla `latency_metrics` (rttMin, rttAvg, rttMax, packetLoss, jitter)
  - [x] Utilidad de ping (`src/lib/ping.ts`) con execFile ping nativo
  - [x] Recolección de latencia paralela a métricas MikroTik
  - [x] Panel de tráfico WAN con tasas Rx/Tx en tiempo real
  - [x] Selector de interfaz WAN en el dashboard
  - [x] Gráfico de tráfico WAN (Mbps descarga/subida)
  - [x] Gráficos de latencia RTT (min/avg/max), pérdida de paquetes, jitter
  - [x] Indicadores de calidad de latencia (Excelente/Buena/Regular/Alta)

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Redirects to dashboard | ✅ Ready |
| `src/app/layout.tsx` | Root layout with metadata | ✅ Ready |
| `src/app/globals.css` | Dark theme styles | ✅ Ready |
| `src/app/dashboard/page.tsx` | Main monitoring dashboard | ✅ Ready |
| `src/app/dashboard/devices/page.tsx` | Device management | ✅ Ready |
| `src/app/api/devices/route.ts` | Device CRUD API | ✅ Ready |
| `src/app/api/metrics/route.ts` | Metrics collection API | ✅ Ready |
| `src/app/api/dashboard/route.ts` | Dashboard data API | ✅ Ready |
| `src/db/schema.ts` | Database schema (5 tables) | ✅ Ready |
| `src/db/index.ts` | Database client | ✅ Ready |
| `src/db/migrate.ts` | Migration runner | ✅ Ready |
| `src/lib/mikrotik.ts` | MikroTik API client | ✅ Ready |
| `src/lib/crypto.ts` | AES-256-GCM encryption | ✅ Ready |
| `src/lib/utils.ts` | Formatting utilities | ✅ Ready |
| `src/components/ui/Charts.tsx` | Chart components (Line, Area, Bar) | ✅ Ready |
| `src/components/ui/Cards.tsx` | StatCard, DeviceCard components | ✅ Ready |
| `src/app/dashboard/antennas/page.tsx` | Antenna monitoring page | ✅ Ready |
| `src/app/api/antennas/route.ts` | Antenna CRUD API | ✅ Ready |
| `src/app/api/antennas/readings/route.ts` | Antenna readings API | ✅ Ready |
| `drizzle.config.ts` | Drizzle ORM config | ✅ Ready |

## Tech Stack Additions

| Technology | Purpose |
|------------|---------|
| `node-routeros` | MikroTik RouterOS API client |
| `recharts` | Chart visualization library |
| `drizzle-orm` | SQLite ORM |
| `@kilocode/app-builder-db` | Database provider |

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-03-25 | MikroTik monitoring system full implementation |
| 2026-03-25 | Antenna monitoring module with manual entry |
| 2026-03-25 | Rediseño profesional estilo Grafana, UI en español |
| 2026-03-25 | WAN traffic monitoring, latency/packet loss with ping |
