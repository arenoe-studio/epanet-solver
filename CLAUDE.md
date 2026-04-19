# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

EPANET Network Analyzer & Optimizer — a Python engine that loads a water distribution network from an EPANET `.inp` file, runs a hydraulic simulation, checks compliance against Indonesian standard **Permen PU No. 18/2007**, and automatically optimizes pipe diameters to fix violations.

The project has two deployment targets:
- **CLI** (`scripts/`) — local Python tool
- **Web app** (`src/` + `api/`) — Next.js 14 frontend + Vercel serverless Python handler

## Running the Tool

### Python CLI

All commands must be run from the project root (`epanet-solver/`):

```bash
# Run with auto-detected .inp file (searches data_Input/ first)
python scripts/epanet_optimizer.py

# Run with a specific .inp file
python scripts/epanet_optimizer.py --input "data_Input/network.inp"

# Analysis only, skip diameter optimization
python scripts/epanet_optimizer.py --no-optimize
```

**Required Python packages:** `wntr==1.2.1`, `pandas>=1.5.0`, `numpy>=1.23.0`  
Install: `pip install wntr pandas numpy`

**Outputs** (written to `data_output/`):
- `optimized_network.inp` — EPANET-compatible file with updated diameters
- `analysis_report.md` — full per-iteration Markdown report

### Next.js Frontend

```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run db:generate  # Generate Drizzle ORM migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

### Phase 3 Local Dev (Python API + Next.js together)

```bash
# Terminal 1: Python API server on port 8000
python scripts/dev_server.py

# Terminal 2: Next.js frontend
npm run dev
# Set PYTHON_API_URL=http://localhost:8000/api/analyze_python in .env.local
```

### Linting / Syntax Check

```bash
python -m py_compile scripts/epanet_optimizer.py
python -m flake8 scripts/epanet_optimizer.py --max-line-length=120
```

## Code Architecture

```
scripts/
  epanet_optimizer.py      # CLI entry point — orchestrates steps 1–5
  dev_server.py            # Local HTTP server (mirrors Vercel handler for dev)
  epanet/
    config.py              # All thresholds and constants (single source of truth)
    network_io.py          # Load/sanitize .inp → WaterNetworkModel; export .inp
    simulation.py          # run_simulation() + evaluate_network()
    diameter.py            # Analytical Window Method; standard diameter catalog
    optimizer.py           # Iterative optimization loop
    reporter.py            # Markdown report generation

api/
  analyze_python.py        # Vercel serverless handler (BaseHTTPRequestHandler)
  epanet/                  # Bundled copy of scripts/epanet/ for Vercel deployment
  requirements.txt

src/
  app/
    api/
      analyze/             # Calls Python API (Phase 3)
      analyses/            # Analysis history
      auth/                # NextAuth
      token/               # Token balance & transactions
      transactions/        # Transaction history
    page.tsx
  components/              # UI components (layout, modals, sections, ui)
  lib/db/                  # Drizzle ORM schemas
