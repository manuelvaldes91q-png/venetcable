# System Patterns: MikroTik RouterOS v6 Monitoring System

## Architecture Overview

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout + metadata
│   ├── page.tsx                  # Redirect to dashboard
│   ├── globals.css               # Tailwind + dark theme
│   ├── dashboard/
│   │   ├── page.tsx              # Main monitoring dashboard
│   │   └── devices/
│   │       └── page.tsx          # Device management
│   └── api/
│       ├── devices/route.ts      # CRUD for devices
│       ├── metrics/route.ts      # Metrics collection + history
│       └── dashboard/route.ts    # Dashboard summary data
├── components/
│   └── ui/
│       ├── Charts.tsx            # Recharts wrappers (Line, Area, Bar)
│       └── Cards.tsx             # StatCard, DeviceCard
├── db/
│   ├── schema.ts                 # Drizzle schema (5 tables)
│   ├── index.ts                  # Database client
│   ├── migrate.ts                # Migration runner
│   └── migrations/               # Generated SQL migrations
└── lib/
    ├── mikrotik.ts               # RouterOS API client wrapper
    ├── crypto.ts                 # AES-256-GCM encryption
    └── utils.ts                  # Formatting helpers
```

## Key Design Patterns

### 1. MikroTik API Integration Pattern
Uses `node-routeros` for TCP API communication. Each metric type (system, interfaces, firewall) has a dedicated fetch function that:
- Creates a connection per operation (no persistent connections)
- Uses RouterOS v6 compatible commands (avoids v7-specific params)
- Closes connections in `finally` blocks
- Returns typed data structures

### 2. Encryption Pattern
Credentials stored encrypted with AES-256-GCM:
- IV generated per encryption
- Auth tag for integrity verification
- Key derived via scrypt from `MIKROTIK_ENCRYPTION_SECRET` env var
- Format: `iv:tag:ciphertext`

### 3. Data Collection Pattern
- POST `/api/metrics` triggers on-demand collection
- Metrics stored in SQLite with device foreign keys
- 24-hour retention for historical queries
- Auto-refresh on frontend (30s dashboard, 15s charts)

### 4. Server Components by Default
- API routes handle all DB and MikroTik operations
- Dashboard is a client component for real-time updates
- Device management is a client component for form handling

## Database Schema

```
devices → system_metrics (1:N)
devices → interface_metrics (1:N)
devices → routing_metrics (1:N)
devices → firewall_metrics (1:N)
```

## Styling Conventions
- Dark theme (gray-900 background, gray-800 cards)
- Status colors: green (online), red (offline), yellow (unknown)
- Chart colors: blue, green, red, yellow, purple for different metrics
