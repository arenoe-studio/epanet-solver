# Dokumentasi Strategi Pricing — EPANET Solver
## Token Catalog & Pricing Psychology
### April 2026

---

## Daftar Isi

1. [Konteks & Profil User](#1-konteks--profil-user)
2. [Struktur Token](#2-struktur-token)
3. [Katalog Paket Token](#3-katalog-paket-token)
4. [Tabel Perbandingan Lengkap](#4-tabel-perbandingan-lengkap)
5. [Psikologi di Balik Setiap Paket](#5-psikologi-di-balik-setiap-paket)
6. [Flow Psikologis User](#6-flow-psikologis-user)
7. [Free Trial — Konsep & Batasan](#7-free-trial--konsep--batasan)
8. [Token Fix Pressure — Pertimbangan](#8-token-fix-pressure--pertimbangan)
9. [Panduan Tampilan UI Pricing](#9-panduan-tampilan-ui-pricing)

---

## 1. Konteks & Profil User

### Target User Utama

```
Segmen     : Mahasiswa D4 Teknologi Rekayasa Konstruksi Bangunan Air
Institusi  : Institut Teknologi Sepuluh Nopember (ITS) Surabaya
Semester   : Semester 4 (mata kuliah yang menggunakan EPANET)
Sifat tugas: Individu — bukan kelompok
Frekuensi  : 1 mata kuliah per tahun, kemungkinan pakai lagi saat skripsi
```

### Karakteristik Perilaku

```
- Budget terbatas, sensitif terhadap harga
- One-time buyer — kemungkinan besar tidak repeat purchase
- Tidak tahu berapa kali akan perlu revisi (1–3x)
- Rela bayar jika ada kejelasan VALUE yang didapat
- Word of mouth ke adik angkatan sangat kuat
- Rentang harga wajar untuk 1 tugas: Rp 10.000–20.000
```

### Implikasi Pricing

Karena user adalah **one-time buyer individu**, strategi yang tepat bukan mendorong repeat purchase jangka panjang, melainkan:

1. **Mendorong beli paket lebih besar di awal** daripada beli kecil berkali-kali
2. **Menciptakan rasa "nanggung"** di setiap paket kecil sehingga paket menengah selalu terasa lebih worth it
3. **Memastikan experience pertama sangat memuaskan** untuk word of mouth ke adik angkatan

---

## 2. Struktur Token

### Biaya Aksi per Token

| Aksi | Token yang Digunakan | Keterangan |
|---|---|---|
| **Analisis Penuh** | **5 token** | Modul 1 + Modul 2 (baseline + iterasi diameter) |
| **Fix Pressure** | **3 token** | Modul 3 (insert PRV otomatis + simulasi ulang) |
| **Free Trial** | 0 token | 5 token gratis untuk user baru, sekali seumur hidup akun |

### Kenapa 5 Token untuk Analisis?

Angka 5 dipilih bukan tanpa alasan:

```
- Angka bersih dan mudah dikalkulasi user
- Tidak ada paket yang tepat habis kelipatan 5
  (kecuali paket terbesar yang memang dirancang demikian)
- Selalu menyisakan token "nanggung" di semua paket kecil
- Memudahkan desain kombinasi yang psikologis
```

### Kenapa 3 Token untuk Fix Pressure?

```
Terlalu murah (1–2 token):
→ User tidak merasakan nilai
→ Bisa "iseng" klik Fix berkali-kali
→ Token habis cepat tanpa disadari

Terlalu mahal (4–5 token):
→ Sama mahalnya dengan analisis baru
→ User pilih upload .inp baru dan analisis ulang
→ Fitur Fix Pressure tidak pernah dipakai

3 token adalah sweet spot:
→ Lebih murah dari analisis baru (5 token) → ada insentif pakai
→ Cukup "berasa" sehingga user memakai dengan pertimbangan
→ Tidak ada kelipatan (3+5) yang genap di paket manapun
   → selalu menyisakan token nanggung
```

---

## 3. Katalog Paket Token

### 🔰 Paket 1 — "Mau Coba"

```
Token          : 6 token
Harga          : Rp 8.900
Harga per token: Rp 1.483

Kombinasi penggunaan:
→ 1x Analisis Penuh (5 token) + sisa 1 token (tidak bisa dipakai apa-apa)

Status sisa token: NGANGGUR
Sisa 1 token tidak cukup untuk Fix Pressure (3) maupun Analisis (5)
```

**Untuk siapa:** User yang ragu-ragu atau hanya ingin mencoba sekali. Tapi dirancang agar langsung terasa "nanggung" setelah pemakaian pertama.

**Efek psikologis yang diharapkan:**
- Setelah 1x analisis, punya 1 token nganggur yang tidak bisa dipakai
- Jika perlu revisi atau fix pressure → **harus beli paket baru**
- Melihat opsi beli lagi Paket 1 (Rp 8.900) vs langsung Paket 3 yang jauh lebih worth it → terdorong naik ke Paket 3

---

### 🔸 Paket 2 — "Ups Kurang Dikit"

```
Token          : 13 token
Harga          : Rp 16.900
Harga per token: Rp 1.300

Kombinasi penggunaan:
→ Opsi A: 2x Analisis (10 token) + 1x Fix Pressure (3 token) = 13 token (habis tepat)
→ Opsi B: 2x Analisis (10 token) + sisa 3 token (cukup fix, tidak cukup analisis ke-3)

Status sisa token: NANGGUNG
Setelah 2x analisis, sisa 3 token cukup untuk Fix Pressure
TAPI tidak cukup untuk analisis ke-3 yang butuh 5 token
```

**Untuk siapa:** User yang sudah tahu butuh lebih dari 1x analisis.

**Efek psikologis yang diharapkan:**
- Setelah pakai habis kombinasi optimal, selalu ada sisa yang tidak bisa dimanfaatkan penuh
- Perbandingan dengan Paket 3: **hanya Rp 3.000 lebih mahal tapi dapat 5 token ekstra** → sangat mendorong naik ke Paket 3

---

### 🔥 Paket 3 — "Best Value" *(Target Utama)*

```
Token          : 18 token
Harga          : Rp 19.900
Harga per token: Rp 1.106

Kombinasi penggunaan:
→ Opsi A: 3x Analisis (15 token) + 1x Fix Pressure (3 token) = 18 token (habis tepat)
→ Opsi B: 2x Analisis + 2x Fix Pressure (10+6=16 token) + sisa 2 token (nganggur lagi)
→ Opsi C: 3x Analisis (15 token) + sisa 3 token (cukup fix, tidak cukup analisis ke-4)

Status sisa token: NANGGUNG (kecuali kombinasi Opsi A yang pas habis)
```

**Untuk siapa:** Mayoritas mahasiswa yang realistis membutuhkan 2–3x analisis per tugas.

**Kenapa ini paket target:**
```
- Rp 19.900 masih terasa "di bawah Rp 20.000"
- Hanya Rp 3.000 lebih mahal dari Paket 2 → tapi 5 token lebih banyak
- Cukup untuk worst case (3x revisi) tanpa overthinking
- Framing yang kuat: "Lebih murah dari 1 fotokopi + jilid laporan"
- Per token Rp 1.106 → terasa jauh lebih hemat dari Paket 1 (Rp 1.483)
```

**Label yang disarankan di UI:** `🔥 PALING WORTH IT` atau `BEST VALUE`

---

### 💡 Paket 4 — "Tenang Sampai Selesai"

```
Token          : 28 token
Harga          : Rp 27.900
Harga per token: Rp 996

Kombinasi penggunaan:
→ Opsi A: 5x Analisis (25 token) + 1x Fix Pressure (3 token) = 28 token (habis tepat)
→ Opsi B: 4x Analisis + 2x Fix Pressure (20+6=26 token) + sisa 2 token (nganggur)
→ Opsi C: 5x Analisis (25 token) + sisa 3 token (cukup fix, tidak cukup analisis ke-6)

Status sisa token: NANGGUNG (kecuali kombinasi Opsi A yang pas habis)
```

**Untuk siapa:** Mahasiswa yang akan menggunakan EPANET lagi di semester lain atau skripsi, atau yang sudah tahu model jaringannya akan banyak direvisi.

**Kenapa Rp 27.900 bukan Rp 30.000:**
```
- Rp 27.900 terasa jauh lebih murah dari Rp 30.000 secara psikologis
- Masih "di bawah Rp 28.000" dalam persepsi user
- Hemat Rp 3.600 per token dibanding Paket 1
```

**Label yang disarankan di UI:** `💡 UNTUK SKRIPSI & SEMESTER LANJUT`

---

## 4. Tabel Perbandingan Lengkap

```
┌──────────────────────┬───────┬──────────────────────────────────────┬────────────┬───────────┬─────────────────────┐
│ Paket                │ Token │ Kombinasi Optimal                    │ Harga      │ Per Token │ vs Paket 1          │
├──────────────────────┼───────┼──────────────────────────────────────┼────────────┼───────────┼─────────────────────┤
│ 🔰 Mau Coba          │   6   │ 1x analisis + 1 token nganggur       │ Rp  8.900  │ Rp 1.483  │ —                   │
│ 🔸 Ups Kurang Dikit  │  13   │ 2x analisis + 1x fix pressure        │ Rp 16.900  │ Rp 1.300  │ Hemat Rp 2.400      │
│ 🔥 Best Value        │  18   │ 3x analisis + 1x fix pressure        │ Rp 19.900  │ Rp 1.106  │ Hemat Rp 6.800      │
│ 💡 Tenang Sampai Sei │  28   │ 5x analisis + 1x fix pressure        │ Rp 27.900  │ Rp   996  │ Hemat Rp 13.700     │
└──────────────────────┴───────┴──────────────────────────────────────┴────────────┴───────────┴─────────────────────┘
```

### Tabel Hemat vs Beli Satuan (Framing UI)

Gunakan perbandingan ini untuk teks di bawah setiap paket:

| Paket | Jika Beli Satuan (Paket 1 terus) | Dengan Paket Ini | Selisih |
|---|---|---|---|
| Mau Coba | Rp 8.900 | Rp 8.900 | — |
| Ups Kurang Dikit | Rp 8.900 × 3 = Rp 26.700 | Rp 16.900 | Hemat Rp 9.800 |
| Best Value | Rp 8.900 × 4 = Rp 35.600 | Rp 19.900 | Hemat Rp 15.700 |
| Tenang Sampai Selesai | Rp 8.900 × 6 = Rp 53.400 | Rp 27.900 | Hemat Rp 25.500 |

> **Catatan implementasi UI:** Tampilkan baris "Hemat Rp X dibanding beli Paket 1 berkali-kali" di bawah setiap paket. Ini adalah anchor yang paling kuat untuk mendorong upgrade.

---

## 5. Psikologi di Balik Setiap Paket

### Prinsip Utama — Deliberate Friction via Token Gap

Seluruh struktur paket dirancang dengan satu prinsip inti: **tidak ada paket yang membuat user merasa "pas" setelah pemakaian standar**, kecuali kombinasi yang sangat spesifik.

```
Deliberate Token Gap:
→ Paket 1 (6 token): sisa 1 setelah analisis → tidak bisa apa-apa
→ Paket 2 (13 token): sisa 3 setelah 2x analisis → bisa fix, tidak bisa analisis
→ Paket 3 (18 token): sisa 3 setelah 3x analisis → sama seperti Paket 2
→ Paket 4 (28 token): sisa 3 setelah 5x analisis → sama seperti Paket 2 & 3
```

Efek yang dihasilkan: user **selalu** merasa ada sisa token yang tidak bisa dioptimalkan, kecuali membeli ulang atau upgrade.

### Prinsip Anchoring

Paket 4 (Rp 27.900) berfungsi sebagai **anchor** — membuatnya Paket 3 (Rp 19.900) terasa sangat terjangkau meskipun sudah merupakan paket target.

### Prinsip Decoy

Paket 2 (Rp 16.900) adalah **decoy klasik** — posisinya sengaja didesain agar perbandingan dengan Paket 3 selalu menghasilkan pilihan Paket 3:

```
Paket 2 → Paket 3:
+ Rp 3.000 lebih mahal
+ 5 token lebih banyak
+ 1x analisis ekstra
→ Hampir semua user rasional akan pilih Paket 3
```

### Prinsip Loss Aversion

User lebih takut "rugi" daripada senang "untung." Gunakan framing ini:

```
❌ Framing lemah: "Hemat 25% dengan Paket Best Value"
✅ Framing kuat: "Jika beli Paket 1 terus, kamu rugi Rp 15.700"
```

---

## 6. Flow Psikologis User

Berikut adalah skenario yang paling mungkin terjadi berdasarkan struktur pricing ini:

### Skenario A — User Langsung Sadar (Ideal)

```
1. Daftar → dapat 5 token gratis
2. Analisis pertama → lihat hasil preview (tidak bisa download)
3. Terkesan → mau download → lihat pricing
4. Banding Paket 1 vs Paket 3:
   "Paket 1 cuma 6 token, tapi kalau perlu revisi harus beli lagi
    Paket 3 langsung 18 token, hanya Rp 11.000 lebih mahal"
5. → Beli Paket 3 langsung
6. Pakai 3x analisis → puas → cerita ke teman
```

### Skenario B — User Beli Kecil Dulu (Paling Umum)

```
1. Daftar → dapat 5 token gratis → analisis pertama
2. Ada P-HIGH → mau Fix Pressure → token habis
3. "Beli Paket 1 dulu, Rp 8.900 murah"
4. Dapat 6 token → Fix Pressure (3 token) → sisa 3 token
5. Ternyata masih ada masalah → mau analisis ulang
6. Butuh 5 token, punya 3 → TIDAK CUKUP
7. "Tanggung banget, mending beli lagi..."
8. Lihat pilihan: Paket 1 lagi (Rp 8.900) atau Paket 3 (Rp 19.900)
9. Kalkulasi: "Total sudah keluar Rp 8.900, kalau beli Paket 1 lagi
   total jadi Rp 17.800 tapi cuma dapat 6 token
   Paket 3 Rp 19.900 dapat 18 token, hanya Rp 2.100 lebih mahal"
10. → Beli Paket 3 → merasa menang secara psikologis
    → padahal sudah keluar Rp 28.800 total (Rp 8.900 + Rp 19.900)
```

### Skenario C — User Langsung Premium

```
1. Tahu dari senior/teman bahwa EPANET akan dipakai berkali-kali
2. Langsung beli Paket 4 (Rp 27.900)
3. Pakai sepanjang semester → tidak perlu top up
4. Sisa token dipakai saat skripsi
```

---

## 7. Free Trial — Konsep & Batasan

### Prinsip Dasar

> Free trial **bukan memberikan hasil yang sengaja tidak akurat** — melainkan **membatasi akses ke output**.
> Akurasi analisis selalu 100%. Yang dibatasi adalah kemampuan user mengunduh hasilnya.

Ini penting untuk menjaga kepercayaan. Jika user tahu hasil sengaja dibuat salah, reputasi tools ini akan rusak.

### Spesifikasi Free Trial

```
Cara dapat : Otomatis saat pertama kali login dengan Google
Jumlah     : 5 token (cukup untuk 1x analisis penuh)
Batas      : Sekali seumur hidup per akun
```

### Yang Bisa Dilakukan dengan Free Trial

```
✅ Analisis berjalan penuh dan 100% akurat
✅ Ringkasan hasil ditampilkan di UI:
   - Total masalah ditemukan
   - Total masalah berhasil diperbaiki
   - Status per node (P-OK / P-HIGH / P-LOW)
   - Status per pipa (V-OK / V-HIGH / V-LOW / HL-OK / HL-HIGH)
✅ Preview tabel hasil (3–5 baris pertama saja)
✅ Tombol Fix Pressure muncul jika ada P-HIGH (tapi tidak aktif)
```

### Yang Tidak Bisa Dilakukan dengan Free Trial

```
❌ Download file optimized_network.inp
❌ Download file analysis_report.md
❌ Klik tombol Fix Pressure
❌ Melihat tabel hasil secara penuh (hanya preview)
```

### Nudge Setelah Free Trial Habis

Tampilkan pesan berikut tepat setelah analisis selesai dan user mencoba download:

> *"Analisis selesai! Ditemukan 8 masalah — 6 berhasil diperbaiki otomatis.*
> *Download hasil lengkap dan file .inp yang siap dibuka di EPANET mulai dari **Rp 8.900** →"*

---

## 8. Token Fix Pressure — Pertimbangan

### Mengapa Fix Pressure Berbayar Terpisah?

Fix Pressure (Modul 3) adalah proses tambahan yang:
- Menjalankan simulasi ulang setelah PRV disisipkan
- Membutuhkan komputasi yang signifikan
- Bukan selalu dibutuhkan (hanya untuk jaringan dengan topografi ekstrem)
- Merupakan fitur "premium" yang menyelesaikan masalah yang tidak bisa diselesaikan diameter

Memisahkan biayanya membuat nilai fitur ini terasa nyata.

### Nilai yang Tepat: 3 Token

| Nilai | Efek |
|---|---|
| 1–2 token | Terlalu murah — user tidak merasakan nilai, bisa iseng klik terus |
| **3 token** | **Sweet spot — lebih murah dari analisis baru, tapi terasa bermakna** |
| 4–5 token | Terlalu mahal — user pilih upload .inp baru dan analisis ulang saja |

### Efek 3 Token pada Setiap Paket

```
Paket 1 (6 token):
→ Analisis (5) + Fix Pressure (3) = 8 token → tidak cukup
→ User harus pilih: analisis ATAU fix, tidak bisa keduanya
→ Mendorong beli paket lebih besar

Paket 2 (13 token):
→ 2x Analisis (10) + 1x Fix (3) = 13 → pas habis (Opsi A)
→ Atau 2x Analisis + sisa 3 (bisa fix 1x tapi tidak analisis lagi)

Paket 3 (18 token):
→ 3x Analisis (15) + 1x Fix (3) = 18 → pas habis (Opsi A) ← SWEET SPOT
→ Atau kombinasi lain yang selalu menyisakan 2–3 token

Paket 4 (28 token):
→ 5x Analisis (25) + 1x Fix (3) = 28 → pas habis (Opsi A)
→ Memberikan ketenangan tanpa overthinking
```

---

## 9. Panduan Tampilan UI Pricing

### Layout yang Disarankan

Tampilkan 4 paket dalam satu baris horizontal (card layout). Paket 3 (Best Value) harus secara visual lebih menonjol — lebih besar, ada badge, border berbeda.

### Elemen Wajib per Card

```
Setiap card paket harus menampilkan:
1. Nama paket
2. Jumlah token (besar, prominent)
3. Harga (besar)
4. Harga per token (kecil, abu-abu)
5. Deskripsi singkat penggunaan:
   "Untuk X analisis + Y fix pressure"
6. Kalimat hemat vs beli Paket 1 terus:
   "Hemat Rp X dibanding beli paket kecil berkali-kali"
7. CTA button: "Beli Sekarang"
```

### Badge & Label

| Paket | Badge | Warna |
|---|---|---|
| Mau Coba | — | Putih / abu |
| Ups Kurang Dikit | — | Putih / abu |
| Best Value | `🔥 PALING WORTH IT` | Oranye / kuning |
| Tenang Sampai Selesai | `💡 UNTUK SKRIPSI` | Biru / ungu |

### Urutan Tampil di UI

Tampilkan dari kiri ke kanan: **Mau Coba → Ups Kurang Dikit → Best Value → Tenang Sampai Selesai**

Dengan Paket Best Value di posisi ketiga (bukan terakhir), mata user secara natural tertarik ke sana karena posisinya setelah dua decoy dan sebelum anchor premium.

### Teks Pendamping di Halaman Pricing

Tambahkan kalimat ini di atas tabel paket:

> *"1x analisis = 5 token · Fix Pressure = 3 token · Token tidak expired"*

Dan di bawah tabel:

> *"Semua analisis menggunakan solver EPANET yang sama dengan versi desktop. Hasil selalu akurat — token digunakan untuk akses ke output, bukan untuk akurasi."*

---

*Dokumen ini adalah bagian dari rangkaian dokumentasi EPANET Solver*
*Baca bersama: `EPANET_Solver_Logic_Documentation.md` dan `EPANET_Solver_Brainstorming_Validasi.md`*
*Versi: 1.0 | April 2026*