```

**Important:** `api/epanet/` is a manually kept copy of `scripts/epanet/`. When changing core engine logic, update both locations.

### Data Flow (Python Engine)

1. **Load** (`network_io.load_network`) — reads `.inp` via WNTR; auto-sanitizes corrupt `[VERTICES]` sections if the first load fails
2. **Simulate** (`simulation.run_simulation`) — runs WNTR steady-state; computes pressure, velocity, flow, headloss-per-km
3. **Evaluate** (`simulation.evaluate_network`) — checks every node (P-LOW/P-HIGH) and pipe (V-LOW/V-HIGH/HL-HIGH) against Permen PU thresholds; returns `violations` list and per-element status dicts
4. **Optimize** (`optimizer.optimize_diameters`) — iterative loop (max 50 local / 15 serverless):
   - Per pipe: calls `diameter.analytical_optimal_diameter(flow)` → FEASIBLE / INFEASIBLE / CONFLICT
   - Per P-LOW node: bumps upstream pipe diameter one step up
   - Loop exits on CONVERGED / STUCK / STAGNANT
5. **Export** (`network_io.export_optimized_inp` + `reporter.export_markdown_report`)

### Analytical Window Method (`diameter.py`)

The core algorithm avoids trial-and-error. For a given pipe flow Q:
- `D_max_V = sqrt(4Q / π·V_min)` — largest D that keeps velocity ≥ 0.3 m/s
- `D_min_HL = (10.67·1000·Q^1.852 / C^1.852·HL_max)^(1/4.87)` — smallest D that keeps headloss ≤ 10 m/km
- Pick the largest standard diameter within the window `[D_min_HL, D_max_V]`
- CONFLICT when window is empty (HL priority wins, V-LOW accepted)
- INFEASIBLE when flow is too small for any catalog diameter

### Key Constants (`config.py`)

| Constant | Value | Meaning |
|---|---|---|
| `PRESSURE_MIN` | 10 m | Min junction pressure |
| `PRESSURE_MAX` | 80 m | Max junction pressure |
| `VELOCITY_MIN` | 0.3 m/s | Min pipe velocity |
| `VELOCITY_MAX` | 2.5 m/s | Max pipe velocity |
| `HL_MAX` | 10 m/km | Max headloss per km |
| `DIAMETER_SIZES_MM` | [40,50,63,75,90,110,125,150,200,250,315] | Standard catalog |
| `MAX_ITERATIONS` | 50 | Local optimizer cap |
| `MAX_ITERATIONS_SERVERLESS` | 15 | Serverless cap (in `api/analyze_python.py`) |
| `HW_C_DEFAULT` | 130 | Hazen-Williams C (PVC/HDPE) |

### Composite Issue Classification

When a pipe has both V-HIGH and HL-HIGH simultaneously, it's classified as `HL-SMALL` (too small diameter is the root cause). The optimizer targets this composite code, not the individual flags.

### WNTR Quirk

`wn.sim_time = 0` is reset before every `run_simulation()` call to prevent WNTR's `WNTRSimulator` from starting at the end of a prior simulation duration on subsequent iterations.

### Serverless Handler (`api/analyze_python.py`)

Accepts multipart file upload, runs the full analysis pipeline, and returns base64-encoded output files:

```json
{
  "success": true,
  "summary": { "iterations": N, "issuesFound": N, "issuesFixed": N, "remainingIssues": N, "duration": s, "nodes": N, "pipes": N, "fileName": "..." },
  "files": { "inp": "<base64>", "md": "<base64>" }
}
```

HTTP 422 = `UserError` (invalid file, no token refund). HTTP 500 = system error (refund=true).

## Database Schema (`src/lib/db/schema.ts`)

App-specific tables (beyond standard NextAuth adapter tables):

| Table | Key columns | Notes |
|---|---|---|
| `token_balances` | `balance`, `total_bought`, `total_used` | One row per user |
| `analyses` | `status`, `issues_found`, `issues_fixed`, `tokens_used` | `tokens_used` defaults to **6** per analysis |
| `transactions` | `order_id`, `package`, `tokens`, `amount`, `status`, `payment_method` | `status`: pending / paid / failed |

Migrations are generated to `src/lib/db/migrations/`. `drizzle.config.js` manually loads `.env.local` because Drizzle Kit does not auto-load Next.js env files — if `DATABASE_URL` is missing, the Drizzle commands will throw immediately with a clear message. (The config points to `src/lib/db/schema.drizzle.js` to avoid esbuild binary spawning on Windows.)

## Environment Variables

Copy `.env.example` to `.env.local`. Variables are gated by phase:

| Variable | Phase | Purpose |
|---|---|---|
| `DATABASE_URL` | 2+ | PostgreSQL (Neon) connection string |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | 2+ | NextAuth session |
| `RESEND_API_KEY` | 2+ | Email (OTP + transactional) |
| `AUTH_REQUIRE_LOGIN_OTP` | 2+ | Require OTP on login |
| `AUTH_OTP_TTL_MINUTES` | 2+ | OTP expiry (minutes) |
| `PYTHON_API_URL` | 3 (local dev) | Points to `scripts/dev_server.py` |
| `EPANET_SOLVER_MAX_ITERATIONS` | any | Override max optimizer iterations (default 15 in serverless handler) |
| `EPANET_SOLVER_TIME_BUDGET_S` | any | Override optimizer time budget seconds (default 20) |
| `EPANET_SOLVER_SIMULATOR` | any | `auto` / `epanet` / `wntr` (force simulator selection) |
| `EPANET_SOLVER_REQUIRE_EPANET` | any | If `1`, error when EPANET toolkit is unavailable |
| `MIDTRANS_*` | 4+ | Payment gateway |
| `UPSTASH_REDIS_*` | 6+ | Rate limiting |
