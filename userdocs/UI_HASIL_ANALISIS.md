# UI Documentation — Halaman Hasil Analisis
## EPANET Solver — Spesifikasi Konten & Layout
### Versi 1.0 | April 2026

---

## Daftar Isi

1. [Prinsip Halaman](#1-prinsip-halaman)
2. [Kondisi Tampilan](#2-kondisi-tampilan)
3. [Blok 1 — Status Header](#3-blok-1--status-header)
4. [Blok 2 — Ringkasan Jaringan & Hasil](#4-blok-2--ringkasan-jaringan--hasil)
5. [Blok 3 — Tabel Node Before vs After](#5-blok-3--tabel-node-before-vs-after)
6. [Blok 4 — Tabel Pipa Before vs After](#6-blok-4--tabel-pipa-before-vs-after)
7. [Blok 5 — Rekomendasi Material](#7-blok-5--rekomendasi-material)
8. [Blok 6 — Panel PRV (Kondisional)](#8-blok-6--panel-prv-kondisional)
9. [Blok 7 — Download](#9-blok-7--download)
10. [Urutan & Struktur Lengkap](#10-urutan--struktur-lengkap)
11. [Status Badge — Referensi](#11-status-badge--referensi)

---

## 1. Prinsip Halaman

Halaman hasil analisis bukan sekadar "dashboard angka" — ia adalah **laporan teknis ringkas** yang bisa dibaca, dipahami, dan dijadikan dasar keputusan oleh mahasiswa dalam waktu singkat. Setiap blok disusun mengikuti urutan logika berpikir seorang engineer: status global dulu, lalu detail per komponen, lalu rekomendasi tindakan.

**Tiga prinsip utama:**

- **Progresif** — dari ringkasan ke detail. User tidak dipaksa baca semua sekaligus.
- **Kontekstual** — setiap angka selalu diberi konteks (satuan, batas standar, makna).
- **Actionable** — setiap masalah yang ditampilkan selalu disertai tindakan yang bisa dilakukan user.

**Sumber data semua blok:**
Seluruh konten halaman ini bersumber dari hasil Python solver (Modul 1, 2, dan 3) yang mengembalikan data per-node dan per-pipa. Tidak ada konten yang bersifat statis atau hardcoded.

---

## 2. Kondisi Tampilan

Halaman hasil analisis memiliki **dua kondisi utama** yang mempengaruhi apa saja yang tampil:

### Kondisi A — Semua Kriteria Terpenuhi (V ✅ HL ✅ P ✅)

Terjadi saat tidak ada node dengan P-HIGH setelah Modul 2 selesai. Blok PRV tidak muncul. Tombol download hanya menampilkan satu versi file (final).

### Kondisi B — Ada P-HIGH Tersisa (V ✅ HL ✅ P ⚠️)

Terjadi saat Modul 2 sudah menyelesaikan masalah V dan HL, tetapi masih ada node dengan tekanan > 80m. Blok PRV muncul lengkap dengan rekomendasi dan tombol Fix Pressure.

Kondisi B masih memiliki dua sub-kondisi bergantung apakah user sudah menekan Fix Pressure atau belum — ini mempengaruhi Blok 7 (Download).

---

## 3. Blok 1 — Status Header

**Posisi:** Paling atas halaman, tepat di bawah navbar.

**Tujuan:** Memberikan gambaran status keseluruhan dalam satu pandang — sebelum user membaca detail apapun.

### Elemen

**Baris 1 — Badge status proses:**
Badge pill kecil di atas judul. Isinya bergantung kondisi:

| Kondisi | Teks Badge | Warna Indikator |
|---|---|---|
| Semua OK | `● Analisis selesai` | Hijau |
| Ada P-HIGH (belum Fix) | `● Analisis selesai — tekanan perlu ditangani` | Kuning |
| Fix Pressure selesai | `● Analisis lengkap` | Hijau |

**Baris 2 — Judul dan nama file:**
```
Hasil Analisis
File: [nama_file.inp]
```
Nama file ditampilkan dalam teks monospace atau kecil di bawah judul.

**Baris 3 — Tiga indikator parameter:**
Tiga chip/badge kecil berderet horizontal yang menunjukkan status tiga kriteria utama:

```
[ V Kecepatan ✅ OK ]   [ HL Headloss ✅ OK ]   [ P Tekanan ⚠️ Ada P-HIGH ]
```

Setiap chip bisa diklik (scroll ke bagian tabel terkait sebagai anchor). Warna chip mengikuti status: hijau = OK, kuning = ada peringatan, merah = masalah kritis.

**Catatan desain:** Baris 3 ini adalah elemen paling penting di halaman — user harus bisa membaca status global tanpa scroll satu pixel pun.

---

## 4. Blok 2 — Ringkasan Jaringan & Hasil

**Posisi:** Di bawah Status Header.

**Tujuan:** Memberikan angka-angka kunci dalam format yang mudah dipindai. Dibagi menjadi dua baris card yang memiliki peran berbeda.

### Baris Atas — Info Jaringan (Netral)

Empat card berjajar, berisi informasi jaringan yang dibaca dari file `.inp`. Ini adalah data deskriptif, bukan hasil evaluasi — tidak ada status warna.

| Card | Label | Nilai | Satuan |
|---|---|---|---|
| 1 | Simpul | angka | node |
| 2 | Pipa | angka | pipa |
| 3 | Total Demand | angka | LPS |
| 4 | Head Reservoir | angka | m |

### Baris Bawah — Hasil Analisis

Lima card berjajar, berisi hasil dari proses analisis. Card "Masalah Tersisa" memiliki treatment visual berbeda jika nilainya > 0.

| Card | Label | Nilai | Catatan |
|---|---|---|---|
| 1 | Iterasi | angka | putaran diameter |
| 2 | Durasi | angka | detik |
| 3 | Masalah Ditemukan | angka | total di kondisi awal |
| 4 | Berhasil Diperbaiki | angka | oleh Modul 2 |
| 5 | Masalah Tersisa | angka | lihat catatan di bawah |

**Catatan di bawah Baris Bawah:**

Jika "Masalah Tersisa" > 0, tampilkan satu baris teks kecil di bawah kelima card:

> *"Masalah tersisa adalah node dengan tekanan tinggi (P-HIGH). Ini bukan kegagalan optimasi — tekanan tinggi disebabkan perbedaan elevasi dan tidak bisa diselesaikan dengan mengubah diameter. Lihat rekomendasi PRV di bawah."*

Teks ini kritis untuk mencegah user salah menginterpretasikan hasil sebagai "tools tidak bekerja".

---

## 5. Blok 3 — Tabel Node Before vs After

**Posisi:** Di bawah Blok 2.

**Tujuan:** Menampilkan kondisi tekanan setiap node sebelum dan sesudah analisis. Ini adalah data yang paling sering dibutuhkan untuk laporan akademik.

### Header Blok

```
Hasil Node
Evaluasi tekanan per simpul berdasarkan Permen PU No. 18/PRT/M/2007 (batas: 10–80 m)
```

### Struktur Tabel

| Kolom | Label | Format | Keterangan |
|---|---|---|---|
| 1 | Node | teks | ID node dari file `.inp` |
| 2 | Elevasi | angka + `m` | Elevasi node, tidak berubah |
| 3 | Tekanan Awal | angka + `m` | Hasil Modul 1 (baseline) |
| 4 | Tekanan Akhir | angka + `m` | Hasil Modul 2 (setelah iterasi diameter) |
| 5 | Status | badge | Lihat referensi badge di bagian 11 |

### Filter Tabel

Di atas tabel, tampilkan tiga tombol filter pill:

```
[ Semua ]   [ Bermasalah ]   [ OK ]
```

Default: **Semua**. Filter "Bermasalah" menampilkan hanya node dengan status P-HIGH, P-LOW, atau P-NEG.

### Catatan Kontekstual

Tampilkan satu baris catatan di atas tabel (di bawah header blok):

> *"Perubahan tekanan antar kondisi minimal karena sistem mengiterasi diameter, bukan mengatur tekanan langsung. Node dengan P-HIGH ditangani melalui PRV — lihat Panel PRV di bawah."*

Catatan ini hanya ditampilkan jika ada node P-HIGH. Jika semua node OK, catatan tidak perlu muncul.

---

## 6. Blok 4 — Tabel Pipa Before vs After

**Posisi:** Di bawah Blok 3.

**Tujuan:** Menampilkan perubahan diameter dan hasil evaluasi kecepatan serta headloss per pipa. Ini adalah **data utama yang diubah sistem** dan paling relevan untuk laporan perancangan.

### Header Blok

```
Hasil Pipa
Evaluasi kecepatan dan headloss per pipa. Diameter diiterasi otomatis menggunakan ukuran standar SNI.
```

### Struktur Tabel

| Kolom | Label | Format | Keterangan |
|---|---|---|---|
| 1 | Pipa | teks | ID pipa dari file `.inp` |
| 2 | Panjang | angka + `m` | Panjang pipa, tidak berubah |
| 3 | D Awal | angka + `mm` | Diameter sebelum iterasi |
| 4 | D Akhir | angka + `mm` | Diameter setelah iterasi — **bold** jika berbeda dari D Awal |
| 5 | V Awal | angka + `m/s` | Kecepatan kondisi awal |
| 6 | V Akhir | angka + `m/s` | Kecepatan kondisi akhir |
| 7 | HL Awal | angka + `m/km` | Headloss per km kondisi awal |
| 8 | HL Akhir | angka + `m/km` | Headloss per km kondisi akhir |
| 9 | Status | badge | Lihat referensi badge di bagian 11 |

### Highlight Perubahan Diameter

Baris pipa yang diameternya berubah (D Awal ≠ D Akhir) diberi highlight ringan pada seluruh baris — misalnya background row sedikit berbeda. Nilai D Akhir pada baris tersebut ditulis **bold**.

### Filter Tabel

Di atas tabel, tampilkan tiga tombol filter pill:

```
[ Semua ]   [ Diameter Berubah ]   [ Bermasalah ]   [ OK ]
```

Default: **Semua**. Filter "Diameter Berubah" menampilkan hanya pipa yang mengalami perubahan diameter — berguna untuk mahasiswa yang ingin melihat ringkasan perubahan desain.

### Catatan Teknis di Bawah Tabel

Teks kecil, warna soft:

> *"Diameter yang digunakan mengacu pada ukuran standar yang tersedia di pasaran Indonesia (SNI): 40, 50, 63, 75, 90, 110, 125, 150, 200, 250, 315, 400, 500 mm."*

---

## 7. Blok 5 — Rekomendasi Material

**Posisi:** Di bawah Blok 4.

**Tujuan:** Menampilkan rekomendasi material pipa berdasarkan kombinasi tekanan kerja aktual dan diameter hasil iterasi. Ini adalah informasi tambahan yang bernilai tinggi untuk laporan akademik dan perencanaan nyata.

### Header Blok

```
Rekomendasi Material
Material direkomendasikan berdasarkan tekanan kerja aktual dan diameter hasil optimasi,
mengacu pada SNI dan Permen PU No. 18/PRT/M/2007.
```

### Struktur Tabel

| Kolom | Label | Format | Keterangan |
|---|---|---|---|
| 1 | Pipa | teks | ID pipa |
| 2 | D Rekomendasi | angka + `mm` | Diameter hasil Modul 2 |
| 3 | Material | teks | Nama material + kelas (misal: `HDPE PE100 PN-10`) |
| 4 | Nilai C | angka | Koefisien Hazen-Williams material |
| 5 | Tekanan Kerja | angka + `m` | Tekanan aktual di pipa dari simulasi |
| 6 | Catatan | teks atau ikon | Hanya muncul jika ada kondisi khusus |

### Kolom Catatan — Kondisi yang Memicu

Kolom catatan hanya terisi jika salah satu kondisi berikut terpenuhi:

| Kondisi | Isi Catatan |
|---|---|
| Pipa berada di zona P-HIGH | `⚠️ Evaluasi ulang material setelah PRV dipasang` |
| Material GIP diganti karena diameter > 114mm | `ℹ️ GIP tidak tersedia dalam diameter ini — diganti HDPE PE100 PN-16` |

Baris dengan catatan aktif diberi ikon atau indikator kecil di kolom catatan. Jika di-hover atau diklik, catatan lengkap muncul sebagai tooltip atau expanded row.

### Informasi Referensi

Di bawah tabel, tampilkan accordion lipat dengan judul **"Dasar Pemilihan Material"**. Isinya:

```
Matriks keputusan yang digunakan sistem:

Tekanan ≤ 100m, Diameter ≤ 110mm  → PVC AW PN-10  (C=140)
Tekanan ≤ 100m, Diameter > 110mm  → HDPE PE100 PN-10  (C=140)
Tekanan 100–160m                   → HDPE PE100 PN-16  (C=140)
Tekanan > 160m                     → GIP Heavy / Steel  (C=120)

Referensi: SNI 06-2550-1991 (PVC) · SNI 4829.2:2015 (HDPE) ·
           SNI 07-0242.1-2000 (GIP) · EPANET 2.2 Manual Table 3.2
```

Accordion ini default collapsed. User membukanya secara aktif jika ingin tahu dasar teknisnya.

---

## 8. Blok 6 — Panel PRV (Kondisional)

**Visibilitas:** Blok ini **hanya muncul** jika setelah Modul 2 masih ada node dengan status P-HIGH.

**Posisi:** Di bawah Blok 5 (Rekomendasi Material).

**Tujuan:** Menjelaskan mengapa P-HIGH tidak bisa diselesaikan dengan diameter, menampilkan rekomendasi penempatan PRV, dan memberikan dua pilihan tindakan yang jelas kepada user.

### Sub-blok A — Penjelasan Teknis

Card atau callout dengan warna yang membedakannya dari card biasa. Isinya:

**Judul:** `Mengapa tekanan tinggi tidak cukup diatasi dengan diameter?`

**Isi penjelasan:**
> *"Tekanan tinggi terjadi karena perbedaan elevasi yang besar antara reservoir dan node. Ini adalah energi potensial yang tersimpan dalam air — bukan hambatan aliran yang bisa dikurangi dengan mengubah diameter.*
>
> *Memperbesar diameter justru meningkatkan tekanan di hilir karena headloss berkurang. Memperkecil diameter akan menurunkan tekanan, tetapi juga melanggar batas kecepatan dan headloss.*
>
> *Solusi yang tepat adalah Pressure Reducing Valve (PRV) — yang secara mekanis mereduksi tekanan tanpa mengganggu debit aliran."*

### Sub-blok B — Tabel Rekomendasi PRV

**Label di atas tabel:** `Rekomendasi Penempatan PRV`

Tabel berisi hasil analisis otomatis Modul 3 Bagian A:

| Kolom | Label | Keterangan |
|---|---|---|
| No | — | Nomor urut PRV |
| Pipa | ID Pipa | Pipa tempat PRV akan disisipkan |
| Setting PRV | angka + `m` | Nilai setting pressure reducing |
| Node Tercakup | daftar ID | Node-node yang tekanannya akan terpengaruh |
| Estimasi Tekanan Setelah | per node + status | Misal: `G=55m ✅  I=58m ✅  F=52m ✅` |

Di bawah tabel, tampilkan satu baris catatan kecil:

> *"Estimasi berdasarkan kalkulasi statis. Nilai aktual setelah simulasi mungkin sedikit berbeda. Gunakan Fix Pressure untuk hasil presisi."*

### Sub-blok C — Dua Pilihan Aksi

Dua tombol dengan hierarki visual yang jelas:

**Opsi 1 — Fix Otomatis (primary):**
```
[ Fix Pressure Otomatis — 3 Token ]
```
Sub-teks di bawah tombol: *"PRV disisipkan ke file .inp dan simulasi dijalankan ulang. Hasil final siap diunduh."*

**Opsi 2 — Manual (secondary, teks link):**
```
Saya akan pasang PRV manual di EPANET →
```
Sub-teks atau tooltip: *"Panduan langkah demi langkah tersedia di file laporan .md yang bisa diunduh."*

### Sub-blok D — Setelah Fix Pressure Selesai

Setelah user mengklik Fix Pressure dan proses selesai, **Panel PRV berubah** menampilkan:

- Badge hijau: `● Fix Pressure selesai`
- Ringkasan singkat: jumlah PRV yang dipasang, node yang sudah OK
- Tabel konfirmasi: kondisi node P-HIGH sebelum dan sesudah Fix (tekanan aktual hasil simulasi, bukan estimasi)
- Catatan jika ada pipa yang material rekomendasinya perlu dievaluasi ulang karena tekanan sudah berubah

---

## 9. Blok 7 — Download

**Posisi:** Paling bawah halaman, setelah semua blok konten.

**Tujuan:** Memberikan akses unduh ke semua file output dengan label yang jelas dan konteks yang cukup — user tahu persis apa yang mereka unduh dan untuk apa.

### Kondisi 1 — Setelah Modul 2, Sebelum Fix Pressure

Dua tombol download tersedia:

| Tombol | Label | Deskripsi di bawah tombol |
|---|---|---|
| 1 | `Unduh File .inp (v1)` | *"Diameter sudah dioptimasi. Buka di EPANET dan pasang PRV manual mengikuti rekomendasi di laporan."* |
| 2 | `Unduh Laporan .md (v1)` | *"Berisi Before vs After lengkap, rekomendasi material, dan panduan pemasangan PRV manual."* |

Label `v1` di sini **perlu dijelaskan** dengan teks kecil di atas grup tombol:
> *"File versi v1 sudah mencakup optimasi diameter. PRV belum disisipkan — tersedia di versi final setelah Fix Pressure dijalankan."*

### Kondisi 2 — Setelah Fix Pressure Selesai

Empat tombol download tersedia, dibagi dalam dua grup:

**Grup "Sebelum PRV" (v1):**
```
[ Unduh File .inp (v1) ]    [ Unduh Laporan .md (v1) ]
```
Sub-label di atas grup: *"Versi dengan optimasi diameter saja, tanpa PRV"*

**Grup "Final dengan PRV":**
```
[ Unduh File .inp (final) ]    [ Unduh Laporan .md (final) ]
```
Sub-label di atas grup: *"Versi lengkap: diameter dioptimasi + PRV sudah disisipkan"*

### Kondisi 3 — Semua Kriteria Terpenuhi (Tidak Ada P-HIGH)

Dua tombol download tersedia, tanpa pembagian versi:

| Tombol | Label | Deskripsi |
|---|---|---|
| 1 | `Unduh File .inp` | *"Jaringan dengan diameter yang sudah dioptimasi. Siap dibuka di EPANET."* |
| 2 | `Unduh Laporan .md` | *"Laporan lengkap Before vs After, rekomendasi material, dan log iterasi."* |

### Elemen Tambahan di Bawah Tombol

Satu baris teks kecil, warna soft:

> *"Token terpakai: Analisis = 5 token  ·  Fix Pressure = 3 token  ·  Sisa saldo: X token"*

Dan satu tombol terpisah di bawahnya:

```
[ Analisis File Baru ]
```

---

## 10. Urutan & Struktur Lengkap

Berikut urutan semua blok dari atas ke bawah:

```
┌──────────────────────────────────────────────────────┐
│  NAVBAR (fixed)                                      │
├──────────────────────────────────────────────────────┤
│  BLOK 1 — STATUS HEADER                              │
│  Badge · Judul & nama file · 3 indikator (V/HL/P)   │
├──────────────────────────────────────────────────────┤
│  BLOK 2 — RINGKASAN JARINGAN & HASIL                 │
│  Baris atas: 4 card info jaringan                    │
│  Baris bawah: 5 card hasil analisis                  │
│  + catatan kontekstual jika ada masalah tersisa      │
├──────────────────────────────────────────────────────┤
│  BLOK 3 — TABEL NODE BEFORE VS AFTER                 │
│  Filter: Semua / Bermasalah / OK                     │
│  Kolom: Node · Elevasi · P Awal · P Akhir · Status   │
├──────────────────────────────────────────────────────┤
│  BLOK 4 — TABEL PIPA BEFORE VS AFTER                 │
│  Filter: Semua / Diameter Berubah / Bermasalah / OK  │
│  Kolom: Pipa · Panjang · D · V · HL · Status        │
├──────────────────────────────────────────────────────┤
│  BLOK 5 — REKOMENDASI MATERIAL                       │
│  Tabel material per pipa                             │
│  + accordion "Dasar Pemilihan Material"              │
├──────────────────────────────────────────────────────┤
│  BLOK 6 — PANEL PRV  [hanya jika ada P-HIGH]         │
│  A. Penjelasan teknis mengapa perlu PRV              │
│  B. Tabel rekomendasi penempatan PRV                 │
│  C. Dua pilihan aksi (Fix Otomatis / Manual)         │
│  D. Konfirmasi setelah Fix selesai                   │
├──────────────────────────────────────────────────────┤
│  BLOK 7 — DOWNLOAD                                   │
│  Tombol unduh (1–4 file bergantung kondisi)          │
│  + info token terpakai + tombol Analisis File Baru   │
└──────────────────────────────────────────────────────┘
```

### Logika Urutan

Urutan blok mengikuti alur berpikir engineer saat membaca laporan hasil analisis:

1. **Status global dulu** — sebelum membaca detail, user perlu tahu apakah hasilnya secara keseluruhan sudah baik atau belum.
2. **Angka ringkasan** — berapa node, berapa pipa, berapa yang berhasil diselesaikan.
3. **Detail per komponen** — node dulu (karena lebih mudah dipahami), baru pipa (lebih teknis).
4. **Rekomendasi lanjutan** — material dan PRV adalah hasil turunan dari analisis, bukan data primer.
5. **Aksi dan output** — setelah semua informasi dibaca, tombol download ada di posisi yang natural.

---

## 11. Status Badge — Referensi

### Badge Node (Tekanan)

| Kode | Label Badge | Kondisi | Warna |
|---|---|---|---|
| P-OK | `✅ OK` | Tekanan 10–80 m | Hijau |
| P-LOW | `⚠️ P-LOW` | Tekanan 0–10 m | Kuning |
| P-HIGH | `⚠️ P-HIGH` | Tekanan > 80 m | Kuning/Oranye |
| P-NEG | `🔴 P-NEG` | Tekanan < 0 m (KRITIS) | Merah |

### Badge Pipa (Kecepatan & Headloss)

Pipa dievaluasi berdasarkan kombinasi flag V dan HL. Badge menampilkan kondisi yang paling kritikal:

| Kondisi | Label Badge | Warna |
|---|---|---|
| V-OK + HL-OK | `✅ OK` | Hijau |
| V-LOW saja | `⚠️ V-LOW` | Kuning |
| V-HIGH saja | `🔴 V-HIGH` | Merah |
| HL-HIGH saja | `🔴 HL-HIGH` | Merah |
| V-HIGH + HL-HIGH | `🔴 Terlalu Kecil` | Merah (prioritas tinggi) |

**Catatan:** Kombinasi V-HIGH + HL-HIGH adalah flag `HL-SMALL` di sistem (diameter terlalu kecil) dan merupakan prioritas pertama dalam iterasi. Badge-nya menggunakan label yang mudah dipahami user awam ("Terlalu Kecil") daripada kode teknis.

### Aturan Umum Badge

- Badge selalu menggunakan label yang bisa dibaca user non-ahli, bukan kode internal sistem.
- Warna badge konsisten di seluruh halaman: hijau = aman, kuning = perhatian, merah = masalah.
- Badge tidak pernah berdiri sendiri tanpa konteks — selalu ada penjelasan threshold di header blok tabel masing-masing.

---

*Dokumen ini adalah bagian dari rangkaian dokumentasi EPANET Solver*
*Baca bersama: `LANDING_PAGE_LAYOUT.md`, `EPANET_Solver_Logic_Documentation.md`, dan `DESIGN.md`*
*Versi: 1.0 | April 2026*
