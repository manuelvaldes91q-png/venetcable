# Active Context: MikroTik RouterOS v6 Monitoring System

## Current State

**Status**: MikroTik monitoring dashboard fully implemented with device management, real-time metrics collection, and historical charting.

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
