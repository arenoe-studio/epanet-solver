# UI Documentation — Halaman Checkout
## EPANET Solver — Spesifikasi Konten & Layout
### Versi 1.0 | April 2026

---

## Daftar Isi

1. [Prinsip Halaman](#1-prinsip-halaman)
2. [Header Halaman](#2-header-halaman)
3. [Bagian Atas — Pemilihan Paket](#3-bagian-atas--pemilihan-paket)
4. [Spesifikasi Card per Paket](#4-spesifikasi-card-per-paket)
5. [Bagian Bawah — Riwayat Pembelian](#5-bagian-bawah--riwayat-pembelian)
6. [Modal Invoice](#6-modal-invoice)
7. [Interaksi Midtrans](#7-interaksi-midtrans)
8. [Urutan & Struktur Lengkap](#8-urutan--struktur-lengkap)

---

## 1. Prinsip Halaman

Halaman checkout memiliki dua fungsi yang berbeda dalam satu halaman: **mendorong keputusan beli** dan **menjadi pusat riwayat transaksi**. Keduanya tidak boleh saling mengganggu — bagian atas fokus pada konversi, bagian bawah fokus pada transparansi dan kepercayaan.

**Tiga prinsip utama:**

- **Jelas sebelum bayar** — user tahu persis apa yang didapat sebelum menekan tombol apapun.
- **Framing, bukan manipulasi** — perbandingan harga dan label badge bersifat informatif, bukan menyesatkan. Semua angka yang ditampilkan akurat.
- **Riwayat selalu ada** — container riwayat selalu tampil meskipun kosong, sehingga user tahu fitur ini ada dan bisa dipercaya.

---

## 2. Header Halaman

**Judul halaman:**
```
Beli Token
```

**Sub-teks di bawah judul** — satu baris, selalu tampil:
```
1 analisis = 5 token  ·  Fix Pressure = 3 token  ·  Token tidak pernah kedaluwarsa
```

**Info saldo** — ditampilkan di sebelah kanan judul atau sebagai baris terpisah di bawah sub-teks:
```
Saldo kamu saat ini: X token
```

Saldo diambil real-time dari database. Jika saldo 0, teks berubah menjadi:
```
Saldo kamu saat ini: 0 token — belum ada token aktif
```

Tidak ada warna merah atau peringatan menakutkan untuk saldo 0 — ini adalah kondisi normal bagi user yang baru selesai memakai token.

---

## 3. Bagian Atas — Pemilihan Paket

**Layout:** Empat card berjajar horizontal dalam satu baris. Di mobile, card stacked vertikal satu per satu.

**Urutan card dari kiri ke kanan:**

```
[ Mau Coba ]  [ Ups Kurang Dikit ]  [ Best Value ★ ]  [ Tenang Sampai Selesai ]
```

Card ketiga (Best Value) adalah **target visual utama** — secara tampilan ia harus "keluar" dari deretan. Cara yang direkomendasikan: card ini memiliki border yang sedikit lebih tebal atau berbeda, tinggi card sedikit lebih besar dari card lain (seolah terangkat), dan badge di bagian atasnya.

**Elemen wajib di setiap card** (dari atas ke bawah):

1. Badge (jika ada) — di atas card, posisi center atau top-left
2. Nama paket
3. Jumlah token — angka besar, prominent
4. Harga utama — besar
5. Harga coret (harga jika beli Paket 1 terus) — kecil, dicoret, hanya untuk Paket 2, 3, 4
6. Baris penghematan — hanya untuk Paket 2, 3, 4
7. Deskripsi kombinasi penggunaan
8. Baris framing kontekstual — satu kalimat pendek
9. Tombol CTA: `Pilih Paket` — full-width di dalam card

Detail spesifik per card dijelaskan di bagian 4.

---

## 4. Spesifikasi Card per Paket

### Card 1 — Mau Coba

```
[tidak ada badge]

Mau Coba
6 token

Rp 8.900
Rp 1.483 / token

Untuk 1x analisis penuh
Cukup untuk mencoba sekali

[ Pilih Paket ]
```

**Treatment visual:** Card standar, tidak ada highlight. Ini disengaja — card ini harus terlihat "biasa" dibanding card lain agar user terdorong melihat opsi yang lebih worth it.

**Tidak ada** harga coret atau baris penghematan karena ini paket terkecil.

---

### Card 2 — Ups Kurang Dikit

```
[tidak ada badge]

Ups Kurang Dikit
13 token

Rp 16.900
~~Rp 26.700~~  Hemat Rp 9.800
Rp 1.300 / token

Untuk 2x analisis + 1x fix pressure
atau 2× beli Paket 1

[ Pilih Paket ]
```

**Harga coret:** `Rp 26.700` adalah harga jika user membeli Paket 1 sebanyak 3 kali untuk mendapat jumlah token setara (`Rp 8.900 × 3`).

**Baris framing:** *"atau 2× beli Paket 1"* — bukan klaim penghematan, tapi perbandingan netral yang memicu kalkulasi sendiri di kepala user.

**Treatment visual:** Card standar, sama dengan Card 1. Card 2 berfungsi sebagai decoy — keberadaannya membuat Card 3 terasa jauh lebih worth it.

---

### Card 3 — Best Value *(Target Utama)*

```
[ 🔥 PALING WORTH IT ]

Best Value
18 token

Rp 19.900
~~Rp 35.600~~  Hemat Rp 15.700
Rp 1.106 / token

Untuk 3x analisis + 1x fix pressure
Lebih murah dari fotokopi + jilid laporan

[ Pilih Paket ]
```

**Harga coret:** `Rp 35.600` adalah harga jika user membeli Paket 1 sebanyak 4 kali (`Rp 8.900 × 4`).

**Baris framing:** *"Lebih murah dari fotokopi + jilid laporan"* — membandingkan dengan pengeluaran nyata yang familiar bagi mahasiswa. Bukan klaim teknis, tapi perbandingan psikologis.

**Treatment visual:** Card ini berbeda secara visual dari tiga card lainnya:
- Border lebih tebal atau warna border berbeda
- Tinggi card lebih besar (posisi card sedikit "terangkat" dari baris)
- Badge `🔥 PALING WORTH IT` di bagian atas card
- Tombol CTA menggunakan style primary yang lebih bold dibanding card lain

---

### Card 4 — Tenang Sampai Selesai

```
[ 💡 UNTUK SKRIPSI ]

Tenang Sampai Selesai
28 token

Rp 27.900
~~Rp 53.400~~  Hemat Rp 25.500
Rp 996 / token

Untuk 5x analisis + 1x fix pressure
Cukup untuk sepanjang semester

[ Pilih Paket ]
```

**Harga coret:** `Rp 53.400` adalah harga jika user membeli Paket 1 sebanyak 6 kali (`Rp 8.900 × 6`).

**Baris framing:** *"Cukup untuk sepanjang semester"* — menarget user yang sudah tahu akan memakai EPANET lebih dari sekali (skripsi, tugas lanjutan).

**Treatment visual:** Card standar dengan badge kecil. Posisinya sebagai anchor — kehadirannya membuat Card 3 terasa terjangkau.

---

### Teks Pendamping di Bawah Keempat Card

Satu baris teks kecil, center-aligned, warna soft:

> *"Semua analisis akurat 100% — token digunakan untuk akses ke output, bukan untuk akurasi perhitungan."*

---

## 5. Bagian Bawah — Riwayat Pembelian

**Posisi:** Di bawah bagian paket, dipisahkan dengan whitespace yang cukup.

**Header sub-bagian:**
```
Riwayat Pembelian
```

**Container riwayat selalu tampil**, terlepas dari apakah user sudah pernah bertransaksi atau belum.

### Kondisi Kosong (Belum Ada Transaksi)

Container tetap terlihat sebagai area yang intentional, bukan area yang "belum jadi". Isinya:

```
[ikon receipt kecil, abu-abu]

Belum ada riwayat pembelian.
Token pertama kamu sudah ditambahkan saat login — coba analisis dulu!
```

Teks kedua hanya muncul jika user masih punya sisa token dari free trial. Jika saldo sudah 0, teks kedua tidak tampil.

### Kondisi Ada Transaksi

Tabel dengan kolom berikut:

| Kolom | Label | Format | Keterangan |
|---|---|---|---|
| 1 | Tanggal | `DD MMM YYYY, HH:mm` | Waktu transaksi dibuat |
| 2 | Paket | teks | Nama paket yang dibeli |
| 3 | Token | angka + `token` | Jumlah token dalam paket |
| 4 | Harga | `Rp X.XXX` | Harga paket |
| 5 | Metode | teks | Metode pembayaran dari Midtrans (QRIS, BCA VA, GoPay, dll) |
| 6 | Status | badge | Lihat tabel status di bawah |
| 7 | Aksi | tombol kecil | Bergantung status — lihat detail di bawah |

### Tabel Status Badge

| Status | Label Badge | Warna | Kondisi |
|---|---|---|---|
| Lunas | `✅ Lunas` | Hijau | Pembayaran dikonfirmasi Midtrans |
| Menunggu | `⏳ Menunggu Pembayaran` | Kuning | Transaksi dibuat, belum dibayar |
| Kedaluwarsa | `❌ Kedaluwarsa` | Abu | Batas waktu pembayaran terlewat |
| Gagal | `❌ Gagal` | Abu | Pembayaran ditolak atau dibatalkan |

### Kolom Aksi — Detail per Status

**Status Lunas:**
```
[ Lihat Invoice ]
```
Klik membuka Modal Invoice (lihat bagian 6). Token sudah masuk ke saldo — tidak ada aksi pembayaran lagi.

**Status Menunggu:**
```
[ Lanjutkan Pembayaran ]
```
Klik membuka kembali popup Midtrans Snap dengan snap token yang masih aktif. Jika snap token sudah expired di sisi Midtrans, sistem membuat transaksi baru dengan paket dan harga yang sama, lalu membuka popup baru.

**Status Kedaluwarsa / Gagal:**
```
[ Beli Lagi ]
```
Klik men-scroll halaman ke atas ke bagian pemilihan paket, dengan paket yang sama sudah ter-highlight (pre-select) sebagai shortcut. User tetap harus klik `Pilih Paket` untuk konfirmasi — tidak ada auto-charge.

### Pagination / Tampilan Baris

Tampilkan **5 transaksi terbaru** secara default. Jika ada lebih dari 5, tampilkan tombol kecil di bawah tabel:

```
Tampilkan semua riwayat (X transaksi)
```

Klik expand tabel menampilkan semua transaksi tanpa pindah halaman.

---

## 6. Modal Invoice

Modal invoice muncul saat user mengklik `Lihat Invoice` pada transaksi dengan status Lunas.

**Ukuran modal:** Sedang — tidak full-screen, tidak terlalu kecil. Cukup untuk menampilkan semua konten invoice tanpa scroll internal.

### Konten Invoice (dari atas ke bawah)

**Header invoice:**
```
EPANET Solver
Bukti Pembayaran
```

**Nomor dan tanggal:**
```
No. Order    : [order_id dari Midtrans]
Tanggal      : [tanggal & waktu pembayaran dikonfirmasi]
```

**Detail akun:**
```
Nama         : [nama dari Google OAuth]
Email        : [email akun]
```

**Detail transaksi:**
```
Paket        : [nama paket]
Token        : [jumlah] token
Harga        : Rp [harga]
Metode       : [metode pembayaran]
Status       : ✅ Lunas
```

**Kalimat penutup:**
```
Token sebanyak [jumlah] telah ditambahkan ke akun Anda.
```

**Teks legal kecil di paling bawah invoice:**
```
Dokumen ini merupakan bukti pembayaran resmi layanan EPANET Solver.
Diproses melalui Midtrans Payment Gateway.
```

### Tombol di Bawah Modal

Dua tombol berdampingan:

```
[ Unduh PDF ]        [ Tutup ]
```

`Unduh PDF` men-generate file PDF dari konten invoice di atas dan langsung mendownload ke perangkat user. Nama file: `invoice-[order_id]-epanet-solver.pdf`

`Tutup` menutup modal dan kembali ke halaman checkout.

---

## 7. Interaksi Midtrans

Bagian ini mendeskripsikan perilaku UI saat user berinteraksi dengan payment flow Midtrans.

### Alur Normal (Beli Baru)

```
1. User klik [ Pilih Paket ] di salah satu card
2. Tombol berubah menjadi loading state: [ Memproses... ]
3. Sistem membuat transaksi di backend → mendapat snap token dari Midtrans
4. Popup Midtrans Snap terbuka di atas halaman (modal overlay)
5. User menyelesaikan pembayaran di dalam popup
6. Popup menutup otomatis setelah pembayaran selesai
7. Toast notifikasi muncul: "Pembayaran berhasil! X token ditambahkan 🎉"
8. Navbar diperbarui: saldo token bertambah (real-time)
9. Tabel riwayat diperbarui: baris baru muncul dengan status Lunas
```

### Alur Lanjutkan Pembayaran (Transaksi Tertunda)

```
1. User klik [ Lanjutkan Pembayaran ] di baris riwayat
2. Sistem cek apakah snap token masih valid di Midtrans
3a. Jika masih valid → popup Midtrans Snap langsung terbuka
3b. Jika sudah expired → sistem buat transaksi baru dengan paket sama
    → toast kecil: "Sesi pembayaran sebelumnya sudah kedaluwarsa.
                    Membuat sesi baru..."
    → popup Midtrans Snap baru terbuka
4. Alur selanjutnya sama seperti alur normal langkah 5–9
```

### Kondisi Error

| Kondisi | Pesan yang Ditampilkan | Tindakan |
|---|---|---|
| Gagal membuat transaksi (server error) | *"Gagal memulai pembayaran. Coba lagi dalam beberapa saat."* | Toast merah, tombol kembali aktif |
| Popup Midtrans ditutup user sebelum bayar | Tidak ada pesan — popup tutup saja | Baris riwayat tetap dengan status Menunggu |
| Webhook Midtrans terlambat | Saldo belum bertambah saat popup tutup | Toast kuning: *"Pembayaran sedang diverifikasi. Token akan ditambahkan dalam beberapa menit."* |
| Pembayaran gagal di Midtrans | Toast merah: *"Pembayaran gagal. Status diperbarui di riwayat."* | Status transaksi berubah ke Gagal |

---

## 8. Urutan & Struktur Lengkap

```
┌──────────────────────────────────────────────────────────────┐
│  NAVBAR (fixed)                                              │
│  Token: X  ·  Beli  ·  Avatar                               │
├──────────────────────────────────────────────────────────────┤
│  HEADER HALAMAN                                              │
│  "Beli Token"                                                │
│  1 analisis = 5 token · Fix Pressure = 3 token · Tidak exp  │
│  Saldo kamu saat ini: X token                                │
├──────────────────────────────────────────────────────────────┤
│  BAGIAN ATAS — PEMILIHAN PAKET                               │
│                                                              │
│  [ Mau Coba ]  [ Ups Kurang Dikit ]  [★ Best Value ]  [ Skripsi ] │
│                                                              │
│  "Semua analisis akurat 100% — token untuk akses output"     │
├──────────────────────────────────────────────────────────────┤
│  BAGIAN BAWAH — RIWAYAT PEMBELIAN                            │
│                                                              │
│  "Riwayat Pembelian"                                         │
│                                                              │
│  [Kondisi kosong: ikon + teks informatif]                    │
│  atau                                                        │
│  [Tabel transaksi dengan kolom lengkap]                      │
│  [Tombol "Tampilkan semua" jika > 5 transaksi]              │
└──────────────────────────────────────────────────────────────┘

─── OVERLAY (muncul di atas halaman saat dipanggil) ───────────

┌──────────────────────────────────────────────────────────────┐
│  POPUP MIDTRANS SNAP                                         │
│  [muncul saat user klik Pilih Paket atau Lanjutkan Bayar]   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  MODAL INVOICE                                               │
│  [muncul saat user klik Lihat Invoice]                       │
│                                                              │
│  Header · No Order · Detail Akun · Detail Transaksi          │
│  Teks legal                                                  │
│                                                              │
│  [ Unduh PDF ]   [ Tutup ]                                   │
└──────────────────────────────────────────────────────────────┘
```

### Logika Urutan

**Paket di atas, riwayat di bawah** — user yang datang untuk beli langsung melihat paket tanpa distraksi. User yang datang untuk cek riwayat atau lanjutkan pembayaran perlu scroll sedikit, tapi container riwayat selalu ada dan konsisten.

**Dua overlay terpisah** (Midtrans dan Invoice) tidak pernah muncul bersamaan. Keduanya adalah modal yang menutup halaman di belakangnya — Midtrans untuk transaksi aktif, Invoice untuk rekap transaksi selesai.

---

*Dokumen ini adalah bagian dari rangkaian dokumentasi EPANET Solver*
*Baca bersama: `LANDING_PAGE_LAYOUT.md`, `UI_HASIL_ANALISIS.md`, dan `EPANET_Solver_Pricing_Strategy.md`*
*Versi: 1.0 | April 2026*
