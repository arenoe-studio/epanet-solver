# Dokumentasi Logic Sistem Inti — EPANET Solver
## Workflow Engine & Decision Logic
### Versi 1.0 | April 2026

---

## Daftar Isi

1. [Overview Alur Sistem](#1-overview-alur-sistem)
2. [Input — Struktur File .inp yang Diterima](#2-input--struktur-file-inp-yang-diterima)
3. [Modul 1 — Simulasi Baseline](#3-modul-1--simulasi-baseline)
4. [Modul 2 — Iterasi Diameter Otomatis](#4-modul-2--iterasi-diameter-otomatis)
5. [Logic Rekomendasi Material](#5-logic-rekomendasi-material)
6. [Modul 3 — Analisis & Fix PRV](#6-modul-3--analisis--fix-prv)
7. [Output — Tiga Kondisi Download](#7-output--tiga-kondisi-download)
8. [Struktur Laporan .md](#8-struktur-laporan-md)
9. [Referensi Teknis Material Pipa](#9-referensi-teknis-material-pipa)
10. [Referensi Standar Kriteria Hidraulik](#10-referensi-standar-kriteria-hidraulik)

---

## 1. Overview Alur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER UPLOAD .inp                         │
│         (file export EPANET: File > Export > Network)           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   USER KLIK "ANALISIS"                          │
│                     Debit: 6 token                              │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│  MODUL 1 — SIMULASI BASELINE                                     │
│  Baca .inp → jalankan solver WNTR → deteksi semua flag masalah   │
│  (berjalan otomatis, user tidak perlu lihat kondisi awal)        │
└──────────┬───────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│  MODUL 2 — ITERASI DIAMETER + REKOMENDASI MATERIAL               │
│  Iterasi diameter hingga V dan HL optimal                        │
│  Rekomendasikan material per pipa berdasarkan tekanan & diameter │
└──────────┬───────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────┬───────────────────────────────────────┐
│  Semua OK?               │  Ada P-HIGH?                         │
│  V ✅ HL ✅ P ✅          │  V ✅ HL ✅ P ❌                      │
└──────────┬───────────────┴──────────────────────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐     ┌────────────────────────────────────────┐
│  OUTPUT FINAL    │     │  MODUL 3 — ANALISIS PRV                │
│  .inp + .md      │     │  Tampilkan rekomendasi penempatan PRV  │
│  siap diunduh    │     │  + detail setting                      │
└──────────────────┘     │  + tombol "FIX PRESSURE" (token baru)  │
                         └──────────────┬───────────────────────┘
                                        │
                    ┌───────────────────┴──────────────────────┐
                    │  User SKIP Fix       │  User klik FIX    │
                    │  (abaikan PRV)       │  (bayar token)    │
                    ▼                      ▼
              ┌──────────┐        ┌─────────────────────┐
              │ Download │        │  PRV disisipkan ke   │
              │ Kondisi 1│        │  .inp + sim ulang    │
              │ (tanpa   │        └──────────┬───────────┘
              │  PRV)    │                   ▼
              └──────────┘        ┌─────────────────────┐
                                  │  Download Kondisi 2  │
                                  │  (.inp final + PRV)  │
                                  └─────────────────────┘
```

---

## 2. Input — Struktur File .inp yang Diterima

### Format yang Diterima

File `.inp` adalah hasil export dari EPANET desktop via:
`File → Export → Network → *.inp`

Sistem akan membaca dan menggunakan section berikut:

| Section | Data yang Dibaca | Keterangan |
|---|---|---|
| `[JUNCTIONS]` | ID, Elevasi, Demand | Demand = FIXED, tidak diubah sistem |
| `[RESERVOIRS]` | ID, Head | Sumber energi jaringan |
| `[PIPES]` | ID, Node1, Node2, Length, Diameter, Roughness | Diameter & Roughness = target iterasi |
| `[VALVES]` | ID, Node1, Node2, Type, Setting | Dibaca, bisa ditambah PRV oleh Modul 3 |
| `[OPTIONS]` | Units, Headloss formula | Wajib ada untuk validasi |
| `[COORDINATES]` | X, Y per node | Untuk visualisasi peta jaringan di UI |

### Validasi File Sebelum Diproses

```
Cek 1: Ekstensi file = .inp
Cek 2: Section wajib ada: [JUNCTIONS], [RESERVOIRS], [PIPES], [OPTIONS]
Cek 3: Minimal 1 reservoir dan 1 junction
Cek 4: Minimal 1 pipa yang menghubungkan reservoir ke jaringan
Cek 5: Unit = LPS (sistem didesain untuk LPS)
Cek 6: Headloss formula = H-W (Hazen-Williams)

Jika gagal → return error dengan pesan spesifik
Jika lulus → lanjut ke Modul 1
```

### Yang Tidak Diubah Sistem

```
✅ DIBACA SAJA (tidak diubah):
- Demand setiap junction     → kebutuhan nyata desa, FIXED
- Elevasi setiap node        → data topografi lapangan, FIXED
- Head reservoir             → kondisi fisik reservoir, FIXED
- Panjang pipa               → trase lapangan, FIXED
- Topologi (siapa connect ke siapa) → FIXED

🔄 DIUBAH oleh Modul 2:
- Diameter pipa              → diiterasi otomatis
- Roughness coefficient      → disesuaikan dengan material rekomendasi

➕ DITAMBAHKAN oleh Modul 3 (opsional):
- Valve PRV                  → disisipkan jika user klik Fix Pressure
- Junction baru (titik PRV)  → node sisipan untuk PRV
```

---

## 3. Modul 1 — Simulasi Baseline

### Tujuan

Menjalankan simulasi awal menggunakan file `.inp` apa adanya dari user. Output modul ini adalah **kondisi awal jaringan** yang menjadi acuan Modul 2. User **tidak perlu melihat** hasil baseline ini secara langsung di UI — modul 1 dan modul 2 berjalan sekaligus tanpa interupsi.

### Proses

```python
# Pseudocode Modul 1

import wntr

# 1. Load file .inp
wn = wntr.network.WaterNetworkModel('input.inp')

# 2. Jalankan simulasi
sim = wntr.sim.EpanetSimulator(wn)
results = sim.run_sim()

# 3. Ekstrak hasil
pressure  = results.node['pressure']    # m, per junction
head      = results.node['head']        # m, per junction
flow      = results.link['flowrate']    # LPS, per pipa
velocity  = results.link['velocity']    # m/s, per pipa
headloss  = results.link['headloss']    # m, per pipa

# 4. Hitung unit headloss per pipa
for pipe_id in wn.pipe_name_list:
    pipe = wn.get_link(pipe_id)
    length_km = pipe.length / 1000
    unit_hl[pipe_id] = abs(headloss[pipe_id]) / length_km  # m/km

# 5. Deteksi semua flag masalah
flags = detect_all_flags(pressure, velocity, unit_hl)
```

### Flag yang Dideteksi

```
FLAG NODE:
- P-NEG   : pressure < 0 m          → KRITIS
- P-LOW   : 0 ≤ pressure < 10 m     → MASALAH
- P-OK    : 10 ≤ pressure ≤ 80 m    → AMAN
- P-HIGH  : pressure > 80 m         → MASALAH (butuh PRV)

FLAG PIPA:
- V-LOW   : velocity < 0,3 m/s      → MASALAH
- V-OK    : 0,3 ≤ velocity ≤ 2,5   → AMAN
- V-HIGH  : velocity > 2,5 m/s     → MASALAH
- HL-OK   : unit_hl ≤ 10 m/km      → AMAN
- HL-HIGH : unit_hl > 10 m/km      → MASALAH

KOMBINASI PRIORITAS:
- HL-SMALL: V-HIGH + HL-HIGH bersamaan → PRIORITAS 1 (diameter terlalu kecil)
```

### Output Modul 1

```
baseline_results = {
  'node_pressure': {node_id: pressure_m},
  'pipe_velocity': {pipe_id: velocity_ms},
  'pipe_unit_hl':  {pipe_id: unit_hl_m_per_km},
  'pipe_flow':     {pipe_id: flow_lps},
  'flags': {
    'nodes': {node_id: 'P-NEG'|'P-LOW'|'P-OK'|'P-HIGH'},
    'pipes': {pipe_id: ['V-LOW'|'V-OK'|'V-HIGH', 'HL-OK'|'HL-HIGH']}
  },
  'summary': {
    'total_p_neg': int,
    'total_p_low': int,
    'total_p_high': int,
    'total_v_low': int,
    'total_v_high': int,
    'total_hl_high': int,
    'total_hl_small': int
  }
}
```

---

## 4. Modul 2 — Iterasi Diameter Otomatis

### Tujuan

Mengiterasi diameter setiap pipa hingga semua kriteria **Velocity** dan **Headloss** terpenuhi. Modul ini **tidak menyentuh** masalah pressure — P-HIGH diserahkan ke Modul 3.

### Diameter Standar yang Digunakan

Sistem hanya menggunakan diameter yang **nyata tersedia di pasaran Indonesia** (SNI):

```python
STANDARD_DIAMETERS = [
    40, 50, 63, 75, 90, 110, 125, 150,
    200, 250, 315, 400, 500
]  # satuan: mm
```

**Referensi:** 
- Pipa PVC SNI: diameter 63mm s/d 630mm (SNI 06-2550-1991)
- Pipa HDPE SNI: diameter 20mm s/d 630mm (SNI 4829.2:2015 / ISO 4427)
- Pipa GIP SNI: diameter 21.3mm s/d 114.3mm (SNI 07-0242.1-2000)

### Formula Perhitungan Diameter Optimal

**Syarat 1 — Dari batas Velocity maksimum (2,5 m/s):**
```
D_min_V = sqrt(4 × Q / (π × V_max))

Dimana:
Q     = flow aktual pipa (m³/s) dari hasil simulasi
V_max = 2,5 m/s (Permen PU No. 18/2007)
```

**Syarat 2 — Dari batas Headloss maksimum (10 m/km):**
```
D_min_HL = [10.67 × Q^1.852 / (C^1.852 × HL_target/1000)]^(1/4.87)

Dimana:
Q          = flow aktual (m³/s)
C          = roughness coefficient (dari material)
HL_target  = 10 m/km = 0,01 m/m
```

**Diameter rekomendasi:**
```
D_calc = MAX(D_min_V, D_min_HL)
D_rec  = diameter standar terkecil yang ≥ D_calc
```

### Urutan Iterasi

```
ITERASI 1 (Prioritas tertinggi — HL-SMALL):
  Untuk setiap pipa dengan flag V-HIGH + HL-HIGH:
  → Hitung D_rec dari formula
  → Update diameter ke D_rec
  → Update roughness ke nilai C material yang akan direkomendasikan

ITERASI 2 (HL-HIGH saja):
  Untuk setiap pipa dengan flag HL-HIGH (V masih OK):
  → Hitung D_rec dari formula HL saja
  → Update diameter ke D_rec

ITERASI 3 (V-HIGH saja):
  Untuk setiap pipa dengan flag V-HIGH (HL sudah OK):
  → Hitung D_rec dari formula V saja
  → Update diameter ke D_rec

ITERASI 4 (V-LOW):
  Untuk setiap pipa dengan flag V-LOW:
  → Cari diameter standar LEBIH KECIL dari diameter saat ini
  → yang masih menghasilkan V ≥ 0,3 m/s

Setelah setiap putaran:
  → Jalankan ulang simulasi WNTR
  → Evaluasi flag baru
  → Ulangi jika masih ada V-HIGH, V-LOW, atau HL-HIGH
  → Hentikan jika semua flag V dan HL sudah OK
  → ATAU hentikan jika sudah 50 iterasi (max)
  → ATAU hentikan jika tidak ada perubahan dari putaran sebelumnya
```

### Catatan Penting Iterasi

```
1. FLOW TIDAK DIUBAH MANUAL
   → Setiap perubahan diameter akan otomatis mengubah distribusi
     flow dalam loop melalui solver WNTR
   → Sistem tidak perlu menebak flow — biarkan solver yang atur

2. PRESSURE DIABAIKAN DI MODUL INI
   → Perubahan diameter memang akan mempengaruhi pressure
   → Tapi keputusan soal P-HIGH diserahkan sepenuhnya ke Modul 3
   → Modul 2 hanya fokus: V dan HL harus OK dulu

3. DIAMETER TIDAK BOLEH MELEBIHI BATAS MATERIAL
   → Setelah rekomendasi material ditentukan (Modul 2 bagian akhir),
     diameter dibatasi oleh ketersediaan material tersebut
   → Misal GIP hanya tersedia max ~110mm (4") di pasaran Indonesia
   → Jika kebutuhan diameter > batas material → flag sebagai
     "perlu pertimbangan material alternatif" di laporan

4. ROUGHNESS DIUPDATE BERSAMAAN
   → Ketika diameter pipa diubah, roughness C juga diupdate
     sesuai material yang direkomendasikan sistem
```

---

## 5. Logic Rekomendasi Material

### Prinsip Dasar

Sistem merekomendasikan material berdasarkan **dua parameter hasil simulasi** per pipa:
1. **Tekanan kerja aktual** di pipa tersebut (head upstream - head downstream)
2. **Diameter hasil iterasi** yang direkomendasikan Modul 2

Material **bukan** dipilih user — sistem yang merekomendasikan, dan rekomendasi ini ditampilkan di laporan sebagai panduan.

### Nilai C (Roughness Hazen-Williams) per Material

Sesuai **EPANET 2.2 Users Manual, Table 3.2** dan referensi perencanaan Indonesia:

| Material | C (Hazen-Williams) | Referensi |
|---|---|---|
| PVC (baru, SNI) | 140 | EPANET Manual Table 3.2; Permen PU 18/2007 |
| HDPE PE100 (baru) | 140 | EPANET Manual Table 3.2 |
| HDPE PE80 (baru) | 135 | EPANET Manual Table 3.2 |
| GIP / Steel Baru | 120 | EPANET Manual Table 3.2 |
| GIP / Steel Lama | 100 | EPANET Manual Table 3.2 |
| Beton / Concrete | 130 | EPANET Manual Table 3.2 |

> **Catatan:** Nilai C di atas adalah nilai **tunggal representatif** yang dipakai sistem. EPANET Manual mencantumkan range (misal PVC: 140–150), sistem menggunakan nilai batas bawah yang lebih konservatif untuk keamanan desain.

### Spesifikasi Tekanan Maksimum per Material

Tekanan maksimum yang mampu ditahan pipa menentukan apakah material tersebut **layak** dipakai pada kondisi tekanan tertentu.

#### Pipa PVC (SNI 06-2550-1991)

| Kelas | Tekanan Max | Diameter Tersedia | Cocok Untuk |
|---|---|---|---|
| PVC AW (PN 10) | 10 bar = 100 m | ½" – 12" (15–300 mm) | Distribusi umum |
| PVC S-10 (PN 12.5) | 12,5 bar = 125 m | 1" – 24" (25–600 mm) | Tekanan sedang |
| PVC S-8 (PN 16) | 16 bar = 160 m | ¾" – 20" (20–500 mm) | Tekanan lebih tinggi |
| PVC S-6.3 (PN 20) | 20 bar = 200 m | ½" – 16" (15–400 mm) | Tekanan tinggi |

> **Referensi:** SNI 06-2550-1991 (Ketahanan dinding pipa PVC terhadap tekanan hidrostatis); Ragampipa.com — Kelas Pipa PVC SNI

**Untuk sistem ini**, PVC yang direkomendasikan adalah **PVC AW/PN10** (tekanan max 100m) sebagai pilihan paling umum dan ekonomis. Jika tekanan melebihi 100m, sistem akan merekomendasikan material lain.

#### Pipa HDPE (SNI 4829.2:2015 / ISO 4427)

| Grade & PN | Tekanan Max | Diameter Tersedia | Cocok Untuk |
|---|---|---|---|
| HDPE PE100 PN-6.3 | 6,3 bar = 63 m | 50 mm ke atas | Gravitasi ringan |
| HDPE PE100 PN-8 | 8 bar = 80 m | 50 mm ke atas | Distribusi standar |
| HDPE PE100 PN-10 | 10 bar = 100 m | 20 mm – 630 mm | Distribusi & transmisi |
| HDPE PE100 PN-12.5 | 12,5 bar = 125 m | 50 mm ke atas | Tekanan menengah |
| HDPE PE100 PN-16 | 16 bar = 160 m | 20 mm – 630 mm | Tekanan tinggi |

> **Referensi:** SNI 4829.2:2015; ISO 4427; Pipawavin.info — Penggunaan Pipa HDPE berdasarkan PN; SNI 06-4829-2005 (tekanan kerja maks 25 bar)

**Untuk sistem ini**, rekomendasi HDPE menggunakan **PE100 PN-10** sebagai default (tekanan max 100m, paling umum digunakan di PDAM Indonesia).

#### Pipa GIP / Galvanized Iron Pipe (SNI 07-0242.1-2000)

| Kelas | Tekanan Max | Diameter Tersedia | Cocok Untuk |
|---|---|---|---|
| GIP Medium | ~10 bar = 100 m | 21.3 mm – 114.3 mm | Distribusi kecil |
| GIP Heavy | ~16 bar = 160 m | 21.3 mm – 114.3 mm | Tekanan lebih tinggi |

> **Referensi:** SNI 07-0242.1-2000 (pipa baja dilas dan tanpa sambungan, galvanis panas); SNI 07-0663-1987; Caraka Pipa Air — Perbandingan Teknis Pipa HDPE dan GIP

**Catatan penting GIP:** Diameter maksimum yang umum tersedia di pasaran Indonesia adalah sekitar **4 inch (114.3 mm)**. Untuk diameter > 150 mm, GIP bukan pilihan praktis — gunakan HDPE atau material lain.

### Matriks Keputusan Material

Sistem mengevaluasi **setiap pipa** berdasarkan kombinasi tekanan aktual dan diameter hasil iterasi:

```
INPUT per pipa:
  P_kerja  = tekanan aktual di pipa (m) dari simulasi
             = rata-rata (head_node1 + head_node2) / 2 - elevasi_rata
  D_rec    = diameter hasil iterasi Modul 2 (mm)

MATRIKS KEPUTUSAN:
─────────────────────────────────────────────────────────────────────
Kondisi                          │ Material Rekomendasi   │ C   │ Alasan
─────────────────────────────────────────────────────────────────────
P ≤ 100m  DAN  D ≤ 110mm        │ PVC AW (PN10)          │ 140 │ Ekonomis, cukup kuat
P ≤ 100m  DAN  D > 110mm        │ HDPE PE100 PN-10       │ 140 │ PVC besar kurang umum
P 100–160m DAN D ≤ 110mm        │ HDPE PE100 PN-16       │ 140 │ Tekanan > batas PVC AW
P 100–160m DAN D > 110mm        │ HDPE PE100 PN-16       │ 140 │ Tekanan tinggi, diameter besar
P > 160m  (semua diameter)      │ Steel / GIP Heavy      │ 120 │ Tekanan ekstrem
─────────────────────────────────────────────────────────────────────

CATATAN KHUSUS — GIP:
Jika D_rec > 114mm DAN material seharusnya GIP:
  → Override ke HDPE PE100 PN-16
  → Tambahkan note di laporan:
    "GIP tidak tersedia dalam diameter ini di pasaran Indonesia.
     Diganti dengan HDPE PE100 PN-16 yang memiliki kemampuan
     tekanan setara."
```

### Note Tekanan Belum PRV

Untuk pipa dengan flag **P-HIGH** (tekanan > 80m) yang belum ada PRV-nya:

```
Jika pipa berada di zone yang P-HIGH:
  → Rekomendasi material tetap berdasarkan tekanan aktual saat ini
  → PLUS tambahkan note di laporan per pipa:

  "⚠️ CATATAN TEKANAN:
   Tekanan di pipa ini saat ini X m (melebihi batas aman 80m).
   Rekomendasi material sudah disesuaikan dengan kondisi ini.
   Setelah PRV dipasang, tekanan akan berubah — evaluasi ulang
   apakah material yang lebih ekonomis bisa digunakan."
```

---

## 6. Modul 3 — Analisis & Fix PRV

### Kapan Modul 3 Berjalan?

Modul 3 **hanya aktif** jika setelah Modul 2 selesai masih ada node dengan `P-HIGH` (pressure > 80m).

Jika tidak ada P-HIGH → Modul 3 dilewati, langsung ke output.

### Bagian A — Analisis Rekomendasi PRV (Otomatis, Tanpa Token Tambahan)

Sistem menganalisis secara otomatis di mana PRV sebaiknya dipasang:

```
ALGORITMA PENENTUAN LOKASI PRV:

Untuk setiap node dengan P-HIGH:

1. Identifikasi semua pipa yang langsung menuju node tersebut
   (pipa upstream langsung)

2. Evaluasi apakah satu PRV bisa cover beberapa node bermasalah:
   → Jika node A dan B sama-sama P-HIGH, dan keduanya downstream
     dari pipa yang sama → satu PRV di pipa itu cukup untuk keduanya
   → Prioritaskan penempatan PRV paling upstream
     (efisiensi: 1 PRV cover banyak node)

3. Hitung setting PRV optimal per lokasi:
   Setting_PRV = Pressure_target + Elevasi_node_terjauh_downstream

   Dimana:
   Pressure_target = 60 m (nilai tengah antara 10m dan 80m)
   Elevasi_node_terjauh = elevasi node hilir terjauh dari PRV ini

4. Estimasi pressure setelah PRV dipasang:
   Pressure_estimasi = Setting_PRV - Elevasi_node_hilir

   Validasi: apakah semua node hilir PRV ini pressure-nya 10–80m?
```

**Output Analisis yang Ditampilkan ke User:**

```
Tabel Rekomendasi PRV:
┌──────┬────────────┬────────────────┬──────────┬──────────────────────────────┐
│ No   │ Pipa PRV   │ Setting (m)    │ Node     │ Estimasi Pressure Setelah    │
│      │            │                │ Tercakup │ PRV (m)                      │
├──────┼────────────┼────────────────┼──────────┼──────────────────────────────┤
│  1   │ H-G        │ 60m downstream │ G, I, F  │ G=55m ✅ I=58m ✅ F=52m ✅   │
│  2   │ K-M        │ 80m downstream │ M, Q, P  │ M=65m ✅ Q=70m ✅ P=68m ✅   │
└──────┴────────────┴────────────────┴──────────┴──────────────────────────────┘

Catatan: Estimasi berdasarkan kalkulasi statis.
Nilai aktual setelah simulasi mungkin sedikit berbeda.
Gunakan tombol "FIX PRESSURE" untuk hasil presisi.
```

### Bagian B — Fix PRV Otomatis (Token Tambahan)

Jika user menekan tombol **"FIX PRESSURE"**:

```
PROSES FIX PRV OTOMATIS:

1. Untuk setiap lokasi PRV yang direkomendasikan:
   a. Buat junction baru di tengah pipa target
      (titik sisipan PRV, koordinat = tengah Node1-Node2)

   b. Pecah pipa menjadi 2:
      - Pipa_A: Node1 → Junction_PRV (panjang proporsional)
      - Pipa_B: Junction_PRV → Node2 (sisa panjang)
      - Kedua pipa mewarisi diameter & roughness pipa asli

   c. Tambahkan valve PRV:
      - Node1: Junction_PRV
      - Node2: node downstream
      - Type: PRV
      - Setting: nilai yang sudah dihitung
      - Diameter: sama dengan diameter pipa

2. Update file .inp dengan perubahan di atas

3. Jalankan simulasi ulang menggunakan WNTR

4. Evaluasi ulang semua flag:
   - Apakah P-HIGH sudah hilang?
   - Apakah V dan HL masih OK?
   - Apakah ada P-LOW baru muncul akibat PRV?
     (jika PRV setting terlalu rendah → node jauh bisa kekurangan)

5. Jika ada masalah baru → adjust setting PRV dan ulang
   Maksimal 10 iterasi untuk fine-tuning PRV

6. Generate output final
```

### Kenapa PRV Tidak Bisa Diselesaikan dengan Diameter?

Ini penting untuk dipahami dan dijelaskan di laporan:

```
PENJELASAN TEKNIS untuk USER (ditampilkan di UI dan laporan):

"Tekanan tinggi tidak bisa diperbaiki dengan mengubah diameter pipa.

Tekanan tinggi terjadi karena perbedaan elevasi antara reservoir
dan node yang besar. Ini adalah 'energi potensial' yang tersimpan
dalam air — bukan masalah hambatan aliran.

Memperbesar diameter justru MENAMBAH tekanan di hilir
(karena headloss berkurang, lebih banyak energi sampai ke node).

Memperkecil diameter akan menurunkan tekanan, tapi juga akan
meningkatkan headloss dan velocity → melanggar kriteria lain.

Solusi yang tepat adalah PRV — yang secara mekanis 'membuang'
kelebihan energi tanpa mengganggu debit aliran."
```

---

## 7. Output — Tiga Kondisi Download

### Kondisi 1 — Iterasi Selesai, PRV Belum Dipasang

**Kapan:** Setelah Modul 2 selesai, ada P-HIGH, user tidak/belum klik Fix PRV.

```
File yang tersedia:
✅ optimized_network_v1.inp
   → Diameter sudah dioptimasi (V dan HL OK)
   → Roughness sudah diupdate sesuai material rekomendasi
   → BELUM ada PRV
   → Siap dibuka di EPANET

✅ analysis_report_v1.md
   → Laporan lengkap Before vs After diameter
   → Rekomendasi material per pipa
   → Tabel rekomendasi PRV (advisory)
   → Flag P-HIGH yang masih ada
   → Note: "PRV belum dipasang — pasang manual di EPANET atau
            gunakan FIX PRESSURE untuk otomatis"
```

### Kondisi 2 — Fix PRV Sudah Dijalankan

**Kapan:** User klik Fix PRV, Modul 3 selesai.

```
File yang tersedia:
✅ optimized_network_final.inp
   → Diameter sudah dioptimasi
   → PRV sudah disisipkan di lokasi optimal
   → Semua kriteria terpenuhi (V ✅ HL ✅ P ✅)
   → Siap dibuka di EPANET

✅ analysis_report_final.md
   → Laporan lengkap termasuk log PRV
   → Before vs After semua parameter
   → Detail setiap PRV: lokasi, setting, node yang dicakup
```

### Kondisi 3 — User Abaikan PRV (Sama dengan Kondisi 1)

**Kapan:** User sadar ada P-HIGH tapi memilih download saja tanpa Fix PRV.

```
File yang tersedia: sama dengan Kondisi 1
User bisa setting PRV manual di EPANET mengikuti rekomendasi di laporan
```

---

## 8. Struktur Laporan .md

Laporan markdown yang dihasilkan sistem memiliki struktur berikut:

```markdown
# Laporan Analisis Jaringan Distribusi Air Bersih
## EPANET Solver — [Nama File] — [Tanggal & Waktu]

---

## Ringkasan Eksekutif

| Parameter        | Nilai                     |
|---|---|
| File Input       | nama_file.inp             |
| Total Junction   | 17 node                   |
| Total Pipa       | 21 pipa                   |
| Total Reservoir  | 1                         |
| Total Demand     | 72.5 LPS                  |
| Head Reservoir   | 300 m                     |
| Iterasi Diameter | 4 putaran                 |
| Durasi Proses    | 18 detik                  |
| Status Akhir     | V ✅ HL ✅ P ⚠️ (ada PRV)  |

---

## Masalah Ditemukan (Kondisi Awal)

| Kategori | Jumlah | Detail |
|---|---|---|
| P-NEG | 0 | — |
| P-LOW | 0 | — |
| P-HIGH | 12 node | A,B,C,D,E,F,G,H,I,J,L,M |
| V-HIGH | 5 pipa | K-H, K-M, M-Q, Q-P, RS-K |
| V-LOW | 3 pipa | E-F, I-F, N-D |
| HL-HIGH | 8 pipa | ... |

---

## Hasil Node — Before vs After

| Node | Elevasi | Pressure Awal | Pressure Akhir | Status |
|---|---|---|---|---|
| A | 55m | 156.9m | 156.2m | ⚠️ P-HIGH |
| K | 270m | 22.8m | 23.1m | ✅ OK |
| ... | | | | |

---

## Hasil Pipa — Before vs After

| Pipa | Panjang | D Awal | D Akhir | V Awal | V Akhir | HL Awal | HL Akhir | Status |
|---|---|---|---|---|---|---|---|---|
| RS-K | 835m | 100mm | 250mm | 9.23 | 1.48 | 745 | 8.6 | ✅ |
| ... | | | | | | | | |

---

## Rekomendasi Material per Pipa

| Pipa | D Rekomendasi | Material | C | Tekanan Kerja | Alasan |
|---|---|---|---|---|---|
| RS-K | 250mm | HDPE PE100 PN-10 | 140 | 7.2m | D besar, tekanan rendah |
| K-H | 200mm | HDPE PE100 PN-10 | 140 | 24.5m | D besar |
| E-F | 50mm | PVC AW PN-10 | 140 | 169m | ⚠️ Lihat catatan tekanan |
| ... | | | | | |

### ⚠️ Catatan Tekanan Belum PRV

Pipa berikut berada di zona dengan tekanan > 80m.
Rekomendasi material sudah disesuaikan dengan kondisi tekanan saat ini.
**Setelah PRV dipasang, tekanan akan berubah — evaluasi ulang material.**

| Pipa | Tekanan Saat Ini | Material Saat Ini | Kemungkinan Setelah PRV |
|---|---|---|---|
| E-F | 169m | HDPE PE100 PN-16 | PVC AW bisa digunakan |
| ... | | | |

---

## Rekomendasi PRV

### Lokasi PRV yang Disarankan

| No | Pipa | Setting PRV | Node Tercakup | Est. Pressure Setelah |
|---|---|---|---|---|
| 1 | H-G | 60m | G, I, F | G=55m ✅ I=58m ✅ F=52m ✅ |
| 2 | K-M | 80m | M, Q, P, N, O, A, B | Estimasi OK ✅ |

### Cara Pasang Manual di EPANET

Jika Anda tidak menggunakan fitur FIX PRESSURE otomatis:
1. Buka file `optimized_network_v1.inp` di EPANET
2. Untuk setiap PRV yang direkomendasikan:
   a. Klik kanan pipa target → Add Vertex → tambah titik di tengah
   b. Klik kanan titik tengah → Split → pipa terbagi dua
   c. Klik Add Valve di antara dua node hasil split
   d. Tipe: PRV | Setting: nilai di tabel atas | Diameter: sama pipa
3. Jalankan simulasi dan validasi hasilnya

---

## Log Iterasi Diameter

### Putaran 1
Masalah ditemukan: 5 pipa HL-SMALL, 3 pipa HL-HIGH, 3 pipa V-LOW
Perubahan: RS-K 100→250mm, K-M 100→200mm, K-H 100→200mm

### Putaran 2
Masalah tersisa: 2 pipa HL-HIGH, 2 pipa V-LOW
Perubahan: M-Q 100→200mm, Q-P 100→200mm

### Putaran 3
...

---

## Referensi Standar

- Permen PU No. 18/PRT/M/2007 — Kriteria hidraulik
- SNI 7509:2011 — Perencanaan jaringan distribusi SPAM
- EPANET 2.2 Users Manual, Table 3.2 — Roughness coefficients
- SNI 06-2550-1991 — Pipa PVC untuk air minum
- SNI 4829.2:2015 / ISO 4427 — Pipa HDPE untuk air minum
- SNI 07-0242.1-2000 — Pipa GIP
```

---

## 9. Referensi Teknis Material Pipa

### Tabel Referensi Lengkap

| Material | C (H-W) | P Max (bar) | P Max (m) | D Min (mm) | D Max (mm) | SNI/Standar |
|---|---|---|---|---|---|---|
| PVC AW/PN10 | 140 | 10 | 100 | 15 | 300 | SNI 06-2550-1991 |
| PVC S-8/PN16 | 140 | 16 | 160 | 20 | 500 | SNI 06-2550-1991 |
| PVC S-6.3/PN20 | 140 | 20 | 200 | 15 | 400 | SNI 06-2550-1991 |
| HDPE PE100 PN-8 | 140 | 8 | 80 | 50 | 630 | SNI 4829.2:2015 |
| HDPE PE100 PN-10 | 140 | 10 | 100 | 20 | 630 | SNI 4829.2:2015 |
| HDPE PE100 PN-16 | 140 | 16 | 160 | 20 | 630 | SNI 4829.2:2015 |
| GIP Medium | 120 | 10 | 100 | 21.3 | 114.3 | SNI 07-0242.1-2000 |
| GIP Heavy | 120 | 16 | 160 | 21.3 | 114.3 | SNI 07-0242.1-2000 |

> **Sumber C (Hazen-Williams):** EPANET 2.2 Users Manual, Chapter 3, Table 3.2 (Roughness Coefficients for New Pipe).
> Nilai yang digunakan sistem adalah nilai batas bawah dari range yang tercantum di manual (nilai konservatif).

### Catatan Konversi Tekanan

```
1 bar   = 1 kg/cm² = 10,2 m kolom air ≈ 10 m (dalam perhitungan ini dibulatkan ke 10m)
1 MPa   = 10 bar   = 102 m kolom air
1 atm   = 1,013 bar = 10,3 m kolom air

Contoh konversi:
HDPE PN-10 → 10 bar → 10 × 10 = 100 m kolom air
PVC AW     → 10 bar → 10 × 10 = 100 m kolom air
HDPE PN-16 → 16 bar → 16 × 10 = 160 m kolom air
```

---

## 10. Referensi Standar Kriteria Hidraulik

| Parameter | Nilai | Sumber |
|---|---|---|
| Tekanan minimum junction | 10 m | Permen PU No. 18/PRT/M/2007 |
| Tekanan maksimum junction | 80 m | Permen PU No. 18/PRT/M/2007 |
| Kecepatan minimum distribusi | 0,3 m/s | Permen PU No. 18/PRT/M/2007 |
| Kecepatan maksimum distribusi | 2,5 m/s | Permen PU No. 18/PRT/M/2007 |
| Headloss maksimum | 10 m/km | Permen PU No. 18/PRT/M/2007 |
| Debit desain | Q jam puncak | SNI 7509:2011 |
| Roughness PVC | C = 140 | EPANET 2.2 Manual, Table 3.2 |
| Roughness HDPE | C = 140 | EPANET 2.2 Manual, Table 3.2 |
| Roughness GIP Baru | C = 120 | EPANET 2.2 Manual, Table 3.2 |
| Roughness GIP Lama | C = 100 | EPANET 2.2 Manual, Table 3.2 |

### Daftar Standar Lengkap

- **Permen PU No. 18/PRT/M/2007** — Penyelenggaraan Pengembangan Sistem Penyediaan Air Minum
- **SNI 7509:2011** — Tata cara perencanaan teknik jaringan distribusi dan unit pelayanan SPAM
- **EPANET 2.2 Users Manual** — US EPA, Chapter 3 (Network Model), Table 3.2
- **SNI 06-2550-1991** — Ketahanan dinding pipa PVC terhadap tekanan hidrostatis
- **SNI 06-2551-1991** — Uji bentuk dan sifat tampak pipa PVC untuk air minum
- **SNI 4829.2:2015** — Sistem perpipaan plastik untuk penyediaan air minum (pipa PE)
- **ISO 4427** — Plastics piping systems for water supply (PE pipes)
- **SNI 07-0242.1-2000** — Spesifikasi pipa baja dilas dan tanpa sambungan dengan lapis hitam dan galvanis panas
- **SNI 06-4829-2005** — Pipa polietilena (PE) untuk air minum

---

*Dokumentasi ini adalah acuan logic sistem inti EPANET Solver v1.0*
*Semua threshold dan nilai teknis mengacu pada standar yang tercantum di bagian referensi*
*Perubahan pada logic ini harus disertai pembaruan referensi yang sesuai*
