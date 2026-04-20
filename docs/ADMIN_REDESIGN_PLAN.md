# Admin Panel — Redesign Plan

**Status:** Approved — Siap eksekusi · **Author:** Senior Web Dev Review · **Tanggal:** 2026-04-21
**Scope:** `src/app/admin/**` (Overview, Users, Payments, Reports, Ledger, Health, Maintenance)

---

## 1. Ringkasan Masalah (Audit Singkat)

Audit berdasarkan file aktual: [AdminShell.tsx](src/app/admin/AdminShell.tsx), [AdminSidebar.tsx](src/app/admin/AdminSidebar.tsx), [users/page.tsx](src/app/admin/users/page.tsx), [users/[id]/page.tsx](src/app/admin/users/[id]/page.tsx), [page.tsx](src/app/admin/page.tsx).

### 1.1 Layout boros ruang
- `AdminShell` membatasi konten ke `max-w-[1100px]` ([AdminShell.tsx:22](src/app/admin/AdminShell.tsx#L22)). Di monitor ≥1440px, ±30–40% layar kosong.
- Sidebar fixed `w-64` (256px) memakan ruang tanpa opsi collapse.
- Di mobile, header "Admin / Panel" memakan 1 baris penuh hanya untuk tombol Menu.
- Tabel penting (users, payments) jadi sempit → banyak `overflow-x-auto` + `min-w-[980px]` ([users/page.tsx:159](src/app/admin/users/page.tsx#L159)) yang memaksa scroll horizontal walau layar besar.

### 1.2 Terlalu banyak shape/ornamen
- `rounded-3xl`, `rounded-2xl`, `border-border-lavender`, `bg-cloud-gray/30`, badge warna (amber/red/slate), hover transitions di hampir semua elemen.
- Setiap blok dibungkus `Card` dengan padding tebal → informasi padat malah terasa sparse.
- Banyak `transition` + `active:scale-[0.98]` di tombol kecil → micro-interaction yang tidak dibutuhkan admin, memperberat render pada list panjang.
- Typography berlapis: `text-[11px] uppercase tracking-[0.08em]` label + judul 2xl + subjudul xs → hierarki terlalu dekoratif.

### 1.3 Alur administrator tidak efisien (masalah utama)
Skenario umum: *"User X melaporkan pembayaran tidak masuk, tolong cek & grant token."*

Alur saat ini:
1. Buka `/admin/users` → search email.
2. Klik baris → masuk `/admin/users/[id]`.
3. Scroll ke "Transaksi Terbaru" → klik "Set paid".
4. Scroll ke card "Token" → isi form grant/refund.
5. Kembali ke `/admin/users` untuk user berikutnya → ulang.

Masalah:
- **Konteks hilang setiap navigasi.** Tidak bisa melihat 3 user berurutan tanpa 3x round-trip.
- **Tidak ada quick actions di list.** Balance, last activity, status verified sudah ditampilkan, tapi semua aksi (grant, set paid, verify) cuma di halaman detail.
- **Tidak ada filter.** Hanya `?q=`. Tidak bisa filter "token ≤ 2", "unverified", "punya pending payment", "ada open report".
- **Tidak ada sort.** Urutan hardcoded `createdAt desc`.
- **Tidak ada bulk.** Grant 5 token ke 20 beta-user = 20 kali klik.
- **Halaman detail overload.** 3 card besar + 3 tabel + 2 form dalam 1 view → admin harus scroll untuk satu keputusan kecil.
- **Tidak ada keyboard shortcut / command palette.** Admin panel dipakai berulang tiap hari tapi UX-nya mouse-heavy.
- **Cross-entity lookup manual.** Dari `/admin/payments` yang `pending > 1 jam` tidak ada kolom "user", harus copy order_id.

### 1.4 Konsekuensi teknis
- Banyak `Card`/`rounded-*` = banyak DOM node + painting → list 250 baris users terasa nge-lag saat hover transitions.
- Form server-action dipisah-pisah (`adminUpdateUser`, `adminAdjustTokens`, `adminSetTokens`) bagus untuk backend, tapi UI-nya membuat 3 tombol submit terpisah untuk 1 user.

---

## 2. Prinsip Desain (Target)

1. **Density over decoration.** Admin panel ≠ landing page. Prioritaskan kepadatan informasi; pakai warna hanya untuk sinyal (error/warning).
2. **Full-bleed responsif.** Gunakan seluruh lebar layar. Konten table boleh sampai `100vw - sidebar`.
3. **Aksi di tempat terjadinya informasi.** Jika balance terlihat di list, tombol grant/refund juga ada di list (via popover/inline).
4. **Sort + filter + search = baseline**, bukan fitur tambahan.
5. **Flat, bukan bulat.** `rounded-md` max, tanpa shadow, tanpa `backdrop-blur`. 1 border color global.
6. **Keyboard-first.** `/` fokus search, `j/k` navigate row, `Enter` buka detail, `g u` / `g p` pindah section.
7. **Zero surprise.** Tombol bahaya (set failed, revoke) harus konfirmasi; tombol normal tidak perlu animasi scale.

---

## 3. Rekomendasi Alur Administrator (Yang Benar)

### 3.1 Mental model
Admin panel yang baik adalah **spreadsheet yang bisa ditindak-lanjuti**, bukan CMS. Inspirasi: Retool, Stripe Dashboard, Linear admin.

### 3.2 Struktur baru
```
/admin              → Inbox (bukan "Overview")  - yang butuh aksi HARI INI
/admin/users        → Users table + side-panel detail (no route change on click)
/admin/payments     → Payments table + side-panel
/admin/reports      → Reports queue
/admin/ledger       → Token log (read-only audit)
/admin/health       → System status
/admin/maintenance  → Destructive ops (tetap pisah, jaga-jaga)
```

### 3.3 Inbox (ganti "Overview")
Halaman pertama admin harus menjawab: **"Apa yang butuh saya kerjakan sekarang?"**

Tampilan: 1 list vertikal, grouped by urgency:
- 🔴 **Action needed** — pending payment > 1h, open reports > 24h, stuck analyses > 30m
- 🟡 **Review** — new users hari ini, transaksi paid hari ini (sanity check)
- ⚪ **Info** — counter (active users, revenue) di baris atas, bukan card besar

Satu-satu item bisa di-*resolve* langsung dari sini (inline action), atau "Open" ke table dengan filter sudah terisi.

### 3.4 Users (inti dari request user)
**Table full-width**, kolom:
| Email | Name | Verified | Balance | Last activity | Last paid | Actions |

**Filter bar** (di atas table):
- Search (email/name) — existing
- **Chips preset:** `Unverified`, `Low token (≤2)`, `Has pending payment`, `Has open report`, `Active 7d`, `Inactive 30d+`
- Sort: createdAt / lastAnalysis / balance / (asc/desc)

**Row interactions:**
- Klik row → **slide-over panel dari kanan** (tidak ganti URL / ganti URL dengan `?user=ID` agar shareable). Panel berisi form grant/refund + mini-timeline. **Bisa navigasi user berikutnya dengan `j/k` tanpa tutup panel.**
- Hover row → tombol quick-action muncul di kolom paling kanan: `+Token`, `Verify`, `View`
- Checkbox kiri untuk bulk select → toolbar muncul: `Grant N tokens to selected`, `Export CSV`

**Halaman detail standalone** (`/admin/users/[id]`) tetap ada untuk:
- Link shareable (report ke tim)
- Log lengkap (semua transaksi, semua analisis, semua laporan)
- Tidak perlu dipakai untuk operasi sehari-hari

### 3.5 Payments
- Tambahkan kolom `user email` (saat ini tidak ada di `/admin/payments`).
- Filter chips: `Pending`, `Paid today`, `Failed 7d`, `Pending > 1h`.
- Inline `Set paid` / `Set failed` dengan konfirmasi modal satu klik.
- Link order → panel dengan raw payload Midtrans (untuk debug).

### 3.6 Reports (contact messages)
- Queue style (mirip Intercom): list kiri, thread kanan.
- Status dropdown inline. Reply tidak perlu ganti halaman.

### 3.7 Keyboard shortcuts (global)
| Key | Action |
|---|---|
| `/` | Fokus search |
| `j` / `k` | Next / prev row |
| `Enter` | Buka detail panel |
| `Esc` | Tutup panel |
| `g u` / `g p` / `g r` | Go Users / Payments / Reports |
| `⌘K` | Command palette (jump to user by email, run action) |

---

## 4. Arah Visual (Sebelum → Sesudah)

| Aspek | Sekarang | Target |
|---|---|---|
| Container | `max-w-[1100px]` | `max-w-full px-6` (atau `max-w-screen-2xl` untuk readability) |
| Sidebar | `w-64` fixed, rounded-3xl card | `w-56` flat, collapsible ke `w-12` icon-only |
| Cards | `rounded-3xl` + `bg-white` + `border-border-lavender` di hampir semua blok | Flat section: `border-b` pemisah, rounded-md hanya di input/button |
| Shadows / transitions | Hover transition di setiap tombol, `active:scale-[0.98]` | Hapus. Hanya `hover:bg-*` subtle |
| Badge colors | Amber, red, slate-gray bg solid | Text + dot indicator: `● warn`, `● ok`, `● down` |
| Tabel | `min-w-[980px]` force scroll | Width fluid, sticky header, kolom flex |
| Typography | Uppercase label kecil + 2xl heading di tiap card | 1 page title, label biasa `text-xs text-muted` |
| Density | `py-6 px-4` | `py-3 px-3`, line-height rapat di table |

Palette disederhanakan:
- `fg`, `fg-muted`, `bg`, `bg-subtle`, `border`, `accent` (1 warna aksi), `danger`, `warning`, `success`. Itu saja.

---

## 5. Implementation Plan (Bertahap)

Urutan memprioritaskan *value per jam kerja*. Tiap fase merge-able sendiri.

### Fase 0 — Design tokens & shell (0.5 hari)
- File: `src/app/admin/_ui/`  (folder baru khusus primitif admin)
- Bikin `AdminShell` baru: full-width, sidebar collapsible, no rounded-3xl.
- Ganti semua `Card` di `/admin` dengan `<section>` flat — selektif, bertahap.
- Tambah `AdminPageHeader` component (title + actions kanan) agar konsisten.

### Fase 1 — Users table revamp (1–1.5 hari) · **highest ROI**
- Tambah filter chips + sort header di [users/page.tsx](src/app/admin/users/page.tsx).
- Extend query: accept `?filter=low_token|unverified|pending_payment|open_report&sort=...`.
- Tambah **slide-over panel** client component: baca `?user=ID` search param → render mini form grant + info.
- Quick-action buttons pada row hover: `+5`, `Verify`.
- Keep halaman detail `/admin/users/[id]` tapi simplify (hapus card-in-card).

### Fase 2 — Inbox (ganti Overview) (0.5 hari)
- Rewrite [page.tsx](src/app/admin/page.tsx): query yang sama, tampilan baru (list grouped).
- Tiap item punya link "Resolve" / "Open filtered list" bukan generic card link.

### Fase 3 — Payments parity (0.5 hari)
- Tambah kolom user email (join users pada query).
- Filter chips: pending / paid today / pending>1h.
- Inline set-paid/set-failed pakai konfirmasi modal dari `_ui/`.

### Fase 4 — Keyboard & command palette (1 hari)
- `useKeyboardNav(rows)` hook: j/k/Enter.
- Command palette pakai `cmdk` (library kecil) — jump to user by email, go to section, run "grant N tokens".
- `/` global focus search.

### Fase 5 — Density & polish (0.5 hari)
- Audit semua spacing, hapus `rounded-3xl/2xl` residual.
- Unify badge → dot indicator component.
- Benchmark rendering 250 rows users; target: tidak ada frame drop saat scroll + hover.

### Fase 6 — Reports & Ledger (optional, 0.5 hari)
- Reports: queue-style layout.
- Ledger: sudah read-only, cukup density pass.

**Total estimasi:** 4–5 hari developer senior. Bisa ship fase 1–3 lebih dulu (hasil sudah signifikan).

---

## 6. Acceptance Criteria

Per fase ditandai selesai bila:

- ✅ Di layar 1920px, konten admin mengisi ≥90% lebar viewport (saat ini ~57%).
- ✅ Di layar 375px (mobile), semua table bisa di-scan tanpa scroll horizontal untuk kolom utama (email, balance, status).
- ✅ Grant token ke 1 user dari state "buka /admin" dapat dilakukan dalam **≤ 3 klik dan tanpa ganti route** (saat ini: 4 klik + 2 navigasi).
- ✅ Grant token ke 10 user low-balance dapat dilakukan dalam **1 aksi bulk** (saat ini: 40+ klik).
- ✅ Tidak ada `rounded-3xl` di pages admin.
- ✅ Tidak ada `transition` di elemen non-interaktif.
- ✅ Lighthouse perf score pada `/admin/users` (dengan 250 rows seed) ≥ 90.
- ✅ Keyboard shortcut `/`, `j/k`, `Enter`, `Esc` berfungsi di `/admin/users`.

---

## 7. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Slide-over panel bocor state saat user berpindah baris cepat | Key panel dengan userId, clear form saat unmount; gunakan `useTransition` |
| Filter chips menambah query load (indexable?) | Review index pada `token_balances.balance`, `analyses.created_at`, `transactions.status`. Tambah composite index bila perlu |
| Bulk action tanpa konfirmasi → kecelakaan | Wajib confirm modal untuk ≥ 5 user atau ≥ 50 token total |
| Command palette bertabrakan dengan browser shortcut | Pakai `⌘K` / `Ctrl+K` (industri standard), hindari shortcut OS-reserved |
| Perubahan URL struktur merusak bookmark tim | Pertahankan semua path existing; fitur baru via query param, bukan route baru |

---

## 8. Non-Goals (Eksplisit)

- ❌ Tidak membuat dark mode admin di iterasi ini.
- ❌ Tidak mengubah skema DB.
- ❌ Tidak menambah analytics dashboard baru (chart/grafik) — panel ini untuk ops, bukan BI.
- ❌ Tidak migrasi ke library admin pihak ketiga (Retool/Refine) — overkill untuk skala saat ini.

---

## 9. Keputusan (Sudah Dikonfirmasi)

| # | Keputusan | Jawaban |
|---|---|---|
| 1 | Lebar konten | **Full** — `100vw - sidebar-width`, no max-width cap |
| 2 | Slide-over posisi | **Kanan desktop** (collapsible jadi icon-only). **Bottom sheet toggle default mobile** |
| 3 | Urutan eksekusi | **Mulai Fase 1** — plan detail tiap fase sebelum eksekusi |
| 4 | Command palette | **Tidak perlu** — fokus pada tombol yang jelas & mudah di UI |

---

## 10. Rencana Eksekusi Per Fase

### FASE 0 — Shell & Design Tokens *(prerequisite, ~0.5 hari)*

Dikerjakan **sebelum** Fase 1. Output: layout baru yang tidak merusak halaman lama (isi masih sama, wrapper berubah).

**Tasks:**
- [ ] `F0-1` Rewrite `AdminShell.tsx` — hapus `max-w-[1100px]`, ganti jadi `w-full px-4 lg:px-6`. Sidebar collapsible: desktop default open (`w-56`), bisa collapse ke `w-12` icon-only via toggle button. State disimpan ke `localStorage` agar persisten.
- [ ] `F0-2` Rewrite `AdminSidebar.tsx` — flat style: no `rounded-3xl`, no card wrapper. Nav item: `rounded-md` max. Tambah icon per nav item (text hilang saat collapsed). Tambah collapse toggle button di bawah nav.
- [ ] `F0-3` Buat `src/app/admin/_ui/` folder. Isi awal:
  - `AdminSection.tsx` — ganti `Card` untuk wrapping section: flat border-b, no shadow, no rounded-3xl
  - `StatusDot.tsx` — ganti badge warna jadi `● warn` / `● ok` / `● down` (text + dot)
  - `AdminPageHeader.tsx` — title + optional right-slot actions, konsisten di semua page
- [ ] `F0-4` Update CSS: definisikan 6 token warna di `globals.css` atau `tailwind.config`: `fg`, `fg-muted`, `border-default`, `surface`, `accent`, `danger`. Hapus class dekoratif yang tidak dipakai.
- [ ] `F0-5` Mobile: hapus header "Admin / Panel" di atas konten, ganti jadi hamburger kecil fixed di pojok. Bottom sheet trigger.

**Acceptance:**
- Layout tidak pecah di semua halaman admin yang sudah ada.
- Sidebar collapse/expand berfungsi, state persist.
- Di 1920px: content area mengisi ≥ 90% lebar viewport.

---

### FASE 1 — Users Table Revamp *(inti, ~1.5 hari)*

Ini fase paling high-ROI. Setelah selesai, alur "cek user + grant token" cukup 3 klik tanpa ganti route.

**Tasks:**
- [ ] `F1-1` **Filter chips + sort** — tambah query params `?filter=low_token|unverified|pending_payment|open_report|active_7d&sort=created|last_analysis|balance&dir=asc|desc`. Update server query di `users/page.tsx` accordingly. UI: bar horizontal di atas tabel berisi chip-chip kecil yang bisa aktif/nonaktif (toggle). Sort: klik header kolom.
- [ ] `F1-2` **Tabel full-width** — hapus `min-w-[980px]`. Kolom: `Email + Name` (auto), `Verified` (fixed 80px), `Balance` (fixed 80px), `Last Activity` (fixed 140px), `Actions` (fixed 120px). Sticky header saat scroll.
- [ ] `F1-3` **Slide-over panel** — `UserDetailPanel.tsx` client component. Trigger: klik row. URL berubah ke `?user=ID` agar shareable tapi tidak full navigation. Panel dari kanan (desktop, `w-[420px]`), bottom sheet (mobile, `h-[80vh]`). Panel berisi:
  - Header: email + badge status + tombol "Buka halaman detail →"
  - Token card: balance + bought/used + form adjust (1 form, pilih kind: grant/refund/revoke)
  - Mini timeline: 5 analisis terbaru + 5 transaksi terbaru (compact, no full table)
  - 1 tombol per pending transaction: "Set Paid" / "Set Failed" langsung dari panel
- [ ] `F1-4` **Row quick actions** — kolom Actions di kanan row: `+5 Token` (langsung grant, tanpa buka panel), `•••` dropdown: Verify, View detail, Grant custom. No hover-reveal — selalu visible agar tidak mengejutkan user.
- [ ] `F1-5` **Keyboard nav di tabel** — `j`/`k` pindah row, `Enter` buka panel, `Esc` tutup panel, `/` fokus search. Implementasi via `useKeyboardNav` hook sederhana (tidak perlu library).
- [ ] `F1-6` **Halaman `/admin/users/[id]` simplify** — hapus card-in-card, flatten layout, pakai `AdminSection` dari `_ui/`. Tabel analisis & transaksi tetap ada (full history). Hapus form `adminSetTokens` terpisah — gabung jadi 1 form adjust dengan `kind=set`.

**Acceptance:**
- Grant token ke 1 user: dari `/admin/users`, cari email, klik row, klik grant → ≤ 3 klik, 0 navigasi.
- Grant +5 token dengan `+5 Token` di kolom Actions: 1 klik + confirm.
- Filter `low_token` menampilkan hanya user dengan balance ≤ 2.
- Slide-over tidak menutup saat form submit berhasil (hanya show toast sukses), agar admin bisa lanjut edit hal lain.
- Mobile: panel muncul sebagai bottom sheet, bisa swipe down untuk tutup.

---

### FASE 2 — Inbox (Ganti Overview) *(~0.5 hari)*

**Tasks:**
- [ ] `F2-1` Rewrite `page.tsx` — layout: 4 counter kecil di baris atas (active users 7d, analyses 24h, revenue 7d, failed 7d), plain teks bukan Card besar.
- [ ] `F2-2` **Action list grouped** — query sama seperti sekarang tapi tampil sebagai list flat:
  - Section "Perlu Aksi" (merah/kuning): pending > 1h → link langsung `/admin/payments?filter=pending_old`, stuck analyses → `/admin/health`, open reports ≥ 10 → `/admin/reports?status=open`
  - Section "Hari ini" (netral): pembayaran paid hari ini, user baru hari ini
  - Tiap item: 1 baris teks deskriptif + badge count + link "Buka →"
- [ ] `F2-3` Hapus "Quick Links" card — sudah ada sidebar, duplikat tidak perlu.
- [ ] `F2-4` Timestamp "Terakhir render" pindah ke footer kecil di bawah, bukan di content area.

**Acceptance:**
- Halaman inbox bisa di-scan dalam 5 detik untuk tahu ada masalah atau tidak.
- Tidak ada elemen yang semata-mata dekoratif (tidak ada card shadow, tidak ada rounded-3xl).

---

### FASE 3 — Payments Parity *(~0.5 hari)*

**Tasks:**
- [ ] `F3-1` Tambah kolom `User Email` di tabel payments (join `users` pada query). Klik email → buka user panel langsung (`?user=ID`).
- [ ] `F3-2` Filter chips: `Pending`, `Paid today`, `Failed 7d`, `Pending > 1h`.
- [ ] `F3-3` Inline confirm untuk "Set Paid" / "Set Failed" — pakai `<dialog>` native atau simple popover, bukan navigasi ke halaman lain.
- [ ] `F3-4` Full-width layout (same treatment as Users table, Fase 0).

---

### FASE 4 — Reports Queue *(~0.5 hari)*

**Tasks:**
- [ ] `F4-1` Layout dua kolom: list kiri (subject, user, tanggal, status), konten kanan (thread + status dropdown + reply field jika ada).
- [ ] `F4-2` Filter: `Open`, `In Progress`, `Closed`, `All`.
- [ ] `F4-3` Status update inline (tidak perlu halaman tersendiri untuk ganti status).

---

### FASE 5 — Polish & Audit *(~0.5 hari)*

**Tasks:**
- [ ] `F5-1` Audit semua halaman: tidak ada `rounded-3xl` / `rounded-2xl` tersisa di admin routes.
- [ ] `F5-2` Audit semua tombol: label jelas (bahasa Indonesia konsisten), tidak ada tombol yang berlabel hanya ikon tanpa tooltip.
- [ ] `F5-3` Hapus semua `transition` / `active:scale-[0.98]` di list items dan tabel rows.
- [ ] `F5-4` Ukur rendering: seed 250 user rows di dev, profil React DevTools → target 0 frame drop saat scroll + hover.
- [ ] `F5-5` Test responsivitas: 375px (mobile), 768px (tablet), 1280px, 1920px.
- [ ] `F5-6` Ledger page: density pass saja (sudah read-only, cukup hapus Card wrapper).

---

## 11. Urutan Eksekusi & Checklist

```
[ ] Fase 0  — Shell & tokens        (prerequisite)
[ ] Fase 1  — Users revamp          (mulai di sini setelah Fase 0)
[ ] Fase 2  — Inbox
[ ] Fase 3  — Payments
[ ] Fase 4  — Reports
[ ] Fase 5  — Polish
```

Setiap fase dapat di-commit dan di-preview secara mandiri.

---

*Plan ini telah dikonfirmasi. Mulai dari Fase 0 → Fase 1.*
