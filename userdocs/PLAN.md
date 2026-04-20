# Update Admin Panel (Minimal + Sidebar) — EPANET Solver

## Ringkasan
- Ubah admin jadi “admin shell” minimalis (tanpa footer) dengan navigasi sidebar kiri ala template admin umum.
- Jadikan `/admin` sebagai **Overview** (dashboard ringkas + alert/status), dan pindahkan daftar user ke `/admin/users` (dengan redirect agar link lama tidak putus).
- Tambahkan halaman “ops” inti yang relevan dengan project saat ini: **Health/Alerts**, **Payments/Transactions**, dan **Maintenance (aman)**.

## Perubahan UX & Informasi Arsitektur (IA)
- **Routing (final)**
  - `/admin` → **Overview**
  - `/admin/users` → **Users list** (migrasi dari halaman `/admin` lama)
  - `/admin/users/[id]` → detail user (tetap)
  - `/admin/reports` & `/admin/reports/[id]` → laporan/CS (tetap)
  - `/admin/payments` → daftar transaksi & rekonsiliasi (baru)
  - `/admin/ledger` → token log (tetap)
  - `/admin/health` → status koneksi/layanan + alert (baru)
  - `/admin/maintenance` → housekeeping data “aman” (baru)
- **Layout admin (sidebar shell)**
  - Sidebar kiri (desktop sticky) berisi: Brand “Admin”, email admin, menu, dan tombol cepat (Back to app, Logout).
  - Konten kanan: header kecil (judul halaman + quick actions) + body.
  - Mobile: sidebar jadi drawer (toggle button), default closed.
- **Gaya visual**
  - Minimal light, flat, whitespace cukup, fokus keterbacaan; komponen tetap pakai Tailwind + komponen UI yang sudah ada (Card/Table/Badge) tapi dipakai lebih hemat.

## Fitur yang Direkomendasikan (sesuai project saat ini)
### 1) Overview (`/admin`)
- KPI ringkas (query dari tabel yang sudah ada):
  - Active users 7d (dari `analyses`)
  - Analyses 24h/7d + failure/processing-stuck count
  - Revenue 7d + paid tx count (dari `transactions`)
  - Open reports (dari `contact_messages`)
- “Alerts” panel (tanpa schema baru, berbasis heuristik aman):
  - **Payments pending terlalu lama** (mis. `transactions.status=pending` lebih dari X menit/jam)
  - **Analyses status `processing` terlalu lama** (indikasi job/backend macet)
  - **Open reports** tinggi
- Quick links: Users, Payments, Reports, Health.

### 2) Health & Notifications (`/admin/health`)
- Health checks server-side (read-only):
  - **Database**: query sederhana (mis. `select 1`) via `getDb()`
  - **Redis/Upstash** (opsional): jika env ada, lakukan operasi ringan (mis. get key) untuk pastikan konek
  - **Config sanity**: tampilkan status env penting (tanpa menampilkan secret) untuk Midtrans/QRIS/Resend
- Ringkas output: “OK / Degraded / Down” + timestamp + error message pendek.
- Tambah tombol “Refresh” (tanpa auto spam; bisa re-render via navigation/refresh).

### 3) Payments Management (`/admin/payments`)
- Tabel transaksi dengan filter: status (pending/paid/failed), rentang tanggal, search orderId/email.
- Aksi admin (pakai pola server action yang sudah ada):
  - Update status (pending/paid/failed) + payment method
  - Tampilan “pending lama” untuk investigasi webhook/payment flow
- Target UX: satu halaman list + detail ringan (opsional) tanpa flow rumit.

### 4) Database Maintenance (Aman) (`/admin/maintenance`)
- “Housekeeping” yang aman & reversible/semi-reversible, tanpa akses SQL bebas / drop DB:
  - Cleanup data expired: `analysis_snapshots` yang `expiresAt < now()`
  - Cleanup OTP lama: `auth_otp_codes` expired/consumed yang sudah lewat N hari
  - (Opsional) Cleanup transaksi pending lama (hanya jika ada kebijakan retensi yang jelas)
- Semua aksi:
  - Require admin (sudah ada `requireAdmin()`)
  - Konfirmasi klik 2x atau “type to confirm” untuk operasi destructive
  - Tampilkan “dry summary” sebelum eksekusi (berapa row yang akan terhapus)
  - Catat audit minimal (opsional tahap berikutnya; lihat “Assumsi & Next”).

## Implementasi (langkah teknis, decision-complete)
- Refactor admin shell:
  - Ganti `src/app/admin/layout.tsx` agar memakai komposisi: `AdminSidebar` + `AdminHeader` + `main`.
  - Replace `AdminNav.tsx` menjadi `AdminSidebarNav` (client) untuk active state via `usePathname()`.
- Pindah halaman users list:
  - Pindahkan isi `src/app/admin/page.tsx` → `src/app/admin/users/page.tsx`.
  - Buat `src/app/admin/page.tsx` baru untuk Overview.
  - Tambahkan redirect untuk kompatibilitas URL (server-side) dari `/admin` lama jika ada link tersisa (atau tampilkan CTA “Users moved to /admin/users” selama 1 rilis, lalu hapus).
- Tambah halaman baru:
  - `src/app/admin/health/page.tsx` (server component) + fungsi health checks di `src/lib/admin-health.ts` (server-only helper).
  - `src/app/admin/payments/page.tsx` (server component) query `transactions` + `users`.
  - `src/app/admin/maintenance/page.tsx` + server actions (baru) untuk cleanup aman.
- Konsistensi style:
  - Gunakan variable warna existing (`cloud-gray`, `expo-black`, dll) dan komponen UI existing; minimalkan dekorasi (lebih sedikit Card besar, lebih banyak section header sederhana).
- Keamanan:
  - Semua route admin tetap gated oleh `requireAdmin()` (layout-level + tindakan server action).
  - Jangan pernah tampilkan secret env; hanya boolean “configured / missing”.

## Test Plan
- Static/type:
  - `npm run typecheck`
  - `next build`
- Manual:
  - Login sebagai admin → akses `/admin` sukses, non-admin → 404, non-login → redirect login.
  - Sidebar: active state benar; mobile drawer bekerja.
  - Navigasi baru: `/admin` (overview), `/admin/users` (list), link detail user tetap.
  - Payments: filter/search jalan; update status via action jalan; revalidate tampilan.
  - Maintenance: tombol cleanup menampilkan preview count, butuh konfirmasi, dan setelah jalan data berkurang sesuai.

## Assumsi & Default
- `/admin` dijadikan **Overview**; daftar user pindah ke `/admin/users`.
- DB tools scope = **Aman** (tanpa SQL bebas / drop DB).
- Visual = **Minimal light** khusus admin.
- Notifikasi awal berbasis indikator dari tabel yang sudah ada (pending lama, processing lama), tanpa menambah schema baru; audit log terpusat bisa ditambahkan sebagai fase berikutnya jika dibutuhkan.
