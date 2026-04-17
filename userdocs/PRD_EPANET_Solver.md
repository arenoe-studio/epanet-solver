# PRD — EPANET Solver
## Product Requirements Document
### Versi 1.0 | April 2026

---

## Daftar Isi

1. [Overview & Deskripsi Produk](#1-overview--deskripsi-produk)
2. [Problem Statement](#2-problem-statement)
3. [Target User](#3-target-user)
4. [Tech Stack](#4-tech-stack)
5. [Arsitektur Sistem](#5-arsitektur-sistem)
6. [Database Schema](#6-database-schema)
7. [Fitur Lengkap](#7-fitur-lengkap)
8. [Single Page Layout & Konten](#8-single-page-layout--konten)
9. [Sistem Token & Pricing](#9-sistem-token--pricing)
10. [Payment Flow — Midtrans](#10-payment-flow--midtrans)
11. [Workflow User End-to-End](#11-workflow-user-end-to-end)
12. [API Routes](#12-api-routes)
13. [Python Processing Logic](#13-python-processing-logic)
14. [Error States & Edge Cases](#14-error-states--edge-cases)
15. [Keamanan & Validasi](#15-keamanan--validasi)

---

## 1. Overview & Deskripsi Produk

**Nama Produk:** EPANET Solver

**Tagline:** *Upload. Analisis. Optimasi. Selesai.*

**Deskripsi:**
EPANET Solver adalah web application berbasis SaaS yang mengotomasi proses analisis dan optimasi jaringan distribusi air bersih. User cukup upload file `.inp` dari EPANET, sistem akan menjalankan simulasi hidrolik menggunakan solver Python (WNTR), mendeteksi pelanggaran kriteria teknis berdasarkan **Permen PU No. 18/PRT/M/2007**, mengiterasi diameter pipa secara otomatis, dan menghasilkan dua output yang siap diunduh:

- **`optimized_network.inp`** — file jaringan yang sudah dioptimasi, langsung bisa dibuka di EPANET
- **`analysis_report.md`** — laporan lengkap berisi Before vs After, log iterasi, dan rekomendasi

**Nilai Utama:**
Proses yang biasanya membutuhkan berjam-jam trial-error manual di EPANET, diselesaikan dalam hitungan detik secara otomatis.

---

## 2. Problem Statement

Mahasiswa teknik sipil dan lingkungan yang mengerjakan skripsi atau tugas perancangan jaringan distribusi air bersih menghadapi tantangan berulang:

- Iterasi manual di EPANET membutuhkan waktu lama dan banyak trial-error
- Tidak semua mahasiswa hafal kriteria teknis Permen PU yang harus dipenuhi
- Kesalahan kecil pada diameter satu pipa bisa mempengaruhi seluruh jaringan
- Tidak ada tools gratis atau murah yang bisa mengotomasi proses ini

EPANET Solver hadir untuk menyelesaikan ketiga masalah tersebut dalam satu klik.

---

## 3. Target User

**Primer:** Mahasiswa teknik sipil / teknik lingkungan tingkat akhir (semester 6–8) yang mengerjakan tugas perancangan atau skripsi tentang jaringan distribusi air bersih.

**Sekunder:** Dosen pembimbing yang ingin memvalidasi desain mahasiswa dengan cepat.

**Karakteristik User:**
- Sudah familiar dengan EPANET desktop
- Memiliki file `.inp` yang sudah dibuat sendiri
- Butuh hasil cepat untuk validasi atau laporan akhir
- Sensitif terhadap harga — lebih suka bayar sedikit daripada gratis tapi ribet

---

## 4. Tech Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| **Framework** | Next.js (App Router) | SSR, API Routes, file-based routing dalam satu project |
| **Styling** | Tailwind CSS | Utility-first, cepat, konsisten |
| **Komponen UI** | shadcn/ui | Komponen siap pakai, accessible, mudah dikustomisasi |
| **Auth** | NextAuth.js (Google OAuth) | Setup cepat, session management built-in |
| **Database** | NeonDB (PostgreSQL serverless) | Free tier cukup, serverless cocok untuk Vercel |
| **ORM** | Drizzle ORM | Type-safe, ringan, cocok dengan NeonDB |
| **Python Runtime** | Vercel Python Functions (`/api/analyze.py`) | Satu project, tidak perlu server terpisah |
| **Python Library** | WNTR + pandas + pathlib | Solver EPANET, analisis data, file handling |
| **File Sementara** | Vercel `/tmp` (ephemeral) | Otomatis hapus setelah request selesai |
| **Payment** | Midtrans Snap.js | Paling umum di Indonesia, support QRIS/VA/e-wallet |
| **Email** | Resend | Notifikasi transaksi token berhasil |
| **Deployment** | Vercel | Free tier cukup, auto-deploy dari GitHub |

### Catatan NeonDB — Free Tier

NeonDB free tier sudah lebih dari cukup untuk aplikasi ini:
- **0.5 GB storage** — lebih dari cukup, kita hanya simpan metadata ringan
- **Tidak simpan file** — `.inp` dan output hanya di `/tmp` selama proses request
- **3 tabel sederhana** — users, token_balances, analyses
- Tidak perlu upgrade kecuali sudah ratusan user aktif per hari

### Catatan Vercel Python Functions

File Python diletakkan di `/api/analyze.py` dan dipanggil sebagai serverless function. Batasan yang perlu diperhatikan:
- Maksimal execution time: **60 detik** (Vercel Hobby plan)
- Maksimal payload: **4.5 MB** — file `.inp` biasanya jauh di bawah ini
- Dependencies: tambahkan `wntr` dan `pandas` di `requirements.txt`

---

## 5. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────┐
│                   USER BROWSER                       │
│  Upload .inp → Klik Analisis → Download Output       │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS
┌───────────────────▼─────────────────────────────────┐
│                 VERCEL (Next.js)                      │
│                                                       │
│  ┌─────────────────┐    ┌──────────────────────────┐ │
│  │  Next.js Pages  │    │  API Routes (TypeScript) │ │
│  │  /              │    │  /api/auth (NextAuth)    │ │
│  │  (single page)  │    │  /api/token/buy          │ │
│  │                 │    │  /api/token/balance      │ │
│  └─────────────────┘    │  /api/analyze (Python)   │ │
│                          └──────────┬───────────────┘ │
└─────────────────────────────────────┼───────────────┘
                    ┌─────────────────┼──────────────┐
                    │                 │              │
          ┌─────────▼──┐    ┌────────▼───┐   ┌──────▼──────┐
          │  NeonDB     │    │  Midtrans  │   │  Google     │
          │ (PostgreSQL)│    │  Payment   │   │  OAuth      │
          │  users      │    │  Gateway   │   │             │
          │  tokens     │    │            │   │             │
          │  analyses   │    └────────────┘   └─────────────┘
          └─────────────┘
```

---

## 6. Database Schema

### Tabel: `users`
```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,        -- dari Google OAuth (sub)
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  image       TEXT,                    -- foto profil Google
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### Tabel: `token_balances`
```sql
CREATE TABLE token_balances (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  balance       INTEGER DEFAULT 0,    -- saldo token saat ini
  total_bought  INTEGER DEFAULT 0,    -- total token yang pernah dibeli
  total_used    INTEGER DEFAULT 0,    -- total token yang pernah dipakai
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

### Tabel: `analyses`
```sql
CREATE TABLE analyses (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT REFERENCES users(id),
  file_name       TEXT,               -- nama file .inp asli
  status          TEXT,               -- 'success' | 'failed' | 'processing'
  nodes_count     INTEGER,
  pipes_count     INTEGER,
  issues_found    INTEGER,            -- jumlah pelanggaran yang ditemukan
  issues_fixed    INTEGER,            -- jumlah yang berhasil diperbaiki
  tokens_used     INTEGER DEFAULT 6,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### Tabel: `transactions`
```sql
CREATE TABLE transactions (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT REFERENCES users(id),
  order_id        TEXT UNIQUE,        -- order ID Midtrans
  package         TEXT,               -- 'starter' | 'value'
  tokens          INTEGER,            -- jumlah token yang dibeli
  amount          INTEGER,            -- harga dalam Rupiah
  status          TEXT,               -- 'pending' | 'paid' | 'failed'
  payment_method  TEXT,               -- 'qris' | 'bca_va' dll
  created_at      TIMESTAMP DEFAULT NOW(),
  paid_at         TIMESTAMP
);
```

---

## 7. Fitur Lengkap

### 7.1 Authentication
- Login dengan Google (satu klik, tanpa isi form)
- Session persisten dengan NextAuth
- User baru otomatis mendapat **6 token gratis** (1x analisis) saat pertama kali login
- Logout kapan saja

### 7.2 Upload & Analisis
- Drag & drop atau click to upload file `.inp`
- Validasi format file di frontend (hanya `.inp`)
- Validasi isi file di backend (cek struktur EPANET valid)
- Progress indicator saat analisis berjalan
- Debit 6 token otomatis setelah analisis berhasil

### 7.3 Output yang Dihasilkan
- **`optimized_network.inp`** — file EPANET yang sudah dioptimasi
- **`analysis_report.md`** — laporan lengkap (lihat detail di bagian 13)
- Kedua file tersedia untuk diunduh selama sesi browser aktif
- File **tidak disimpan** ke server setelah diunduh / sesi berakhir

### 7.4 Sistem Token
- Tampilan saldo token di navbar (real-time)
- 1 analisis = 6 token
- Tombol beli token yang mudah diakses
- Riwayat transaksi sederhana

### 7.5 Pembelian Token — Midtrans
- Popup pilih paket token
- Redirect ke Midtrans Snap (modal payment)
- Support: QRIS, BCA/Mandiri/BNI VA, GoPay, OVO, Dana
- Token otomatis ditambah setelah pembayaran berhasil (webhook)
- Notifikasi email konfirmasi pembelian

### 7.6 Riwayat Analisis
- Tabel sederhana: nama file, tanggal, status, jumlah masalah ditemukan/diperbaiki
- Tidak ada download ulang (file sudah tidak tersimpan)
- Fungsi utama: tracking progress skripsi / referensi

---

## 8. Single Page Layout & Konten

> Semua konten berada dalam **satu halaman** (`/`). Tampilan berubah berdasarkan state: belum login, sudah login idle, processing, dan hasil siap.

---

### 8.1 NAVBAR

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ EPANET Solver          🪙 12 Token    [Beli Token]  [Foto User ▾] │
└─────────────────────────────────────────────────────────┘
```

**Elemen:**
- Logo + nama aplikasi (kiri) — klik refresh halaman
- Saldo token dengan ikon koin (tengah-kanan) — hanya muncul jika sudah login
- Tombol "Beli Token" — outline button, buka modal pembelian
- Avatar foto Google user dengan dropdown (kanan):
  - Nama & email
  - Riwayat Analisis
  - Riwayat Transaksi
  - Logout

**State belum login:**
```
│  ⚡ EPANET Solver                        [Masuk dengan Google] │
```

---

### 8.2 HERO SECTION

**Tampil ketika:** User belum login ATAU sudah login tapi belum upload file.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│           ⚡ EPANET Solver                                  │
│                                                             │
│    Analisis & Optimasi Jaringan Distribusi Air Bersih      │
│                   Otomatis dalam Detik                      │
│                                                             │
│   Upload file .inp → sistem menganalisis → download hasil  │
│                                                             │
│   ✓ Sesuai Permen PU No. 18/2007   ✓ Iterasi Otomatis     │
│   ✓ Output siap buka di EPANET     ✓ Laporan lengkap       │
│                                                             │
│              [ Mulai dengan Google ]                        │
│                                                             │
│         Gratis 6 token untuk pengguna baru                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy Detail:**
- Headline: `Analisis & Optimasi Jaringan Distribusi Air Bersih Otomatis dalam Detik`
- Subheadline: `Upload file .inp EPANET kamu, biarkan sistem yang iterasi diameter pipa secara otomatis sesuai standar Permen PU No. 18/2007. Download hasilnya dan buka langsung di EPANET.`
- CTA: `Mulai dengan Google` (tombol besar, dengan ikon Google)
- Social proof: `Gratis 6 token untuk pengguna baru — cukup untuk 1x analisis lengkap`

---

### 8.3 HOW IT WORKS (Di Bawah Hero)

Hanya tampil di hero state (belum upload). 3 langkah sederhana:

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│    📁    │    │    ⚙️    │    │    📥    │
│          │ →  │          │ →  │          │
│  Upload  │    │ Analisis │    │ Download │
│ file .inp│    │ Otomatis │    │  Hasil   │
└──────────┘    └──────────┘    └──────────┘
  Drag & drop    Sistem cek      2 file siap:
  file EPANET    pressure,       .inp optimasi
  kamu           velocity &      + laporan .md
                 headloss,
                 lalu perbaiki
```

---

### 8.4 UPLOAD ZONE

**Tampil ketika:** User sudah login, belum ada file dipilih.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              ┌───────────────────────────┐                 │
│              │                           │                 │
│              │   📁                      │                 │
│              │                           │                 │
│              │  Drag & drop file .inp    │                 │
│              │  atau klik untuk pilih    │                 │
│              │                           │                 │
│              │  Hanya file .inp EPANET   │                 │
│              │  Maks. 10 MB              │                 │
│              │                           │                 │
│              └───────────────────────────┘                 │
│                                                             │
│                    Saldo: 🪙 6 token                        │
│              1x analisis menggunakan 6 token               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 8.5 FILE SELECTED STATE

**Tampil ketika:** File sudah dipilih, belum dijalankan.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   📄 jaringan_distribusi.inp              [✕ Ganti File]   │
│   Ukuran: 24 KB                                            │
│                                                             │
│   Preview deteksi otomatis:                                │
│   • 17 junctions terdeteksi                               │
│   • 21 pipa terdeteksi                                     │
│   • 1 reservoir terdeteksi                                 │
│   • Unit: LPS | Headloss: Hazen-Williams                  │
│                                                             │
│            [ 🔄 Jalankan Analisis — 6 Token ]              │
│                                                             │
│   Saldo setelah analisis: 🪙 0 token                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Catatan:** Jika saldo < 6 token, tombol "Jalankan Analisis" diganti dengan tombol "Beli Token Dulu" berwarna orange.

---

### 8.6 PROCESSING STATE

**Tampil ketika:** Analisis sedang berjalan.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              ⚙️  Sedang menganalisis...                    │
│                                                             │
│   ████████████████████░░░░░░░  75%                        │
│                                                             │
│   ✅ File berhasil dibaca                                  │
│   ✅ Simulasi hidrolik dijalankan                          │
│   ✅ Pelanggaran kriteria terdeteksi                       │
│   🔄 Iterasi diameter pipa... (iterasi ke-4)              │
│   ⏳ Validasi hasil akhir                                  │
│                                                             │
│   Biasanya selesai dalam 10–30 detik                      │
│   Jangan tutup halaman ini                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 8.7 HASIL ANALISIS

**Tampil ketika:** Analisis selesai berhasil.

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Analisis Selesai — jaringan_distribusi.inp              │
│  Selesai dalam 18 detik  |  4 iterasi  |  6 token dipakai  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RINGKASAN HASIL                                           │
│  ┌──────────┬──────────┬──────────┬──────────┐            │
│  │ Masalah  │ Pressure │ Velocity │ Headloss │            │
│  │ Ditemukan│  4 node  │  3 pipa  │  4 pipa  │            │
│  │    11    │  fixed ✅ │  fixed ✅ │  fixed ✅ │            │
│  └──────────┴──────────┴──────────┴──────────┘            │
│                                                             │
│  ⚠️  Catatan: 2 node bertekanan > 80m — pertimbangkan PRV  │
│                                                             │
│  UNDUH HASIL                                               │
│  ┌─────────────────────────┐  ┌─────────────────────────┐ │
│  │  📁 optimized_network   │  │  📄 analysis_report     │ │
│  │       .inp              │  │       .md               │ │
│  │  Buka langsung di EPANET│  │  Laporan lengkap iterasi│ │
│  │  [ Unduh File .inp ]    │  │  [ Unduh Report .md ]   │ │
│  └─────────────────────────┘  └─────────────────────────┘ │
│                                                             │
│              [ 🔄 Analisis File Baru ]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 8.8 MODAL BELI TOKEN

**Tampil ketika:** Klik tombol "Beli Token".

```
┌─────────────────────────────────────┐
│  Beli Token                    [✕]  │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🪙 6 Token                   │  │
│  │  Cukup untuk 1x analisis      │  │
│  │                               │  │
│  │         Rp 10.000             │  │
│  │   [ Beli Paket Ini ]          │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🪙🪙🪙 18 Token    HEMAT 17% │  │
│  │  Cukup untuk 3x analisis      │  │
│  │                               │  │
│  │         Rp 25.000             │  │
│  │   [ Beli Paket Ini ]          │  │
│  └───────────────────────────────┘  │
│                                     │
│  Pembayaran aman via Midtrans       │
│  QRIS • Transfer Bank • GoPay • OVO │
│                                     │
└─────────────────────────────────────┘
```

---

### 8.9 MODAL RIWAYAT ANALISIS

**Tampil ketika:** Klik "Riwayat Analisis" di dropdown user.

```
┌──────────────────────────────────────────────────────┐
│  Riwayat Analisis                              [✕]   │
├──────────────────────────────────────────────────────┤
│  File              Tanggal        Masalah   Status   │
│  ──────────────── ────────────── ──────── ────────  │
│  jaringan_uji.inp  17 Apr 2026    11 fixed  ✅ OK    │
│  ujijij.inp        15 Apr 2026    8 fixed   ✅ OK    │
│  tugas_akhir.inp   10 Apr 2026    —         ❌ Gagal  │
│                                                      │
│  Menampilkan 3 analisis terakhir                     │
└──────────────────────────────────────────────────────┘
```

---

### 8.10 FOOTER

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ EPANET Solver                                           │
│  Alat bantu analisis jaringan distribusi air bersih         │
│                                                             │
│  Referensi: Permen PU No. 18/PRT/M/2007 | SNI 7509:2011   │
│                                                             │
│  © 2026 EPANET Solver  ·  Syarat & Ketentuan  ·  Privasi  │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Sistem Token & Pricing

### Paket Token

| Paket | Token | Harga | Harga per Token | Analisis |
|---|---|---|---|---|
| **Starter** | 6 token | Rp 10.000 | Rp 1.667 | 1x analisis |
| **Value** | 18 token | Rp 25.000 | Rp 1.389 | 3x analisis |
| **Free Trial** | 6 token | Gratis | — | 1x (user baru) |

### Aturan Token

- User baru otomatis dapat **6 token gratis** saat pertama kali login dengan Google
- Token tidak expired — tidak ada batas waktu penggunaan
- Token tidak bisa di-refund setelah analisis dijalankan
- Jika analisis **gagal** karena error sistem (bukan file user yang salah) → token dikembalikan otomatis
- Jika analisis **gagal** karena file `.inp` tidak valid → token **tidak** dikembalikan (sudah diproses)

### Validasi Sebelum Debit Token

```
Sebelum menjalankan analisis dan memotong token:
1. Cek saldo user ≥ 6 token
2. Validasi file .inp bisa dibaca (struktur valid)
3. Deteksi jumlah node & pipa (preview)
4. Tampilkan konfirmasi ke user
5. Baru debit token dan jalankan analisis
```

---

## 10. Payment Flow — Midtrans

### Mengapa Midtrans?

- Paling mudah diintegrasikan dengan Next.js
- Mendukung semua metode pembayaran populer di Indonesia
- Dokumentasi lengkap dan komunitas besar
- **Snap.js** — modal payment siap pakai, tidak perlu build UI sendiri
- Webhook otomatis untuk konfirmasi pembayaran

### Flow Pembayaran

```
1. User klik "Beli Paket" di modal
        ↓
2. Frontend POST ke /api/token/create-transaction
   {package: 'starter', userId: '...'}
        ↓
3. Backend buat order di Midtrans
   → Dapat snap_token
        ↓
4. Frontend buka Midtrans Snap popup
   (modal payment Midtrans muncul)
        ↓
5. User bayar (QRIS / transfer / e-wallet)
        ↓
6. Midtrans kirim webhook ke /api/token/webhook
        ↓
7. Backend verifikasi signature Midtrans
   → Update status transaksi = 'paid'
   → Tambah token ke saldo user
   → Kirim email notifikasi via Resend
        ↓
8. Frontend polling /api/token/balance
   → Saldo token terupdate di navbar
```

### Integrasi di Next.js

```javascript
// /api/token/create-transaction
// Buat transaksi di Midtrans, return snap_token

// /api/token/webhook
// Terima notifikasi dari Midtrans
// Verifikasi signature, update DB

// Frontend: load Snap.js dari CDN Midtrans
// snap.pay(snapToken, { onSuccess, onPending, onError })
```

---

## 11. Workflow User End-to-End

### Skenario 1 — User Baru (Pertama Kali)

```
1. Kunjungi epanet-solver.vercel.app
2. Lihat hero section + penjelasan cara kerja
3. Klik "Mulai dengan Google"
4. Authorize Google OAuth
5. Redirect balik ke halaman utama
6. Toast muncul: "Selamat datang! 6 token gratis sudah ditambahkan 🎉"
7. Navbar menampilkan saldo: 🪙 6 token
8. Upload zone muncul di bawah hero
9. Drag & drop file .inp
10. Preview deteksi muncul (jumlah node, pipa, reservoir)
11. Klik "Jalankan Analisis — 6 Token"
12. Processing state dengan progress steps
13. Hasil muncul dengan ringkasan + 2 tombol download
14. Download file .inp dan/atau .md
15. Buka file .inp di EPANET desktop
```

### Skenario 2 — User Lama, Saldo Habis

```
1. Login → saldo 0 token
2. Upload file .inp
3. Preview muncul
4. Tombol analisis berubah menjadi "Beli Token Dulu"
5. Modal pembelian muncul
6. Pilih paket, bayar via Midtrans
7. Modal tutup, saldo terupdate
8. Tombol analisis aktif kembali
9. Lanjut seperti skenario 1 langkah 11
```

### Skenario 3 — File .inp Tidak Valid

```
1. Upload file dengan ekstensi .inp tapi struktur salah
2. Validasi frontend: ukuran file OK
3. Validasi backend: struktur EPANET tidak valid
4. Toast error: "File tidak dapat dibaca. Pastikan file .inp
   berasal dari EPANET dan tidak rusak."
5. Token TIDAK dipotong
6. User bisa upload ulang
```

---

## 12. API Routes

| Method | Path | Fungsi | Auth |
|---|---|---|---|
| `GET/POST` | `/api/auth/[...nextauth]` | NextAuth handler (Google OAuth) | — |
| `GET` | `/api/token/balance` | Ambil saldo token user | ✅ |
| `POST` | `/api/token/create-transaction` | Buat transaksi Midtrans | ✅ |
| `POST` | `/api/token/webhook` | Terima webhook Midtrans | Midtrans Signature |
| `POST` | `/api/analyze` | Jalankan analisis Python | ✅ |
| `GET` | `/api/analyses` | Ambil riwayat analisis user | ✅ |

### Detail `/api/analyze`

```
Request:
- Method: POST
- Content-Type: multipart/form-data
- Body: { file: File (.inp) }
- Header: Authorization (session token)

Proses:
1. Validasi session user
2. Cek saldo ≥ 6 token
3. Validasi file .inp
4. Simpan ke /tmp sementara
5. Jalankan Python WNTR solver
6. Generate output .inp dan .md
7. Debit 6 token dari saldo
8. Catat ke tabel analyses
9. Return: { inp: base64, md: base64, summary: {...} }

Response sukses:
{
  "success": true,
  "summary": {
    "iterations": 4,
    "issuesFound": 11,
    "issuesFixed": 9,
    "remainingIssues": 2,
    "duration": 18
  },
  "files": {
    "inp": "<base64>",
    "md": "<base64>"
  }
}
```

---

## 13. Python Processing Logic

### File: `/api/analyze.py`

```python
# Alur utama:

# 1. Baca file .inp dari request
# 2. Load ke WNTR: wn = wntr.network.WaterNetworkModel(inp_path)
# 3. Jalankan simulasi awal: results = wntr.sim.EpanetSimulator(wn).run_sim()
# 4. Evaluasi semua node dan pipa terhadap kriteria:
#    - Pressure: 10–80 m
#    - Velocity: 0.3–2.5 m/s
#    - Unit Headloss: ≤ 10 m/km
# 5. Iterasi maksimal 50x:
#    - Untuk setiap pipa bermasalah, sesuaikan diameter
#    - Gunakan ukuran standar: [40,50,63,75,90,110,125,150,200,250,315]
#    - Jalankan ulang simulasi
#    - Hentikan jika semua kriteria terpenuhi atau tidak ada improvement
# 6. Generate output:
#    - optimized_network.inp (via wn.write_inpfile())
#    - analysis_report.md (string builder)
# 7. Return kedua file sebagai base64
```

### Isi `analysis_report.md` yang Dihasilkan

```markdown
# Laporan Analisis Jaringan Distribusi Air Bersih
## EPANET Solver — [tanggal]

### Ringkasan
- File: nama_file.inp
- Total node: 17 | Total pipa: 21
- Masalah ditemukan: 11 | Berhasil diperbaiki: 9
- Iterasi dilakukan: 4
- Durasi: 18 detik

### Hasil Node — Before vs After
| Node | Elevasi | Pressure Awal | Pressure Akhir | Status |
...

### Hasil Pipa — Before vs After
| Pipa | Panjang | D Awal | D Akhir | V Awal | V Akhir | HL Awal | HL Akhir | Status |
...

### Perubahan Diameter
| Pipa | Diameter Lama | Diameter Baru | Alasan |
...

### Masalah yang Tersisa
...

### Log Iterasi
Iterasi 1: ...
Iterasi 2: ...
...
```

---

## 14. Error States & Edge Cases

| Kondisi | Pesan ke User | Tindakan Sistem |
|---|---|---|
| File bukan `.inp` | "Hanya file .inp yang diterima" | Tolak upload, token tidak dipotong |
| File > 10 MB | "Ukuran file terlalu besar (maks 10 MB)" | Tolak upload |
| Struktur `.inp` tidak valid | "File tidak dapat dibaca. Pastikan berasal dari EPANET." | Tolak proses, token tidak dipotong |
| Saldo < 6 token | "Saldo token tidak cukup" | Tampilkan modal beli token |
| Timeout > 60 detik | "Proses terlalu lama. Coba jaringan yang lebih kecil." | Token dikembalikan |
| Python error / crash | "Terjadi kesalahan sistem. Token dikembalikan." | Token dikembalikan, log error |
| Midtrans webhook gagal | — | Retry webhook, jika 3x gagal kirim notifikasi manual |
| Google OAuth gagal | "Login gagal. Coba lagi." | — |
| Semua masalah tidak bisa diperbaiki | Tampilkan hasil dengan catatan | Tetap generate output, debit token |

---

## 15. Keamanan & Validasi

### Authentication
- Semua endpoint `/api/*` (kecuali webhook) wajib session valid
- Session token diverifikasi via NextAuth di setiap request

### File Upload
- Validasi ekstensi `.inp` di frontend dan backend
- Scan ukuran file (maks 10 MB)
- File hanya disimpan di `/tmp` selama proses request
- File otomatis terhapus setelah response dikirim

### Payment
- Verifikasi signature Midtrans di setiap webhook
- Order ID unik per transaksi (UUID)
- Idempotency check — webhook yang sama tidak bisa diproses dua kali

### Database
- Query via Drizzle ORM (mencegah SQL injection)
- User hanya bisa akses data miliknya sendiri
- Token deduction menggunakan database transaction (atomic)

### Rate Limiting
- Maksimal 10 request analisis per user per jam
- Maksimal 3 percobaan beli token per menit

---

## Appendix — Ukuran Diameter Standar

Digunakan dalam iterasi otomatis Python:

```
40 · 50 · 63 · 75 · 90 · 110 · 125 · 150 · 200 · 250 · 315 mm
```

## Appendix — Kriteria Teknis Acuan

| Parameter | Batas | Sumber |
|---|---|---|
| Tekanan minimum | 10 m | Permen PU No. 18/PRT/M/2007 |
| Tekanan maksimum | 80 m | Permen PU No. 18/PRT/M/2007 |
| Kecepatan minimum | 0.3 m/s | Permen PU No. 18/PRT/M/2007 |
| Kecepatan maksimum | 2.5 m/s | Permen PU No. 18/PRT/M/2007 |
| Headloss maksimum | 10 m/km | Permen PU No. 18/PRT/M/2007 |

---

*Dokumen ini disusun sebagai acuan pengembangan EPANET Solver v1.0*
*Semua keputusan teknis dan desain dapat berubah sesuai kebutuhan development*
