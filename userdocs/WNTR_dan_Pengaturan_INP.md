# WNTR dan Pengaturan EPANET `.inp` (Apa yang Diikuti oleh EPANET Solver)

Dokumen ini menjelaskan bagaimana **EPANET Solver** membaca file **EPANET `.inp`** dan apakah “setting” (mis. formula headloss, units, time settings, dll.) akan mempengaruhi perhitungan saat simulasi/optimasi dijalankan memakai **WNTR**.

> **Ringkasnya:** sumber kebenaran utama adalah **file `.inp`**. EPANET Solver memuat `.inp` menjadi **`WaterNetworkModel` (WNTR)**. Sebagian besar parameter jaringan dan opsi hidraulik ikut terbawa dari `.inp`, tetapi **implementasi SaaS saat ini menjalankan simulasi sebagai snapshot (t=0)** dan memiliki beberapa simplifikasi pada algoritma optimasi.

---

## 1) Dari mana WNTR “tahu” setting EPANET?

EPANET Solver memuat jaringan langsung dari file `.inp`:

- Loader: `api/epanet/network_io.py` → `load_network()`
- API entrypoint: `api/analyze_python.py`

Di dalam loader, file `.inp` dibaca oleh:

- `wntr.network.WaterNetworkModel(<path_inp>)`

Artinya, seluruh informasi yang ada di `.inp` (node, pipe, demand, pattern, opsi, dll.) akan diparse oleh WNTR dan disimpan di objek `wn` (WaterNetworkModel). Simulator kemudian menggunakan objek `wn` tersebut sebagai input.

Catatan: ada sanitasi kecil untuk section **`[VERTICES]`** jika ada referensi pipa yang tidak valid. Ini murni data visual dan tidak mempengaruhi hidraulik.

---

## 2) Simulator apa yang dipakai? (Penting untuk “kesesuaian setting”)

Saat ini EPANET Solver menjalankan simulasi dengan **WNTRSimulator**:

- `api/epanet/simulation.py` → `run_simulation()`:
  - `wn.sim_time = 0`
  - `results = wntr.sim.WNTRSimulator(wn).run_sim()`
  - Hasil yang dipakai adalah timestep pertama: `iloc[0]`

Implikasi praktis:

- Simulasi yang dipakai untuk evaluasi/optimasi adalah **snapshot pada waktu awal (t=0)**.
- Pengaturan **Extended Period Simulation (EPS)** di `.inp` tetap diparse, tetapi **tidak dieksplor sepanjang durasi** karena sistem hanya mengambil hasil di timestep pertama.

Jika di masa depan ingin “100% EPANET engine parity” (mengikuti EPANET toolkit secara langsung), arsitektur bisa dialihkan ke `wntr.sim.EpanetSimulator`. Namun saat ini belum dipakai.

---

## 3) Pengaturan `.inp` apa saja yang mempengaruhi hasil?

### A. Yang pasti mempengaruhi (karena bagian dari model jaringan)

WNTR memuat network dari `.inp`, sehingga parameter jaringan berikut ikut mempengaruhi hasil simulasi:

- **Topologi**: node & link (junction, reservoir, tank, pipe, pump, valve)
- **Geometri & properti fisik**: elevasi, panjang pipa, diameter awal, roughness, minor loss, status (open/closed), dll.
- **Demand & pattern**: base demand, pattern demand (nilai pattern pada t=0 akan terpakai)
- **Curve / controls** (jika ada di `.inp`): diparse ke model dan dapat mempengaruhi perilaku elemen (bergantung dukungan simulator)

### B. Opsi hidraulik (mis. “formula”)

EPANET punya opsi seperti **formula headloss** (Hazen-Williams / Darcy-Weisbach / Chezy-Manning), units, dan opsi hidraulik lain yang umumnya ditulis di section **`[OPTIONS]`**.

- Opsi tersebut diparse ke `wn.options` oleh WNTR saat `WaterNetworkModel` dibuat.
- Simulator kemudian membaca `wn.options` sebagai bagian dari konfigurasi run.

Karena detail dukungan bisa berbeda antar versi WNTR dan antar simulator (WNTRSimulator vs EpanetSimulator), cara paling aman untuk memverifikasi adalah:

1. Pastikan opsi memang ada di `.inp` (mis. `HEADLOSS ...` di `[OPTIONS]`)
2. Setelah load, cek nilai di `wn.options` (di level kode)

---

## 4) Bagian “optimasi diameter” mengikuti setting `.inp` juga?

EPANET Solver melakukan optimasi dengan mengubah **diameter pipa** dan menjalankan ulang simulasi setiap iterasi:

- `api/epanet/optimizer.py` → `optimize_diameters()`

Namun ada 2 hal penting terkait “setting”:

1) **Validasi akhir selalu berdasarkan hasil simulasi WNTR**  
   Setelah diameter diubah, sistem selalu rerun simulasi dan mengevaluasi tekanan/kecepatan/headloss dari hasil simulator.

2) **Perhitungan “diameter optimal” memakai asumsi Hazen-Williams sederhana**  
   Metode analitis di:
   - `api/epanet/diameter.py` → `analytical_optimal_diameter()`

   Saat menghitung diameter minimum untuk batas headloss, kode memakai bentuk balik **Hazen-Williams** dan koefisien roughness (C) dari `.inp` per pipa (fallback ke default jika tidak terbaca):
   - `Pipe.roughness` (hasil parse `.inp` oleh WNTR)
   - fallback: `api/epanet/config.py` → `HW_C_DEFAULT = 130.0`

   Ini berarti:
   - Jika `.inp` Anda menggunakan **Darcy-Weisbach** atau roughness yang sangat berbeda dari asumsi, angka “tebakan diameter optimal” bisa kurang presisi.
   - Tetapi hasil akhirnya tetap “dikoreksi” oleh simulasi (iterasi bisa berhenti di kondisi `CONVERGED`, `STUCK`, atau `STAGNANT`).

---

## 5) FAQ singkat

### Apakah pengaturan di EPANET GUI ikut terbaca?
Ya, selama pengaturan tersebut tersimpan di file `.inp`. EPANET Solver tidak membaca setting dari aplikasi desktop secara langsung; yang dibaca hanya file `.inp`.

### Kalau saya ubah formula headloss di EPANET (mis. Hazen-Williams → Darcy-Weisbach), apakah hasil berubah?
Secara prinsip, iya—karena opsi itu tersimpan di `.inp` dan diparse oleh WNTR ke `wn.options`. Tetapi akurasi/perilaku detail bergantung pada simulator yang dipakai (saat ini `WNTRSimulator`) dan versi library.

### Kenapa hasil saya tidak persis sama dengan EPANET desktop?
Beberapa penyebab umum:
- Engine yang dipakai saat ini `WNTRSimulator` (bukan EPANET toolkit langsung).
- Analisis mengambil **timestep pertama (t=0)**, jadi perilaku EPS sepanjang waktu tidak dievaluasi.
- Optimasi diameter memakai pendekatan analitis yang mengasumsikan Hazen-Williams untuk langkah “tebakan diameter”.

---

## 6) Rekomendasi praktis untuk user

- Jika studi Anda adalah **steady-state** (satu kondisi beban), pastikan demand/pattern pada t=0 sesuai skenario desain.
- Jika studi Anda butuh **EPS penuh** (mis. pola jam-jaman), saat ini hasil EPANET Solver **belum** merepresentasikan seluruh horizon waktu—hanya snapshot awal.
- Jika Anda memakai headloss non Hazen-Williams, anggap hasil optimasi diameter sebagai “starting point” yang tetap perlu dicek, karena langkah analitis memakai asumsi HW.
