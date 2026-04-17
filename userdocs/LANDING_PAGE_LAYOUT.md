# Layout Documentation — EPANET Solver Landing Page
### Versi 1.0 | April 2026

---

## Daftar Isi

1. [Prinsip Layout](#1-prinsip-layout)
2. [Navbar](#2-navbar)
3. [Hero Section](#3-hero-section)
4. [Network Preview Strip](#4-network-preview-strip)
5. [How It Works](#5-how-it-works)
6. [Technical Credibility](#6-technical-credibility)
7. [Video Tutorial](#7-video-tutorial)
8. [Pricing](#8-pricing)
9. [FAQ](#9-faq)
10. [Footer](#10-footer)
11. [Urutan Section & Scroll Flow](#11-urutan-section--scroll-flow)

---

## 1. Prinsip Layout

Landing page ini dirancang sebagai **satu halaman panjang (single scroll)** dengan navigasi anchor ke tiap section. Tidak ada multi-page routing di landing — semua konten ada dalam satu dokumen vertikal.

**Filosofi pacing:** Setiap section berdiri sendiri sebagai "ruang" yang terpisah. Whitespace antar section adalah bagian dari desain, bukan kekosongan yang perlu diisi. Ini menciptakan ritme baca yang tenang dan terasa premium meskipun kontennya teknis.

**Lebar konten:** Semua konten dibungkus dalam container dengan lebar maksimal yang konsisten (sekitar 1100–1200px), selalu di-center terhadap lebar viewport.

**Orientasi grid:** Mayoritas section menggunakan layout vertikal terpusat (center-aligned). Pengecualian ada di Section 7 (Video + Preview berdampingan) yang menggunakan split horizontal.

---

## 2. Navbar

**Posisi:** Fixed, menempel di atas viewport sepanjang scroll.

**Layout:** Horizontal satu baris — logo/nama produk di kiri, navigasi dan CTA di kanan.

**Elemen kiri:**
- Nama produk: **EPANET Solver** (teks, bukan gambar)

**Elemen kanan (dari kiri ke kanan):**
- Link teks: `Cara Kerja`
- Link teks: `Pricing`
- Link teks: `Dokumentasi` (menuju halaman docs terpisah, buka tab baru)
- Tombol CTA: **"Coba Gratis"** — ini adalah primary action di navbar, menggunakan pill shape

**Perilaku saat scroll:**
- Saat di paling atas halaman: background transparan dengan sedikit blur
- Setelah scroll beberapa pixel: background solid (sesuai design system) dengan border tipis di bawahnya

**Mobile:** Elemen kanan collapsed menjadi hamburger icon. Saat dibuka, menu muncul sebagai dropdown atau slide panel.

---

## 3. Hero Section

**Posisi:** Tepat di bawah navbar, section pertama yang terlihat.

**Layout:** Satu kolom, center-aligned. Konten ditumpuk secara vertikal di tengah halaman.

**Susunan elemen dari atas ke bawah:**

1. **Badge kecil** — satu baris teks kecil di dalam pill/chip shape:
   `"Sesuai Permen PU No. 18/PRT/M/2007"`
   Posisi: center, di atas headline.

2. **Headline utama** — ukuran display, sangat besar, letter-spacing rapat:
   Contoh arah teks: *"Optimasi Jaringan Distribusi Air. Tanpa Iterasi Manual."*
   Ditulis dalam 2 baris secara natural. Tidak lebih dari 10 kata total.

3. **Sub-headline** — 1–2 kalimat di bawah headline, ukuran lebih kecil, warna lebih soft:
   Menjelaskan mekanisme secara singkat: upload `.inp`, sistem analisis otomatis, download hasilnya.

4. **Grup CTA** — dua tombol berdampingan, center-aligned:
   - Tombol primer: **"Coba Gratis — 5 Token"** (pill, solid dark)
   - Tombol sekunder: **"Lihat Cara Kerja ↓"** (pill atau ghost, outline)

5. **Social proof micro** — satu baris kecil di bawah tombol:
   Tiga badge/chip kecil berderet horizontal:
   - `✓ Akurasi setara EPANET desktop`
   - `✓ Token tidak expired`
   - `✓ Output siap buka di EPANET`

**Catatan:** Tidak ada gambar atau ilustrasi besar di Hero. Hero adalah konten teks murni — kekuatannya ada pada ukuran dan densitas headline. Gambar/visual masuk di section berikutnya.

---

## 4. Network Preview Strip

**Posisi:** Langsung di bawah Hero, berfungsi sebagai jembatan visual menuju penjelasan cara kerja.

**Layout:** Container penuh lebar (full-width atau mendekati full-width), tinggi sedang — bukan section besar, lebih seperti "showcase strip".

**Konten:**
Menampilkan satu gambar jaringan distribusi air EPANET — node, pipa, dan reservoir — dalam estetika yang sesuai design system (monokromatik, bersih). Ini adalah **gambar statis**, bukan interaktif.

**Komposisi visual:**
- Gambar jaringan berada di tengah atau sedikit ke kanan
- Di sisi kiri (atau di atas gambar pada mobile), ada teks pendek:
  - Label kecil: `"Contoh jaringan"`
  - Kalimat singkat: *"Upload file .inp Anda — topologi jaringan langsung terbaca oleh sistem."*

**Tujuan section ini:** Membangun kepercayaan visual bahwa tools ini benar-benar mengerti konteks teknis EPANET. Mahasiswa yang sudah familiar dengan tampilan EPANET akan langsung merasa *"ini tools yang tepat"* saat melihat visualisasi ini.

**Mobile:** Gambar di atas, teks di bawah, keduanya full-width dan stacked.

---

## 5. How It Works

**Posisi:** Setelah Network Preview Strip.

**Layout:** Tiga kolom horizontal di desktop, masing-masing berisi satu langkah. Di mobile, ketiganya stacked vertikal.

**Header section:**
- Label kecil di atas: `"Cara Kerja"`
- Headline section: *"Tiga langkah. Satu klik analisis."*

**Tiga langkah (masing-masing satu kolom/card):**

| Langkah | Ikon/Visual | Judul | Deskripsi Singkat |
|---|---|---|---|
| 01 | Ikon upload / file | Upload File `.inp` | File dari EPANET desktop langsung diterima. Tidak perlu konversi format. |
| 02 | Ikon proses / gear | Analisis Otomatis | Sistem mengevaluasi tekanan, kecepatan, dan headloss. Iterasi diameter berjalan otomatis. |
| 03 | Ikon download | Download Hasil | Dua file siap unduh: jaringan yang sudah dioptimasi dan laporan lengkap Before vs After. |

**Koneksi antar langkah:** Garis tipis atau panah kecil menghubungkan card satu ke berikutnya (hanya di desktop). Di mobile, tidak perlu konektor.

**Di bawah tiga kolom:**
Teks kecil + link: *"Ingin tahu lebih dalam cara kerja solver? → Baca dokumentasi teknis"* (link ke halaman docs).

---

## 6. Technical Credibility

**Posisi:** Setelah How It Works.

**Layout:** Tiga card berjajar horizontal (atau 2+1 jika dirasa lebih baik secara visual). Di mobile, stacked.

**Header section:**
- Label kecil: `"Di Balik Sistem"`
- Headline section: *"Apa yang sebenarnya terjadi saat analisis berjalan."*
- Sub-headline: Satu kalimat bahwa hasil selalu akurat dan menggunakan standar resmi Indonesia.

**Tiga card informasi:**

**Card 1 — Standar Acuan**
- Judul: `Kriteria Teknis Permen PU`
- Isi: Menjelaskan bahwa evaluasi menggunakan batas resmi Permen PU No. 18/PRT/M/2007: tekanan 10–80 m, kecepatan 0.3–2.5 m/s, headloss ≤ 10 m/km.

**Card 2 — Cara Optimizer Bekerja**
- Judul: `Optimasi Diameter Otomatis`
- Isi: Sistem mengiterasi diameter dari daftar ukuran standar pipa (40–315 mm), menjalankan ulang simulasi tiap iterasi hingga semua kriteria terpenuhi atau konvergen.

**Card 3 — Keterbatasan yang Jujur**
- Judul: `Snapshot Steady-State`
- Isi: Analisis dilakukan pada kondisi awal (t=0), bukan Extended Period Simulation. Cocok untuk desain steady-state. Untuk EPS penuh, gunakan EPANET desktop.

**Catatan desain:** Card ketiga sengaja transparan soal keterbatasan — ini justru membangun kepercayaan, bukan menurunkannya. Mahasiswa teknik akan lebih percaya pada tools yang jujur tentang batasannya.

**Di bawah tiga card:**
Link kecil: *"Baca dokumentasi lengkap →"*

---

## 7. Video Tutorial

**Posisi:** Setelah Technical Credibility.

**Layout:** **Split dua kolom** — ini satu-satunya section yang menggunakan layout horizontal berat. Kiri dan kanan berisi konten yang saling melengkapi.

**Kolom kiri — Preview Jaringan Interaktif (atau static screenshot app):**
- Menampilkan screenshot atau mockup tampilan antarmuka web app (bukan gambar EPANET, tapi UI dari EPANET Solver itu sendiri)
- Memperlihatkan contoh hasil analisis: tabel status node, ringkasan iterasi, tombol download
- Ini memberikan "preview" ke dalam app sebelum user login
- Container dengan sudut rounded, whisper shadow, sedikit elevated

**Kolom kanan — Video Tutorial:**
- Label kecil di atas: `"Tutorial"`
- Headline: *"Dari AutoCAD ke hasil analisis dalam 10 menit."*
- Sub-teks singkat: Dua poin yang dicakup video: (1) cara konversi gambar AutoCAD ke file `.inp` menggunakan ePACad, (2) cara menggunakan iterasi di EPANET Solver.
- Container video: **Placeholder "Coming Soon"** — bukan kosong, tapi ada visual placeholder yang terlihat intentional (misalnya thumbnail gelap dengan teks "Video Tutorial — Coming Soon" dan ikon play)
- Di bawah placeholder: teks kecil *"Notifikasi saat video tersedia? Masukkan email →"* dengan input email kecil + tombol. (Opsional — bisa diskip jika terlalu kompleks untuk v1)

**Proporsi kolom:** Kiri dan kanan kurang lebih 50:50, atau kiri sedikit lebih lebar (55:45) karena konten visual lebih berat.

**Mobile:** Stacked vertikal — screenshot app di atas, video di bawah.

---

## 8. Pricing

**Posisi:** Setelah Video Tutorial. Ini adalah section terpenting kedua setelah Hero.

**Layout:** Satu kolom terpusat untuk header, lalu empat card horizontal untuk paket.

**Header section:**
- Label kecil: `"Harga"`
- Headline: *"Bayar sesuai kebutuhan. Token tidak expired."*
- Satu baris teks informasi di bawah headline:
  `"1x Analisis = 5 token  ·  Fix Pressure = 3 token  ·  Token tidak pernah kedaluwarsa"`

**Empat card paket (kiri ke kanan):**

| Card | Nama | Token | Harga | Visual Treatment |
|---|---|---|---|---|
| 1 | Mau Coba | 6 token | Rp 8.900 | Standard, tidak ada badge |
| 2 | Ups Kurang Dikit | 13 token | Rp 16.900 | Standard, tidak ada badge |
| 3 | Best Value | 18 token | Rp 19.900 | **Highlighted** — border lebih tebal / warna berbeda, ada badge "PALING WORTH IT", ukuran card sedikit lebih tinggi (elevated) |
| 4 | Tenang Sampai Selesai | 28 token | Rp 27.900 | Ada badge kecil "UNTUK SKRIPSI" |

**Elemen wajib di setiap card (dari atas ke bawah):**
1. Badge (jika ada)
2. Nama paket
3. Jumlah token — angka besar, prominent
4. Harga — besar
5. Harga per token — kecil, warna soft: `"Rp X / token"`
6. Deskripsi kombinasi penggunaan: `"Untuk X analisis + Y fix pressure"`
7. Baris penghematan: `"Hemat Rp X dibanding beli paket kecil terus"` (kosong untuk Card 1)
8. Tombol CTA: **"Beli Sekarang"** — full-width di dalam card

**Di bawah empat card:**
Satu baris teks kecil, center-aligned:
*"Semua analisis akurat 100% — token digunakan untuk akses ke output, bukan untuk akurasi."*

**Catatan desain card:** Card 3 (Best Value) harus secara visual "keluar" dari deretan — bisa dicapai dengan border yang sedikit lebih tebal, sedikit lebih tinggi dari card lain (seperti terangkat), atau background yang sedikit berbeda. Tujuannya adalah mata user langsung tertarik ke sana tanpa perlu membaca semua card terlebih dahulu.

**Mobile:** Card stacked vertikal. Urutan tetap sama: 1 → 2 → 3 → 4.

---

## 9. FAQ

**Posisi:** Setelah Pricing. Berfungsi sebagai "safety net" — menangkap semua keraguan yang muncul setelah user melihat harga tapi belum klik beli.

**Layout:** Satu kolom, lebar sedang (lebih sempit dari section lain — sekitar 60–70% lebar container). Center-aligned.

**Header section:**
- Headline: *"Pertanyaan yang sering muncul."*

**Daftar pertanyaan dan jawaban:**
Menggunakan accordion (click to expand) atau ditampilkan semua sekaligus jika jumlahnya sedikit. Untuk 5 pertanyaan, bisa langsung ditampilkan semua.

| # | Pertanyaan | Ringkasan Jawaban |
|---|---|---|
| 1 | Apakah hasilnya sama persis dengan EPANET desktop? | Solver yang digunakan kompatibel dengan EPANET. Ada perbedaan minor karena analisis adalah snapshot steady-state, bukan EPS. Untuk kebutuhan akademik standar, hasilnya equivalent. |
| 2 | Kalau token habis di tengah proses, apakah dipotong? | Tidak. Token hanya dipotong setelah analisis **berhasil selesai**. Jika terjadi error, token dikembalikan otomatis. |
| 3 | Apakah file `.inp` saya disimpan di server? | Tidak. File hanya ada di server selama proses analisis berjalan, dan otomatis terhapus setelah selesai. |
| 4 | Format `.inp` versi EPANET berapa yang didukung? | File `.inp` dari EPANET 2.x (termasuk 2.2) didukung. Mayoritas file yang dihasilkan EPANET desktop kompatibel. |
| 5 | Apakah ada free trial? | Ya. Setiap akun baru mendapat **5 token gratis** saat pertama kali login — cukup untuk 1x analisis penuh. |

---

## 10. Footer

**Posisi:** Paling bawah halaman.

**Layout:** Dua atau tiga kolom horizontal, dengan baris copyright di paling bawah.

**Kolom kiri:**
- Nama produk: **EPANET Solver**
- Deskripsi satu kalimat: *"Tools analisis jaringan distribusi air untuk mahasiswa teknik."*

**Kolom tengah (jika 3 kolom):**
- Heading: `"Tautan"`
- Link: Dokumentasi, Cara Kerja, Pricing

**Kolom kanan:**
- Heading: `"Bantuan"`
- Link: **Kirim Feedback / Saran** (menuju halaman feedback terpisah)
- Link: Kontak (email atau form kontak)

**Baris paling bawah:**
- Teks copyright: `© 2026 EPANET Solver`
- Teks kecil: *"Dibuat untuk mahasiswa teknik sipil dan lingkungan Indonesia."*

---

## 11. Urutan Section & Scroll Flow

Berikut urutan lengkap dari atas ke bawah saat user men-scroll halaman:

```
┌─────────────────────────────────────────┐
│  NAVBAR (fixed)                         │
├─────────────────────────────────────────┤
│  1. HERO                                │
│     Headline · Sub · CTA · Badge        │
├─────────────────────────────────────────┤
│  2. NETWORK PREVIEW STRIP               │
│     Gambar jaringan EPANET + teks       │
├─────────────────────────────────────────┤
│  3. HOW IT WORKS                        │
│     3 langkah horizontal                │
├─────────────────────────────────────────┤
│  4. TECHNICAL CREDIBILITY               │
│     3 card: standar · optimizer · limit │
├─────────────────────────────────────────┤
│  5. VIDEO TUTORIAL                      │
│     [Screenshot App] | [Video Placeholder] │
├─────────────────────────────────────────┤
│  6. PRICING                             │
│     4 paket token · card horizontal     │
├─────────────────────────────────────────┤
│  7. FAQ                                 │
│     5 pertanyaan accordion              │
├─────────────────────────────────────────┤
│  8. FOOTER                              │
│     Link · Feedback · Copyright         │
└─────────────────────────────────────────┘
```

**Logika urutan ini:**

Alur psikologis dari atas ke bawah dirancang mengikuti journey pengambilan keputusan user:

1. **Hero** — tangkap perhatian, sampaikan value dalam 5 detik
2. **Network Preview** — bangun kepercayaan visual (ini tools yang tahu EPANET)
3. **How It Works** — hilangkan ketidakpastian tentang proses
4. **Technical Credibility** — jawab pertanyaan teknis sebelum sempat ditanyakan
5. **Video Tutorial** — tunjukkan bukti nyata (bahkan versi Coming Soon memvalidasi bahwa produk ini serius)
6. **Pricing** — user yang sudah sampai sini sudah cukup yakin, siap melihat harga
7. **FAQ** — tangkap keraguan terakhir sebelum user meninggalkan halaman
8. **Footer** — landing zone yang bersih, ada jalur ke feedback

---

*Dokumen ini adalah bagian dari rangkaian dokumentasi EPANET Solver*
*Baca bersama: `DESIGN.md`, `PRD_EPANET_Solver.md`, dan `EPANET_Solver_Pricing_Strategy.md`*
*Versi: 1.0 | April 2026*
