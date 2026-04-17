# Brainstorming — Validasi Logic dari Practice di Lapangan
## EPANET Solver | Dokumen Pelengkap Logic Documentation
### April 2026

> **Konteks dokumen ini:**
> Dokumen ini adalah hasil riset dan brainstorming untuk memvalidasi logic sistem yang sudah didokumentasikan di `EPANET_Solver_Logic_Documentation.md`. Berisi temuan dari studi literatur, paper akademik, dan dokumentasi resmi EPANET tentang bagaimana praktisi dan akademisi menggunakan EPANET di dunia nyata — serta implikasinya terhadap pengembangan web app.

---

## Daftar Isi

1. [Yang Sudah Benar dari Logic Kita](#1-yang-sudah-benar-dari-logic-kita)
2. [Gap yang Ditemukan](#2-gap-yang-ditemukan)
3. [Scope v1 vs v2](#3-scope-v1-vs-v2)
4. [Keputusan Desain yang Dikonfirmasi](#4-keputusan-desain-yang-dikonfirmasi)
5. [Sumber Referensi Penelitian](#5-sumber-referensi-penelitian)

---

## 1. Yang Sudah Benar dari Logic Kita

### 1.1 Kriteria Teknis Sudah Sesuai Praktik Global

Dari berbagai paper akademik yang dikaji — studi kasus di India, Nigeria, Indonesia, dan Irak — semua menggunakan kriteria teknis yang sangat mirip dengan yang sudah didokumentasikan. Rentang pressure, velocity, dan headloss yang kita pakai terbukti realistis dan dipakai secara luas.

Sebagai referensi konkret: studi distribusi air desa Dumas, India (Springer, 2025) menghasilkan pressure 53–57m, velocity 0.12–1.79 m/s, dan unit headloss 0.09–4.37 m/km. Semua nilai ini masuk dalam rentang kriteria yang kita jadikan acuan.

### 1.2 Hazen-Williams Adalah Formula Dominan

Dari seluruh paper yang dikaji, Hazen-Williams (H-W) adalah formula headloss yang paling umum dipakai untuk distribusi air bersih di seluruh dunia, termasuk Indonesia. Keputusan untuk hanya men-support H-W di v1 sudah tepat, terutama untuk target user mahasiswa.

Catatan: Darcy-Weisbach lebih akurat secara teoritis dan berlaku untuk semua jenis aliran, tapi penggunaannya lebih kompleks dan jarang dijumpai pada tugas mahasiswa level S1.

### 1.3 PRV Memang Komponen Kritis untuk Topografi Berbukit

Dari EPANET 2.2 official documentation, cara kerja PRV di EPANET sudah terkonfirmasi: ketika PRV aktif, EPANET memisahkan jaringan di titik valve dan memperlakukan node downstream seolah-olah sebagai fixed grade node dengan head sama dengan nilai setting PRV ditambah elevasi node tersebut. Ini mengkonfirmasi bahwa logic insert PRV yang sudah kita rancang secara teknis sudah benar.

### 1.4 Iterasi Diameter Adalah Pendekatan Standar

Dari berbagai studi kasus, optimasi jaringan distribusi air selalu berujung pada penyesuaian diameter pipa sebagai variabel utama. Variabel lain seperti panjang pipa dan demand dianggap fixed dari kondisi lapangan. Ini konsisten dengan keputusan desain yang sudah kita buat.

---

## 2. Gap yang Ditemukan

Ini adalah temuan yang **belum ada di logic documentation sebelumnya** dan perlu menjadi pertimbangan pengembangan.

---

### 2.1 Pompa (PUMP) — Komponen Paling Umum yang Belum Dihandle

**Temuan dari riset:**

Dari berbagai paper, sistem distribusi yang paling umum dipakai secara universal adalah *combined gravity and pumping system* — air dipompa dari sumber ke reservoir distribusi, lalu dialirkan secara gravitasi ke jaringan. Ini bukan edge case, ini adalah **norma** di banyak daerah.

Dua skenario umum yang dijumpai di lapangan:

```
Skenario A — Pure Gravity (yang kita handle sekarang):
Mata air / reservoir di elevasi tinggi → gravitasi → jaringan desa

Skenario B — Ada Pompa (belum dihandle):
Sumber air di bawah (sungai, sumur, mata air dataran rendah)
→ dipompa ke reservoir distribusi
→ gravitasi → jaringan desa
```

Skenario B sangat umum di Indonesia, termasuk untuk konteks PDAM dan SPAM pedesaan. Studi di Cirebon, Jawa Barat misalnya, menunjukkan bahwa meskipun distribusinya menggunakan gravitasi, tetap dibutuhkan distribution pump karena reservoir offtake berada di elevasi rendah.

**Implikasi untuk web app:**

Jika file `.inp` user mengandung `[PUMPS]` dengan data, logic iterasi diameter kita tetap bisa berjalan — tapi hasilnya bisa menyesatkan jika tidak ada peringatan yang jelas. Misalnya: diameter diperbesar → headloss turun → pressure naik, tapi pressure ini tidak realistis karena bergantung pada pump curve yang tidak kita validasi.

**Keputusan untuk v1:**

Deteksi keberadaan PUMP di file `.inp`. Jika ada:
- Sistem tetap menjalankan analisis dan iterasi diameter
- Tampilkan banner peringatan yang jelas di UI dan di laporan:

> *"File ini mengandung komponen pompa. Sistem hanya mengoptimasi diameter pipa. Performa pompa (pump curve, operating point) tidak dievaluasi dan perlu divalidasi secara manual di EPANET."*

Jangan blokir analisis — tetap jalankan. Tapi pastikan user tahu batasannya.

---

### 2.2 Tank (Bak Penampung) — Perilaku Berbeda dari Reservoir

**Temuan dari riset:**

Pola umum di sistem distribusi Indonesia adalah: sumber → GSR (Ground Service Reservoir) → pompa → ESR (Elevated Storage Reservoir) → gravitasi → jaringan. Tank (ESR maupun GSR) adalah komponen yang sangat umum.

Perbedaan kritis antara Tank dan Reservoir di EPANET:

```
Reservoir:
- Head selalu tetap (fixed head boundary)
- Tidak berubah selama simulasi
- Cocok untuk simulasi steady state (yang kita pakai)

Tank:
- Level air berubah seiring waktu
- Bisa empty → aliran berhenti
- Bisa full → inflow berhenti
- Hanya relevan untuk Extended Period Simulation (EPS)
```

**Implikasi untuk web app:**

Jika file `.inp` user mengandung `[TANKS]` dengan data (bukan hanya header kosong), simulasi steady state yang kita jalankan memperlakukan tank seolah-olah reservoir dengan head = elevasi + initial level. Ini tidak salah secara teknis untuk steady state, tapi perlu dikomunikasikan ke user.

**Keputusan untuk v1:**

Deteksi keberadaan TANK di file `.inp`. Jika ada:
- Sistem tetap menjalankan analisis
- Tampilkan catatan di laporan:

> *"File ini mengandung storage tank. Analisis menggunakan simulasi steady state — kondisi tank diasumsikan tetap pada initial level yang diinput. Untuk analisis dinamis (apakah tank cukup untuk 24 jam), gunakan Extended Period Simulation di EPANET langsung."*

---

### 2.3 Extended Period Simulation (EPS) vs Steady State

**Temuan dari riset:**

Semua analisis kita saat ini adalah **steady state** — kondisi satu titik waktu dengan demand konstan. Di dunia nyata, demand berfluktuasi sangat signifikan:

```
Jam puncak pagi (06.00–08.00) → demand tinggi → pressure turun
Siang (12.00–14.00)           → demand sedang
Malam (23.00–04.00)           → demand rendah → pressure naik (bisa P-HIGH)
```

Dalam praktik serius, engineer menggunakan time pattern untuk mensimulasikan fluktuasi ini. EPANET menyebutnya sebagai Extended Period Simulation (EPS).

Dampaknya pada hasil: diameter yang optimal di kondisi jam puncak belum tentu aman di kondisi demand rendah (pressure bisa jauh lebih tinggi dari 80m).

**Keputusan untuk v1:**

Tidak diimplementasi. Mayoritas file `.inp` tugas mahasiswa tidak memiliki time pattern yang bermakna. Steady state dengan demand konstan sudah cukup untuk tujuan akademis. Cukup tambahkan catatan di laporan:

> *"Analisis menggunakan simulasi steady state dengan demand konstan. Nilai pressure dan velocity yang ditampilkan adalah kondisi pada satu titik waktu. Untuk analisis 24 jam dengan variasi demand, gunakan Time Pattern di EPANET."*

---

### 2.4 Pressure Driven Demand (PDA) vs Demand Driven Analysis (DDA)

**Temuan dari riset:**

Logic kita menggunakan **DDA (Demand Driven Analysis)** — mode default EPANET di mana demand selalu terpenuhi penuh berapapun pressure-nya. Ini yang menyebabkan pressure negatif bisa muncul di simulasi: EPANET "memaksa" demand terpenuhi meski head tidak cukup.

Di dunia nyata, jika pressure terlalu rendah, air tidak keluar dari keran — demand tidak bisa terpenuhi. EPANET 2.2 memiliki fitur **PDA (Pressure Dependent Analysis)** yang lebih realistis untuk kondisi ini.

**Keputusan untuk v1:**

Tetap gunakan DDA. Alasannya: DDA adalah standar yang dipakai di hampir semua paper dan tugas akademik yang dikaji. PDA lebih relevan untuk studi resiliensi dan kondisi darurat. Cukup tambahkan catatan di laporan saat ada P-NEG:

> *"Tekanan negatif terdeteksi di node X. Dalam kondisi nyata, node ini tidak akan mendapat air (bukan bertekanan negatif). Perbesar diameter pipa upstream atau pertimbangkan booster pump."*

---

### 2.5 Minor Losses — Sering Diabaikan

**Temuan dari riset:**

Dari EPANET Manual, minor losses (losses di tikungan, fitting, dll) memang bisa dimasukkan via koefisien `MinorLoss` per pipa. Namun dari semua file `.inp` yang dikaji (termasuk file tugas mahasiswa), nilai `MinorLoss = 0` hampir selalu dipakai.

Ini bukan kesalahan — untuk jaringan distribusi skala kecamatan/desa dengan pipa panjang, minor losses kontribusinya kecil dibanding friction losses. Praktek mengabaikannya adalah umum dan dibenarkan.

**Keputusan untuk v1:**

Tidak dihandle. Cukup tambahkan satu baris catatan di laporan:

> *"Minor losses (tikungan, fitting) tidak diperhitungkan dalam analisis ini, sesuai dengan file input yang diterima."*

---

### 2.6 Penambahan Logic — Bedakan P-LOW karena Diameter vs karena Butuh Pompa

**Temuan dari brainstorming:**

Ini temuan penting yang muncul dari diskusi tentang pompa. Ada dua penyebab berbeda untuk P-LOW atau P-NEG yang butuh solusi berbeda:

```
Penyebab 1 — Diameter pipa terlalu kecil:
Head tersedia cukup, tapi headloss terlalu besar
→ Solusi: perbesar diameter (sudah ada di logic kita)

Penyebab 2 — Head reservoir tidak cukup untuk menjangkau node:
Beda elevasi terlalu kecil, atau node lebih tinggi dari head efektif
→ Solusi: tambah pompa (booster pump)
→ Bukan solusi: perbesar diameter
```

**Cara membedakannya:**

```python
# Indikator butuh pompa (bukan diameter):
# Jika tekanan statis sudah sangat kecil atau negatif
# (sebelum ada headloss sama sekali)

tekanan_statis = head_reservoir - elevasi_node

if tekanan_statis < 5:
    # Head reservoir hampir tidak cukup bahkan tanpa headloss
    # → Perbesar diameter tidak akan membantu signifikan
    # → Flag sebagai "kemungkinan butuh booster pump"
    flag = "PUMP_NEEDED"
elif tekanan_statis >= 5 and pressure_aktual < 10:
    # Head tersedia cukup tapi habis di perjalanan
    # → Perbesar diameter bisa membantu
    flag = "P-LOW_DIAMETER"
```

**Keputusan untuk v1:**

Tambahkan logic deteksi ini ke Modul 2. Jika `tekanan_statis < 5m` untuk suatu node, jangan coba iterasi diameter untuk node tersebut. Tampilkan flag khusus di laporan:

> *"⚠️ Node X: Head reservoir tidak cukup untuk menjangkau elevasi node ini bahkan tanpa headloss. Solusi yang diperlukan adalah booster pump, bukan penyesuaian diameter pipa."*

Ini mencegah sistem membuang iterasi percuma dan memberikan rekomendasi yang menyesatkan.

---

## 3. Scope v1 vs v2

### Scope v1 — Yang Diimplementasi Sekarang

```
✅ Pure gravity system (reservoir sebagai satu-satunya sumber energi)
✅ Steady state simulation (satu titik waktu, demand konstan)
✅ Demand Driven Analysis (DDA) — mode default EPANET
✅ Hazen-Williams headloss formula
✅ Iterasi diameter otomatis (V dan HL)
✅ Rekomendasi material berdasarkan tekanan kerja dan diameter
✅ Analisis dan Fix PRV untuk P-HIGH
✅ Deteksi PUMP dan TANK di file .inp → tampilkan peringatan
✅ Deteksi P-LOW karena head tidak cukup vs diameter kecil
✅ Minor losses diabaikan (sesuai praktik umum)
✅ Catatan informatif di laporan untuk semua keterbatasan di atas
```

### Scope v2 — Ditunda

```
🔜 Extended Period Simulation dengan time pattern
🔜 Evaluasi pump curve dan operating point
🔜 Analisis kebutuhan booster pump (sizing)
🔜 Evaluasi kapasitas tank (apakah cukup untuk 24 jam)
🔜 Pressure Dependent Analysis (PDA)
🔜 Water quality simulation (chlorine residual, water age)
🔜 Fire flow analysis
🔜 Darcy-Weisbach headloss formula sebagai alternatif
```

---

## 4. Keputusan Desain yang Dikonfirmasi

Berikut adalah rangkuman keputusan desain yang sudah dikonfirmasi dalam diskusi dan riset ini. Ini menjadi **acuan tidak berubah** untuk v1.

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Demand tidak diubah sistem | Data nyata dari lapangan, tidak boleh dimanipulasi |
| 2 | Panjang pipa tidak diubah sistem | Representasi trase fisik di lapangan, keputusan engineer |
| 3 | Roughness C diupdate otomatis mengikuti material rekomendasi | Konsistensi — satu material = satu nilai C |
| 4 | Nilai C dari EPANET 2.2 Manual Table 3.2 | Sumber paling otoritatif dan diakui secara internasional |
| 5 | Nilai C menggunakan batas bawah dari range | Lebih konservatif → lebih aman untuk desain |
| 6 | Diameter standar dari daftar yang nyata tersedia di Indonesia | Hasil desain harus bisa diimplementasi di lapangan |
| 7 | PRV adalah advisory + opsional Fix Otomatis | Lokasi PRV adalah keputusan lapangan, tapi user "malas" perlu opsi cepat |
| 8 | Material direkomendasikan sistem, bukan dipilih user | Simplifikasi UX — user tidak perlu tahu nilai C |
| 9 | Tekanan kerja menjadi penentu utama pemilihan material | Keamanan material harus sesuai tekanan aktual |
| 10 | Catatan "tekanan belum PRV" pada material di zona P-HIGH | Material direkomendasikan untuk kondisi saat ini, bisa berubah setelah PRV |
| 11 | Deteksi PUMP/TANK → peringatan, bukan blokir | Sistem tetap berguna meski file kompleks |
| 12 | Bedakan P-LOW karena diameter vs karena head tidak cukup | Memberikan rekomendasi yang tepat sasaran |

---

## 5. Sumber Referensi Penelitian

Berikut adalah sumber yang digunakan dalam proses validasi ini:

**Dokumentasi Resmi:**
- EPANET 2.2 Users Manual — US EPA (Chapter 3: Network Model, Chapter 12: Analysis Algorithms, Chapter 13: FAQ)
- EPANET 2.2 Official Documentation — epanet22.readthedocs.io

**Paper Akademik:**
- Patel, A., et al. (2025). *Hydraulic Analysis and Simulation of Dumas Village Water Distribution Network Using EPANET.* Springer — Lecture Notes in Civil Engineering, vol 560. [Validasi kriteria teknis]
- Adeniran, A.E. & Oyelowo, M.A. (2013). *An EPANET Analysis of Water Distribution Network of the University of Lagos, Nigeria.* [Validasi kriteria velocity dan pressure]
- Academia.edu — *Design of a Gravity Water Distribution System Using EPANET Software* (Studi kasus Cirebon, Jawa Barat) [Validasi kebutuhan pompa pada sistem gravitasi]
- ResearchGate — *Design of Water Distribution System Using EPANET* [Combined gravity-pumping system]
- JETIR (2023) — *Analysis of Water Distribution Network Using EPANET* [Hardy-Cross vs EPANET]

**Standar Indonesia:**
- Permen PU No. 18/PRT/M/2007 — Kriteria hidraulik distribusi air minum
- SNI 7509:2011 — Perencanaan teknik jaringan distribusi SPAM
- SNI 06-2550-1991 — Pipa PVC untuk air minum
- SNI 4829.2:2015 / ISO 4427 — Pipa HDPE untuk air minum
- SNI 07-0242.1-2000 — Pipa GIP

---

*Dokumen ini adalah pelengkap dari `EPANET_Solver_Logic_Documentation.md`*
*Keduanya harus dibaca bersama untuk memahami logic sistem secara lengkap*
*Versi: 1.0 | April 2026*
