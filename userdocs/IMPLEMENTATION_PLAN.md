# Implementation Plan — EPANET Solver Web App
## Versi 1.0 | April 2026

---

## Daftar Isi

1. [Target Directory Structure](#1-target-directory-structure)
2. [Phase 1 — Scaffold & Design System](#2-phase-1--scaffold--design-system)
3. [Phase 2 — Database & Authentication](#3-phase-2--database--authentication)
4. [Phase 3 — Python Serverless Function](#4-phase-3--python-serverless-function)
5. [Phase 4 — Payment Integration](#5-phase-4--payment-integration)
6. [Phase 5 — Complete UI Wiring](#6-phase-5--complete-ui-wiring)
7. [Phase 6 — Hardening & Security](#7-phase-6--hardening--security)
8. [Phase 7 — Deployment](#8-phase-7--deployment)
9. [Critical Decisions](#9-critical-decisions)
10. [Environment Variables](#10-environment-variables)
11. [Integration Dependencies](#11-integration-dependencies)

---

## 1. Target Directory Structure

```
epanet-solver/                        ← repo root (existing)
  scripts/                            ← biarkan, untuk local dev
  api/
    analyze_python.py                 ← Vercel Python serverless function
    epanet/                           ← COPY dari scripts/epanet/ untuk bundling
      __init__.py
      config.py
      network_io.py
      simulation.py
      diameter.py
      optimizer.py
      reporter.py
    requirements.txt                  ← wntr, pandas, numpy
  src/
    app/
      page.tsx                        ← single-page orchestrator (state machine)
      layout.tsx                      ← root layout (Inter font, Snap.js script)
      globals.css                     ← Tailwind base + CSS variables
      api/
        auth/
          [...nextauth]/
            route.ts                  ← NextAuth handler
        token/
          balance/
            route.ts
          create-transaction/
            route.ts
          webhook/
            route.ts
        analyze/
          route.ts                    ← TypeScript proxy (auth + token layer)
        analyses/
          route.ts
        transactions/
          route.ts
    components/
      layout/
        Navbar.tsx
        Footer.tsx
      sections/
        HeroSection.tsx
        HowItWorks.tsx
        UploadZone.tsx
        FileSelectedCard.tsx
        ProcessingState.tsx
        ResultsPanel.tsx
      modals/
        BuyTokenModal.tsx
        AnalysisHistoryModal.tsx
        TransactionHistoryModal.tsx
      ui/                             ← shadcn/ui generated components
    lib/
      auth.ts                         ← NextAuth config (authOptions)
      env.ts                          ← startup env var validation
      midtrans.ts                     ← Midtrans server-side helpers
      resend.ts                       ← Resend email helpers
      utils.ts                        ← cn(), formatRupiah(), etc.
      db/
        schema.ts                     ← Drizzle schema (4 tables)
        index.ts                      ← Drizzle client (NeonDB connection)
        migrations/
    hooks/
      useTokenBalance.ts              ← SWR polling hook
      useFilePreview.ts               ← .inp client-side parser
    types/
      index.ts                        ← shared TypeScript interfaces
  scripts/
    dev_server.py                     ← Flask stub untuk local dev Python (NOT deployed)
  .env.local                          ← secrets (jangan di-commit)
  .env.example                        ← template
  drizzle.config.ts
  next.config.ts
  tailwind.config.ts
  components.json                     ← shadcn/ui config
  package.json
  tsconfig.json
```

---

## 2. Phase 1 — Scaffold & Design System

**Goal**: Next.js berjalan dengan design tokens dari DESIGN.md, semua komponen UI bisa dirender dengan data statis.

**Estimasi**: 1–2 hari

### 2.1 Init Project

```bash
# Di root repo (bukan subdirektori — Vercel butuh root sebagai Next.js project)
npx create-next-app@latest . --typescript --tailwind --app

# Init shadcn/ui
npx shadcn@latest init
# Pilih: Style=Default, Base color=Zinc, CSS variables=yes

# Install shadcn components
npx shadcn@latest add button card dialog input badge toast avatar dropdown-menu progress table
```

### 2.2 Install Dependencies

```bash
# Auth & DB
npm install next-auth@beta @auth/drizzle-adapter drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit

# Payment & Email
npm install midtrans-client resend

# UI & Utilities
npm install swr zod react-dropzone

# Dev
npm install -D @types/node
```

### 2.3 Tailwind Config — Design Tokens

Tambahkan ke `tailwind.config.ts` dari palet warna di DESIGN.md:

```typescript
theme: {
  extend: {
    colors: {
      'cloud-gray':     '#f0f0f3',   // page background
      'expo-black':     '#000000',   // headlines, primary CTA
      'near-black':     '#1c2024',   // body text
      'slate-gray':     '#60646c',   // secondary text
      'mid-slate':      '#555860',
      'silver':         '#b0b4ba',   // tertiary text
      'border-lavender':'#e0e1e6',   // card borders
      'input-border':   '#d9d9e0',   // button & input borders
      'link-cobalt':    '#0d74ce',   // links
    },
    fontFamily: {
      sans: ['Inter', '-apple-system', 'system-ui'],
      mono: ['JetBrains Mono', 'ui-monospace'],
    },
    letterSpacing: {
      'display': '-3px',
      'heading': '-2px',
    },
  },
}
```

Di `globals.css`:
```css
body {
  background-color: #f0f0f3;
}
```

Di `layout.tsx`:
```typescript
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700','800','900'] });
```

### 2.4 Build UI Components (data statis)

Build semua komponen dengan hardcoded placeholder data — validasi visual sebelum logic:

| Komponen | File | Catatan |
|---|---|---|
| Navbar (logged out) | `Navbar.tsx` | Logo kiri + tombol "Masuk dengan Google" |
| Navbar (logged in) | `Navbar.tsx` | Logo + token badge + "Beli Token" + avatar dropdown |
| Hero section | `HeroSection.tsx` | 64px Inter 700, `tracking-[-3px]`, black pill CTA |
| How it works | `HowItWorks.tsx` | 3 card row dengan ikon + deskripsi |
| Upload zone | `UploadZone.tsx` | Drag & drop area dengan `react-dropzone` |
| File selected | `FileSelectedCard.tsx` | Nama file, ukuran, preview counts, tombol analisis |
| Processing state | `ProcessingState.tsx` | shadcn `Progress` + animated step checklist |
| Results panel | `ResultsPanel.tsx` | Summary cards, 2 download buttons |
| Buy token modal | `BuyTokenModal.tsx` | shadcn `Dialog`, 2 package cards |
| Analysis history | `AnalysisHistoryModal.tsx` | shadcn `Dialog` + `Table` |
| Transaction history | `TransactionHistoryModal.tsx` | shadcn `Dialog` + `Table` |
| Footer | `Footer.tsx` | Logo + referensi legal + copyright |

### 2.5 State Machine di `page.tsx`

```typescript
type AppState = 'hero' | 'upload' | 'file-selected' | 'processing' | 'results' | 'error';
```

Transisi state:

```
hero          → upload         : user login berhasil
upload        → file-selected  : file di-drop / dipilih
file-selected → upload         : klik "Ganti File"
file-selected → processing     : klik "Jalankan Analisis"
processing    → results        : API response sukses
processing    → error          : API response gagal
results       → upload         : klik "Analisis File Baru"
```

Pada tahap ini tombol hanya memanggil `setState` — belum ada business logic.

---

## 3. Phase 2 — Database & Authentication

**Goal**: NeonDB connected, Drizzle migration applied, Google OAuth berjalan, user baru otomatis dapat 6 token gratis.

**Estimasi**: 1 hari

### 3.1 Setup NeonDB

1. Buat project di [neon.tech](https://neon.tech) (free tier)
2. Copy connection string ke `.env.local` sebagai `DATABASE_URL`
3. Gunakan **pooled** connection string (bukan direct) untuk serverless

### 3.2 Drizzle Schema (`src/lib/db/schema.ts`)

```typescript
import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id:        text('id').primaryKey(),           // Google OAuth sub
  email:     text('email').unique().notNull(),
  name:      text('name'),
  image:     text('image'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tokenBalances = pgTable('token_balances', {
  id:          serial('id').primaryKey(),
  userId:      text('user_id').references(() => users.id),
  balance:     integer('balance').default(0),
  totalBought: integer('total_bought').default(0),
  totalUsed:   integer('total_used').default(0),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const analyses = pgTable('analyses', {
  id:          serial('id').primaryKey(),
  userId:      text('user_id').references(() => users.id),
  fileName:    text('file_name'),
  status:      text('status'),                  // 'processing' | 'success' | 'failed'
  nodesCount:  integer('nodes_count'),
  pipesCount:  integer('pipes_count'),
  issuesFound: integer('issues_found'),
  issuesFixed: integer('issues_fixed'),
  tokensUsed:  integer('tokens_used').default(6),
  createdAt:   timestamp('created_at').defaultNow(),
});

export const transactions = pgTable('transactions', {
  id:            serial('id').primaryKey(),
  userId:        text('user_id').references(() => users.id),
  orderId:       text('order_id').unique(),     // order ID Midtrans
  package:       text('package'),              // 'starter' | 'value'
  tokens:        integer('tokens'),
  amount:        integer('amount'),            // Rupiah
  status:        text('status'),               // 'pending' | 'paid' | 'failed'
  paymentMethod: text('payment_method'),
  createdAt:     timestamp('created_at').defaultNow(),
  paidAt:        timestamp('paid_at'),
});
```

### 3.3 Migration

```bash
npx drizzle-kit generate    # buat SQL migration files
npx drizzle-kit migrate     # apply ke NeonDB
```

### 3.4 NextAuth Config (`src/lib/auth.ts`)

```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { tokenBalances } from '@/lib/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;  // expose DB user ID ke client
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Seed 6 free tokens — fires exactly once per new user
      await db.insert(tokenBalances).values({
        userId: user.id,
        balance: 6,
        totalBought: 0,
        totalUsed: 0,
      });
    },
  },
});
```

### 3.5 NextAuth Route Handler

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

### 3.6 Token Balance API

```typescript
// src/app/api/token/balance/route.ts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  const balance = await db.query.tokenBalances.findFirst({
    where: eq(tokenBalances.userId, session.user.id),
    columns: { balance: true },
  });
  return Response.json({ balance: balance?.balance ?? 0 });
}
```

### 3.7 `useTokenBalance` Hook

```typescript
// src/hooks/useTokenBalance.ts
import useSWR from 'swr';

export function useTokenBalance() {
  const { data, mutate } = useSWR('/api/token/balance', fetcher, {
    refreshInterval: 5000,    // poll setiap 5 detik
    revalidateOnFocus: true,
  });
  return { balance: data?.balance ?? 0, mutate };
}
```

---

## 4. Phase 3 — Python Serverless Function

**Goal**: `api/analyze_python.py` menerima file `.inp`, jalankan WNTR optimizer, return JSON dengan base64 output + summary stats.

**Estimasi**: 1–2 hari

> **Catatan Naming**: Python function bernama `analyze_python.py` (bukan `analyze.py`) untuk menghindari konflik URL path dengan TypeScript route di `src/app/api/analyze/route.ts`.

### 4.1 Copy Python Modules

Copy `scripts/epanet/` → `api/epanet/` secara literal (bukan symlink — Vercel tidak follow symlink saat bundling).

```bash
cp -r scripts/epanet api/epanet
```

> **Penting**: Setiap perubahan pada logika optimizer di `scripts/epanet/` harus di-mirror ke `api/epanet/`. Tambahkan comment di tiap file:
> ```python
> # CANONICAL SOURCE: scripts/epanet/<filename> — keep in sync
> ```

### 4.2 `api/requirements.txt`

```
wntr==1.2.1
pandas>=1.5.0
numpy>=1.23.0
```

Pin versi WNTR untuk reproducibility. Cek versi lokal: `pip show wntr`.

### 4.3 Modifikasi `optimizer.py`

Tambahkan parameter `max_iterations` agar bisa di-override tanpa mengubah `config.py`:

```python
def optimize_diameters(wn_orig, max_iterations=None):
    from .config import MAX_ITERATIONS as _DEFAULT
    limit = max_iterations if max_iterations is not None else _DEFAULT
    for iteration in range(1, limit + 1):
        # ... existing logic
```

### 4.4 `api/analyze_python.py` — Struktur Utama

```python
import sys, os, json, base64, tempfile, traceback, uuid
from pathlib import Path
from http.server import BaseHTTPRequestHandler
import cgi

# Make bundled epanet package importable
sys.path.insert(0, str(Path(__file__).parent))
os.chdir('/tmp')   # WNTR writes temp files to CWD — must be writable

from epanet.network_io import load_network, export_optimized_inp
from epanet.simulation import run_simulation, evaluate_network
from epanet.optimizer import optimize_diameters
from epanet.reporter import export_markdown_report

MAX_ITERATIONS_SERVERLESS = 15   # vs 50 lokal — tetap dalam 60s Vercel limit

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # 1. Parse multipart/form-data
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST'}
            )
            file_item = form['file']
            
            # 2. Write ke /tmp
            tmp_path = f'/tmp/{uuid.uuid4()}.inp'
            with open(tmp_path, 'wb') as f:
                f.write(file_item.file.read())
            
            # 3. Jalankan optimizer
            start = time.time()
            wn = load_network(tmp_path)
            results_before, violations_before, status_nodes, status_pipes = run_simulation(wn)
            wn_opt, log = optimize_diameters(wn, max_iterations=MAX_ITERATIONS_SERVERLESS)
            results_after, violations_after, _, _ = run_simulation(wn_opt)
            
            # 4. Generate output files
            out_inp = f'/tmp/{uuid.uuid4()}_output.inp'
            out_md  = f'/tmp/{uuid.uuid4()}_report.md'
            export_optimized_inp(wn_opt, out_inp)
            export_markdown_report(wn, wn_opt, results_before, results_after,
                                   violations_before, violations_after, log, out_md)
            
            # 5. Encode ke base64
            with open(out_inp, 'rb') as f: inp_b64 = base64.b64encode(f.read()).decode()
            with open(out_md, 'rb') as f:  md_b64  = base64.b64encode(f.read()).decode()
            
            # 6. Cleanup
            for p in [tmp_path, out_inp, out_md]: os.unlink(p)
            
            response = {
                "success": True,
                "summary": {
                    "iterations": len(log),
                    "issuesFound": len(violations_before),
                    "issuesFixed": len(violations_before) - len(violations_after),
                    "remainingIssues": len(violations_after),
                    "duration": round(time.time() - start),
                    "nodes": wn.num_nodes,
                    "pipes": wn.num_links,
                },
                "files": { "inp": inp_b64, "md": md_b64 }
            }
            self._respond(200, response)
            
        except UserError as e:
            self._respond(422, {"success": False, "refund": False, "error": str(e)})
        except Exception as e:
            traceback.print_exc()
            self._respond(500, {"success": False, "refund": True, "error": "System error"})
    
    def _respond(self, status: int, body: dict):
        body_bytes = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body_bytes))
        self.end_headers()
        self.wfile.write(body_bytes)

class UserError(Exception):
    """File tidak valid — tidak refund token."""
    pass
```

### 4.5 TypeScript Proxy (`src/app/api/analyze/route.ts`)

```typescript
export async function POST(req: Request) {
  // 1. Verifikasi session
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Cek token balance
  const balance = await getBalance(session.user.id);
  if (balance < 6) return Response.json({ error: 'Insufficient tokens' }, { status: 402 });

  // 3. Validasi file
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file?.name.endsWith('.inp')) return Response.json({ error: 'Invalid file type' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: 'File too large' }, { status: 400 });

  // 4. Insert analysis record (status: processing)
  const [analysis] = await db.insert(analyses).values({
    userId: session.user.id,
    fileName: file.name,
    status: 'processing',
    tokensUsed: 6,
  }).returning();

  // 5. Call Python function
  const pythonUrl = process.env.PYTHON_API_URL ?? '/api/analyze_python';
  const pythonRes = await fetch(pythonUrl, { method: 'POST', body: formData });
  const result = await pythonRes.json();

  if (result.success) {
    // 6a. Sukses — debit token atomic
    await db.transaction(async (tx) => {
      await tx.update(tokenBalances)
        .set({ balance: sql`balance - 6`, totalUsed: sql`total_used + 6` })
        .where(and(
          eq(tokenBalances.userId, session.user.id),
          gte(tokenBalances.balance, 6)  // double-check saldo
        ));
      await tx.update(analyses).set({
        status: 'success',
        nodesCount: result.summary.nodes,
        pipesCount: result.summary.pipes,
        issuesFound: result.summary.issuesFound,
        issuesFixed: result.summary.issuesFixed,
      }).where(eq(analyses.id, analysis.id));
    });
    return Response.json(result);
  }

  // 6b. Gagal — jangan debit token
  await db.update(analyses).set({ status: 'failed' }).where(eq(analyses.id, analysis.id));
  return Response.json({ success: false, error: result.error }, { status: 500 });
}
```

### 4.6 Frontend File Preview Hook

Parse file `.inp` di browser (tanpa network call):

```typescript
// src/hooks/useFilePreview.ts
export function parseInpPreview(text: string) {
  const sectionMap: Record<string, string> = {
    '[JUNCTIONS]': 'junctions', '[PIPES]': 'pipes',
    '[RESERVOIRS]': 'reservoirs', '[TANKS]': 'tanks',
  };
  const counts: Record<string, number> = { junctions:0, pipes:0, reservoirs:0, tanks:0 };
  let section = '';
  for (const line of text.split('\n')) {
    const t = line.trim().toUpperCase();
    if (t.startsWith('[')) { section = t.split(/\s/)[0]; continue; }
    if (sectionMap[section] && t && !t.startsWith(';')) counts[sectionMap[section]]++;
  }
  return counts;
}
```

### 4.7 Local Dev Setup

Untuk local development tanpa `vercel dev`:

```python
# scripts/dev_server.py — NOT deployed
from flask import Flask, request, jsonify
import sys
sys.path.insert(0, 'api')

from epanet.network_io import load_network, export_optimized_inp
# ... same logic as analyze_python.py handler

app = Flask(__name__)

@app.route('/api/analyze_python', methods=['POST'])
def analyze():
    # wrap the same optimizer call
    pass

if __name__ == '__main__':
    app.run(port=8000)
```

Set di `.env.local`:
```
PYTHON_API_URL=http://localhost:8000/api/analyze_python
```

---

## 5. Phase 4 — Payment Integration

**Goal**: Token purchase flow berjalan end-to-end: pilih paket → Midtrans Snap modal → bayar → webhook → token masuk.

**Estimasi**: 1–2 hari

### 5.1 Setup Midtrans

1. Daftar di [sandbox.midtrans.com](https://sandbox.midtrans.com)
2. Dapatkan Server Key dan Client Key dari dashboard
3. Tambah ke `.env.local` (lihat bagian [Environment Variables](#10-environment-variables))

### 5.2 `src/lib/midtrans.ts`

```typescript
import MidtransClient from 'midtrans-client';

export const snap = new MidtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

export const PACKAGES = {
  starter: { tokens: 6,  amount: 10000, name: 'Starter 6 Token' },
  value:   { tokens: 18, amount: 25000, name: 'Value 18 Token' },
} as const;

export type PackageKey = keyof typeof PACKAGES;
```

### 5.3 `POST /api/token/create-transaction`

```typescript
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body = z.object({ package: z.enum(['starter', 'value']) }).parse(await req.json());
  const pkg = PACKAGES[body.package];
  const orderId = `EPANET-${session.user.id.slice(0, 8)}-${Date.now()}`;

  // Buat pending record dulu
  await db.insert(transactions).values({
    userId: session.user.id,
    orderId,
    package: body.package,
    tokens: pkg.tokens,
    amount: pkg.amount,
    status: 'pending',
  });

  const snapToken = await snap.createTransactionToken({
    transaction_details: { order_id: orderId, gross_amount: pkg.amount },
    customer_details: { email: session.user.email!, first_name: session.user.name ?? '' },
    item_details: [{ id: body.package, name: pkg.name, price: pkg.amount, quantity: 1 }],
  });

  return Response.json({ snapToken, orderId });
}
```

### 5.4 `POST /api/token/webhook`

```typescript
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.json();

  // Verifikasi Midtrans signature
  const raw = `${body.order_id}${body.status_code}${body.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');
  if (body.signature_key !== expected) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // Idempotency check
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.orderId, body.order_id),
  });
  if (!tx || tx.status === 'paid') return Response.json({ ok: true });   // sudah diproses

  if (['settlement', 'capture'].includes(body.transaction_status)) {
    await db.transaction(async (dbTx) => {
      await dbTx.update(transactions).set({
        status: 'paid',
        paymentMethod: body.payment_type,
        paidAt: new Date(),
      }).where(eq(transactions.orderId, body.order_id));

      await dbTx.update(tokenBalances).set({
        balance:     sql`balance + ${tx.tokens}`,
        totalBought: sql`total_bought + ${tx.tokens}`,
      }).where(eq(tokenBalances.userId, tx.userId));
    });

    // Fire-and-forget (jangan await)
    sendPaymentConfirmationEmail(tx.userId!, tx.tokens!, tx.amount!);
  }

  return Response.json({ ok: true });
}
```

### 5.5 Load Snap.js di Frontend

Di `src/app/layout.tsx`:
```typescript
import Script from 'next/script';

const isSandbox = process.env.MIDTRANS_IS_PRODUCTION !== 'true';
const snapUrl = `https://app${isSandbox ? '.sandbox' : ''}.midtrans.com/snap/snap.js`;

// Di dalam <body>:
<Script
  src={snapUrl}
  data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
  strategy="lazyOnload"
/>
```

### 5.6 Trigger Snap di `BuyTokenModal.tsx`

```typescript
async function handleBuyPackage(pkg: 'starter' | 'value') {
  const { snapToken } = await fetch('/api/token/create-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package: pkg }),
  }).then(r => r.json());

  // @ts-ignore — snap loaded via CDN
  window.snap.pay(snapToken, {
    onSuccess: () => { closeModal(); mutateBalance(); toast.success('Token berhasil ditambahkan!'); },
    onPending: () => { closeModal(); },
    onError:   () => { toast.error('Pembayaran gagal. Coba lagi.'); },
    onClose:   () => { /* user menutup modal */ },
  });
}
```

---

## 6. Phase 5 — Complete UI Wiring

**Goal**: Semua komponen terhubung ke data real, full user journey berjalan end-to-end.

**Estimasi**: 1–2 hari

### 6.1 Complete State Machine di `page.tsx`

```typescript
interface AnalysisResult {
  summary: {
    iterations: number;
    issuesFound: number;
    issuesFixed: number;
    remainingIssues: number;
    duration: number;
  };
  files: { inp: string; md: string; };   // base64
  fileName: string;
}

// State + handlers di root component
const [appState, setAppState] = useState<AppState>('hero');
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [result, setResult] = useState<AnalysisResult | null>(null);

const { data: session, status } = useSession();
useEffect(() => {
  if (status === 'authenticated') setAppState('upload');
  if (status === 'unauthenticated') setAppState('hero');
}, [status]);
```

### 6.2 Simulated Progress Steps

Karena fetch ke Python adalah satu HTTP call (~10–45 detik), simulasikan progress steps dengan timer:

```typescript
const PROCESSING_STEPS = [
  { label: 'File berhasil dibaca',               durationMs: 1500 },
  { label: 'Simulasi hidrolik dijalankan',        durationMs: 3000 },
  { label: 'Pelanggaran kriteria terdeteksi',     durationMs: 2000 },
  { label: 'Iterasi diameter pipa...',            durationMs: null },   // active sampai selesai
  { label: 'Validasi hasil akhir',                durationMs: 1000 },
];
```

Progress bar linear berdasarkan elapsed time (asumsikan 30 detik total). Ketika fetch resolve, snap ke 100% dan transition ke results.

### 6.3 Download Files

```typescript
function downloadBase64File(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Usage di ResultsPanel.tsx:
downloadBase64File(result.files.inp, 'optimized_network.inp');
downloadBase64File(result.files.md, 'analysis_report.md');
```

### 6.4 Insufficient Token State

```typescript
// FileSelectedCard.tsx
const { balance } = useTokenBalance();

return balance >= 6
  ? <Button onClick={runAnalysis} className="bg-black text-white rounded-full">
      Jalankan Analisis — 6 Token
    </Button>
  : <Button onClick={openBuyModal}
      className="border-amber-500 text-amber-600 rounded-full" variant="outline">
      Beli Token Dulu
    </Button>;
```

### 6.5 History Routes

```typescript
// GET /api/analyses
const history = await db.query.analyses.findMany({
  where: eq(analyses.userId, session.user.id),
  orderBy: [desc(analyses.createdAt)],
  limit: 20,
});

// GET /api/transactions
const txHistory = await db.query.transactions.findMany({
  where: eq(transactions.userId, session.user.id),
  orderBy: [desc(transactions.createdAt)],
  limit: 20,
});
```

### 6.6 Toast Notifications

| Event | Pesan |
|---|---|
| User baru login | "Selamat datang! 6 token gratis sudah ditambahkan 🎉" |
| Analisis selesai | "Analisis selesai — hasil siap diunduh" |
| Token berhasil dibeli | "Token berhasil ditambahkan!" |
| File tidak valid | "File tidak dapat dibaca. Pastikan berasal dari EPANET." |
| Saldo tidak cukup | "Saldo token tidak cukup" |
| System error | "Terjadi kesalahan sistem. Token dikembalikan." |
| Timeout | "Proses terlalu lama. Coba jaringan yang lebih kecil." |

---

## 7. Phase 6 — Hardening & Security

**Goal**: Rate limiting, input validation, error taxonomy, dan production-ready security.

**Estimasi**: 1 hari

### 7.1 Rate Limiting

Gunakan Upstash Redis ([upstash.com](https://upstash.com), free tier):

```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();   // UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

export const analyzeRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),   // 10 analisis/jam/user
  prefix: 'analyze',
});

export const tokenRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 m'),    // 3 pembelian/menit/user
  prefix: 'token',
});
```

Alternatif tanpa Upstash (gunakan NeonDB):
```typescript
const recentCount = await db.select({ count: count() })
  .from(analyses)
  .where(and(
    eq(analyses.userId, userId),
    gt(analyses.createdAt, sql`NOW() - INTERVAL '1 hour'`)
  ));
if (recentCount[0].count >= 10) return tooManyRequests();
```

### 7.2 Zod Validation di Semua Routes

```typescript
// Contoh di create-transaction
const schema = z.object({
  package: z.enum(['starter', 'value']),
});

const body = schema.safeParse(await req.json());
if (!body.success) return Response.json({ error: 'Invalid input' }, { status: 400 });
```

### 7.3 Environment Variable Validation (`src/lib/env.ts`)

```typescript
const required = [
  'DATABASE_URL', 'NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'RESEND_API_KEY',
] as const;

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

Import di `layout.tsx` agar crash saat startup, bukan saat runtime.

### 7.4 Python Error Taxonomy

```python
class UserError(Exception):
    """File tidak valid — user salah. Token TIDAK dikembalikan."""
    pass

class SystemError(Exception):
    """Error dari sistem kami. Token DIKEMBALIKAN."""
    pass
```

Response JSON:
```json
{ "success": false, "refund": true|false, "error": "..." }
```

### 7.5 Orphaned Transaction Cleanup

```typescript
// Di create-transaction: cleanup jika Midtrans API call gagal
try {
  const snapToken = await snap.createTransactionToken(...);
  return Response.json({ snapToken });
} catch (err) {
  // Hapus pending record agar tidak jadi orphan
  await db.delete(transactions).where(eq(transactions.orderId, orderId));
  return Response.json({ error: 'Payment service error' }, { status: 502 });
}
```

---

## 8. Phase 7 — Deployment

**Goal**: Production deployment di Vercel, end-to-end verified.

**Estimasi**: ½ hari

### 8.1 Pre-deployment Checklist

- [ ] Push semua code ke GitHub
- [ ] `.gitignore` berisi: `.env.local`, `node_modules/`, `.next/`, `__pycache__/`, `*.pyc`
- [ ] `api/epanet/` sudah ada dan sync dengan `scripts/epanet/`
- [ ] `api/requirements.txt` ada dan benar
- [ ] Semua env vars ada di `.env.example`

### 8.2 Vercel Setup

1. Vercel → New Project → Import dari GitHub
2. Vercel auto-detect Next.js + Python function di `api/`
3. Tambahkan semua env vars dari `.env.local`
4. Deploy

### 8.3 Post-deployment Config

**Google OAuth** — tambahkan di Google Cloud Console:
```
https://<your-project>.vercel.app/api/auth/callback/google
```

**Midtrans** — set di sandbox dashboard:
```
Payment Notification URL: https://<your-project>.vercel.app/api/token/webhook
```

**NeonDB Production Migration**:
```bash
DATABASE_URL=<production_url> npx drizzle-kit migrate
```

**Update env vars untuk production**:
```
NEXTAUTH_URL=https://<your-project>.vercel.app
MIDTRANS_IS_PRODUCTION=false   # tetap sandbox sampai tested
```

### 8.4 Smoke Test Checklist

- [ ] User baru login Google → 6 token muncul di navbar
- [ ] Upload sample `.inp` → preview node/pipa/reservoir muncul
- [ ] Jalankan analisis → processing state → hasil muncul
- [ ] Kedua file bisa diunduh (`.inp` dan `.md`)
- [ ] Token balance berkurang 6 setelah analisis
- [ ] Saldo < 6 → tombol ganti jadi "Beli Token Dulu"
- [ ] "Beli Token" → Midtrans sandbox popup → test payment → saldo update
- [ ] Riwayat Analisis menampilkan record
- [ ] Logout → login ulang → saldo tetap sama

---

## 9. Critical Decisions

| Decision | Pilihan | Alasan |
|---|---|---|
| Python function naming | `api/analyze_python.py` | Hindari konflik URL dengan TypeScript route `/api/analyze` |
| `api/epanet/` management | Literal copy (bukan symlink) | Vercel tidak follow symlinks saat bundling |
| MAX_ITERATIONS serverless | 15 (vs 50 lokal) | Stay dalam 60s Vercel Hobby execution limit |
| Token debit timing | SETELAH Python berhasil | Hindari kehilangan token karena system error |
| Balance update mechanism | SWR polling 5 detik | Simpler dari WebSocket; cukup untuk use case ini |
| File persistence | Tidak disimpan | Base64 → React state → download; NeonDB storage tetap ~0 |
| Rate limiting backend | Upstash Redis | Free tier, zero tambahan infrastruktur besar |
| Progress display | Simulated timer | Fetch Python adalah 1 HTTP call; progress di-animate client-side |
| WNTR temp files | `os.chdir('/tmp')` | Vercel Lambda filesystem read-only kecuali `/tmp` |
| ORM | Drizzle (bukan Prisma) | ~80MB lebih ringan; Prisma query engine perlambat cold start |

---

## 10. Environment Variables

File `.env.local` (jangan di-commit):

```bash
# Database
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# NextAuth
NEXTAUTH_SECRET=<32-byte random: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# Midtrans
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx   # sama, expose ke browser

# Resend
RESEND_API_KEY=re_xxxxx

# Python API — hanya untuk local dev, tidak diperlukan di Vercel
PYTHON_API_URL=http://localhost:8000

# Upstash Redis — untuk rate limiting (Phase 6)
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx
```

---

## 11. Integration Dependencies

Urutan dependencies antar phase — jangan mulai phase berikutnya sebelum dependency selesai:

| Boundary | Dependency |
|---|---|
| Phase 1 → 2 | `AppState` type dan `page.tsx` state machine harus ada sebelum auth state bisa di-wire |
| Phase 2 → 3 | `auth()` helper dari Phase 2 dipakai di TypeScript proxy Phase 3 |
| Phase 2 → 3 | Tabel `token_balances` harus exist sebelum analyze route bisa baca/tulis saldo |
| Phase 3 → 5 | Shape JSON response dari Python function harus final sebelum `ResultsPanel.tsx` di-wire |
| Phase 4 → 5 | `BuyTokenModal.tsx` butuh `snapToken` endpoint dari Phase 4 |
| Phase 4 → 5 | `useTokenBalance` hook harus exist sebelum insufficient-token state di Phase 5 bisa jalan |
| Phase 2+3 → 6 | Rate limiting butuh user IDs (Phase 2) dan analyze route (Phase 3) |
| All → 7 | Semua phase harus complete dan tested secara lokal sebelum deploy ke Vercel |

---

## Estimasi Total

| Phase | Estimasi |
|---|---|
| Phase 1 — Scaffold & Design System | 1–2 hari |
| Phase 2 — Database & Auth | 1 hari |
| Phase 3 — Python Serverless | 1–2 hari |
| Phase 4 — Payment Integration | 1–2 hari |
| Phase 5 — UI Wiring | 1–2 hari |
| Phase 6 — Hardening | 1 hari |
| Phase 7 — Deployment | ½ hari |
| **Total** | **~8–12 hari** |

Termasuk waktu setup accounts eksternal: NeonDB, Google Cloud Console, Midtrans sandbox, Resend, Upstash.

---

*Dokumen ini adalah acuan pengembangan EPANET Solver v1.0 — Web Application*  
*Dibuat berdasarkan PRD_EPANET_Solver.md dan DESIGN.md*
