# PROJECT MAP — EPANET Solver

> Dokumen ini dihasilkan dari audit read-only terhadap seluruh file proyek.
> Ditulis dalam bahasa Indonesia untuk kemudahan pemahaman tim non-teknis.

---

## Section 1 — Gambaran Besar

EPANET Solver adalah aplikasi web berbayar yang membantu insinyur sipil dan mahasiswa menganalisis dan mengoptimalkan jaringan distribusi air bersih. Pengguna mengunggah file `.inp` (format standar EPANET), sistem menjalankan simulasi hidraulik menggunakan pustaka Python bernama WNTR, lalu secara otomatis memeriksa apakah jaringan memenuhi standar Indonesia Permen PU No. 18/2007 (tekanan, kecepatan aliran, dan headloss). Jika ada pelanggaran, sistem mengoptimalkan diameter pipa satu per satu sampai jaringan memenuhi standar atau batas iterasi tercapai. Jika tekanan masih terlalu tinggi setelah optimasi diameter, sistem juga dapat memasang katup PRV (Pressure Reducing Valve) secara otomatis.

Sistem terdiri dari tiga bagian besar yang saling terhubung: (1) **Engine Python** di folder `scripts/epanet/` yang berisi logika inti simulasi dan optimasi, (2) **Serverless handler** di `api/analyze_python.py` yang merupakan salinan engine tersebut dikemas untuk dijalankan di Vercel, dan (3) **Aplikasi web Next.js** di folder `src/` yang menyediakan antarmuka pengguna, autentikasi, sistem token berbayar, dan integrasi dengan engine Python melalui API. Pengguna harus membeli token untuk menjalankan analisis; token dipotong setiap kali analisis berhasil selesai. Admin (email `arenoe.studio@gmail.com`) mendapat akses tidak terbatas. Pembayaran didukung dua jalur: Midtrans Snap atau QRIS statis dengan konfirmasi manual oleh admin.

---

## Section 2 — Peta File (per folder)

### Folder: `scripts/epanet/` dan `api/epanet/` (isi identik, duplikat)

#### config.py
**Tugas:** Mendefinisikan semua konstanta teknis dan parameter optimasi sebagai sumber kebenaran tunggal.
**Fungsi utama:** (tidak ada fungsi, hanya konstanta) `PRESSURE_MIN`, `PRESSURE_MAX`, `VELOCITY_MIN`, `VELOCITY_MAX`, `HL_MAX`, `DIAMETER_SIZES_MM`, `MAX_ITERATIONS`, `HW_C_DEFAULT`, `PRV_PRESSURE_TARGET`
**Dipanggil oleh:** Hampir semua modul lain di folder `epanet/`
**Memanggil:** Tidak memanggil modul lain

---

#### network_io.py
**Tugas:** Memuat file `.inp` dari disk, memvalidasi formatnya, membersihkan data korup, dan mengekspornya kembali setelah dioptimalkan.
**Fungsi utama:** `validate_inp_file`, `sanitize_inp_vertices`, `load_network`, `find_inp_file`, `export_optimized_inp`
**Dipanggil oleh:** `api/analyze_python.py` (handler), `scripts/epanet_optimizer.py` (CLI)
**Memanggil:** `wntr.network.WaterNetworkModel`, `config.SEARCH_PATHS`

---

#### simulation.py
**Tugas:** Menjalankan simulasi hidraulik steady-state menggunakan WNTR/EPANET dan mengevaluasi hasilnya terhadap standar Permen PU.
**Fungsi utama:** `run_simulation`, `evaluate_network`, `severity_breakdown`, `severity_score`, `_pressure_from_head_m`, `_epanet_inp_units`
**Dipanggil oleh:** `optimizer.py`, `prv.py`, `api/analyze_python.py`
**Memanggil:** `wntr.sim.EpanetSimulator`, `wntr.sim.WNTRSimulator`, `config`

---

#### diameter.py
**Tugas:** Menghitung diameter pipa optimal menggunakan Metode Window Analitik berdasarkan debit aliran, headloss, dan kecepatan.
**Fungsi utama:** `next_diameter_up`, `next_diameter_down`, `ceil_standard_diameter`, `d_min_for_vmax`, `d_min_for_headloss`, `recommend_diameter`, `mm`, `status_symbol`
**Dipanggil oleh:** `optimizer.py`
**Memanggil:** `config.DIAMETER_SIZES_M`, `config.HL_MAX`, `config.HW_C_DEFAULT`, `config.VELOCITY_MAX`

---

#### optimizer.py
**Tugas:** Menjalankan loop iteratif untuk mengubah diameter pipa agar kecepatan dan headloss memenuhi standar, dengan prioritas pass HL-SMALL > HL-HIGH > V-HIGH > V-LOW.
**Fungsi utama:** `optimize_diameters`, `_apply_material_roughness`, `_pipe_working_pressure_m`
**Dipanggil oleh:** `api/analyze_python.py`
**Memanggil:** `simulation.run_simulation`, `simulation.evaluate_network`, `diameter.*`, `materials.recommend_material`, `config`

---

#### materials.py
**Tugas:** Merekomendasikan material pipa (PVC, HDPE, GIP/Baja) berdasarkan tekanan kerja dan diameter, lalu menetapkan nilai Hazen-Williams C yang sesuai.
**Fungsi utama:** `recommend_material`, `pipe_working_pressure_m`, `material_recommendations_for_network`
**Dipanggil oleh:** `optimizer.py`, `api/analyze_python.py`
**Memanggil:** Tidak ada dependensi internal

---

#### prv.py
**Tugas:** Menganalisis kebutuhan PRV (katup pengatur tekanan), memasangnya ke model jaringan, dan menyetel setting-nya agar tekanan semua node berada dalam rentang aman.
**Fungsi utama:** `analyze_prv_recommendations`, `apply_prvs`, `fine_tune_prvs`, `_directed_edges_from_flow`, `_bfs_reachable`, `_feasible_setting`, `_restrict_to_band`, `_discover_prv_zone_targets`
**Dipanggil oleh:** `api/analyze_python.py`
**Memanggil:** `simulation.run_simulation`, `simulation.evaluate_network`, `config.PRESSURE_MIN`, `config.PRESSURE_MAX`, `config.PRV_PRESSURE_TARGET`

---

#### reporter.py
**Tugas:** Menghasilkan laporan Markdown lengkap berisi tabel sebelum/sesudah untuk node, pipa, material, dan PRV.
**Fungsi utama:** `export_markdown_report`, `_violation_table`, `_node_before_after_table`, `_pipe_before_after_table`, `_material_table`, `_prv_recommendations`, `_reversed_flow_table`
**Dipanggil oleh:** `api/analyze_python.py`, `scripts/epanet_optimizer.py`
**Memanggil:** `diameter.status_symbol`, `simulation.severity_breakdown`, `simulation.severity_score`, `config`

---

#### `__init__.py` (keduanya)
**Tugas:** File kosong penanda paket Python.
**Fungsi utama:** (tidak ada)
**Dipanggil oleh:** Python saat mengimpor paket
**Memanggil:** Tidak ada

---

### Folder: `api/`

#### `api/analyze_python.py`
**Tugas:** Handler HTTP serverless Vercel yang menerima upload file `.inp`, menjalankan seluruh pipeline analisis (load → simulasi → evaluasi → optimasi diameter → material → PRV → laporan), dan mengembalikan hasilnya sebagai JSON dengan file-file ter-encode base64.
**Fungsi utama:** `handler.do_POST`, `_read_multipart_file`, `_b64_file`, `_build_prv_targets`, `_pressure_debug_snapshot`, `handler._respond`, `_env_int`, `_env_float`
**Dipanggil oleh:** Python API server (Vercel atau `scripts/dev_server.py`)
**Memanggil:** Semua modul di `api/epanet/`

---

### Folder: `src/app/api/` (Route API Next.js)

#### `src/app/api/analyze/route.ts`
**Tugas:** Endpoint POST untuk memulai analisis baru — memvalidasi file, memotong token (atau skip jika admin), membuat rekaman analisis di DB, lalu meneruskan file ke Python API dan mengembalikan `jobId`.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman Upload (`/upload`)
**Memanggil:** `auth-server`, `admin`, `analysis-snapshots`, `db`, `http`, `python-api`, `ratelimit`, `token-balance`, `token-constants`

---

#### `src/app/api/fix-pressure/route.ts`
**Tugas:** Endpoint POST untuk memulai Fix Pressure (memasang PRV) — mirip dengan `/analyze` tapi menggunakan `action=fix_pressure` dan menyimpan `parentAnalysisId`.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman Upload (setelah analisis awal selesai dan ada P-HIGH)
**Memanggil:** `auth-server`, `admin`, `analysis-snapshots`, `db`, `http`, `python-api`, `ratelimit`, `token-balance`, `token-constants`

---

#### `src/app/api/simulations/[jobId]/route.ts`
**Tugas:** Endpoint GET untuk polling status job di Python backend — meneruskan status job dari Python ke client.
**Fungsi utama:** `GET`
**Dipanggil oleh:** Client (polling setiap beberapa detik)
**Memanggil:** `auth-server`, `db`, `http`, `python-api`

---

#### `src/app/api/simulations/[jobId]/result/route.ts`
**Tugas:** Endpoint GET yang mengambil hasil lengkap dari Python saat job selesai, memvalidasi schema-nya, memotong token dari saldo user, menyimpan snapshot ke DB, dan mengembalikan data terstruktur ke client.
**Fungsi utama:** `GET`
**Dipanggil oleh:** Client (setelah polling menunjukkan job selesai)
**Memanggil:** `auth-server`, `admin`, `analysis-snapshots`, `db`, `python-api`, `token-balance`, `token-constants`, `normalizeNode`, `normalizePipe`

---

#### `src/app/api/simulations/[jobId]/files/[name]/route.ts`
**Tugas:** Endpoint GET sebagai proxy untuk mengunduh file hasil (`.inp` atau `.md`) dari Python backend.
**Fungsi utama:** `GET`
**Dipanggil oleh:** Endpoint export, dan secara internal dari result route
**Memanggil:** `auth-server`, `python-api`

---

#### `src/app/api/analyses/route.ts`
**Tugas:** Endpoint GET untuk mendapatkan daftar riwayat analisis user (20 terakhir).
**Fungsi utama:** `GET`
**Dipanggil oleh:** Dashboard/halaman riwayat
**Memanggil:** `auth-server`, `db`

---

#### `src/app/api/analyses/recent/route.ts`
**Tugas:** Endpoint GET untuk mendapatkan daftar analisis terbaru yang masih memiliki snapshot aktif (tidak expired), dikelompokkan per "root analisis" agar Fix Pressure dan Analisis Awal muncul sebagai satu entri.
**Fungsi utama:** `GET`
**Dipanggil oleh:** Halaman Upload (panel riwayat analisis terbaru)
**Memanggil:** `auth-server`, `analysis-snapshots`, `db`

---

#### `src/app/api/analyses/[analysisId]/route.ts`
**Tugas:** Endpoint GET untuk mengambil payload snapshot lengkap dari satu analisis berdasarkan ID.
**Fungsi utama:** `GET`
**Dipanggil oleh:** Halaman Upload (saat user klik item riwayat untuk melihat ulang hasil)
**Memanggil:** `auth-server`, `analysis-snapshots`, `db`

---

#### `src/app/api/analyses/[analysisId]/export/route.ts`
**Tugas:** Endpoint POST untuk mengekspor hasil analisis dalam format PDF, INP, atau Excel (XLS) — memotong token sesuai format, lalu mengambil data dari snapshot atau Python backend.
**Fungsi utama:** `POST`, `buildPdfBytes`, `buildTablePdfPages`, `buildSummaryPdfPage`, `buildHtmlTable`, `refundTokens`
**Dipanggil oleh:** Tombol download di halaman hasil analisis
**Memanggil:** `auth-server`, `admin`, `db`, `python-api`, `token-balance`, `token-constants`

---

#### `src/app/api/auth/[...nextauth]/route.ts`
**Tugas:** Handler NextAuth standar untuk semua request autentikasi (login, logout, session check).
**Fungsi utama:** `GET`, `POST`
**Dipanggil oleh:** NextAuth client-side
**Memanggil:** `auth` (lib/auth.ts)

---

#### `src/app/api/auth/register/route.ts`
**Tugas:** Endpoint POST untuk registrasi user baru — validasi input, hash password, buat user, buat saldo token awal, kirim email verifikasi.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman Register
**Memanggil:** `db`, `env`, `password`, `ratelimit`, `resend`, `request-ip`, `token-balance`, `verification-token`

---

#### `src/app/api/auth/verify-email/route.ts`
**Tugas:** Endpoint GET yang memproses klik link verifikasi email, mengkonsumsi token, dan menandai email sebagai terverifikasi.
**Fungsi utama:** `GET`
**Dipanggil oleh:** Link di email verifikasi
**Memanggil:** `db`, `env`, `ratelimit`, `request-ip`, `verification-token`

---

#### `src/app/api/auth/request-login-code/route.ts`
**Tugas:** Endpoint POST yang memeriksa kredensial (email + password) dan mengirim kode OTP login via email jika valid.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman Login (saat fitur OTP aktif)
**Memanggil:** `auth-otp`, `db`, `env`, `password`, `ratelimit`, `resend`, `request-ip`

---

#### `src/app/api/auth/check-credentials/route.ts`
**Tugas:** Endpoint POST untuk memverifikasi email + password tanpa membuat sesi (digunakan sebagai pre-check sebelum OTP).
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman Login
**Memanggil:** `db`, `password`, `ratelimit`

---

#### `src/app/api/auth/forgot-password/route.ts`
**Tugas:** Endpoint POST yang mengirim link reset password ke email user.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman Lupa Password
**Memanggil:** `db`, `env`, `ratelimit`, `resend`, `verification-token`

---

#### `src/app/api/auth/reset-password/route.ts`
**Tugas:** Endpoint POST yang memproses token reset password dan mengubah password user.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman Reset Password
**Memanggil:** `db`, `env`, `password`, `verification-token`

---

#### `src/app/api/auth/resend-verify-email/route.ts` dan `resend-verify-email-code/route.ts`
**Tugas:** Endpoint POST untuk mengirim ulang link/kode verifikasi email.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman verifikasi email
**Memanggil:** `db`, `resend`, `ratelimit`, `verification-token`

---

#### `src/app/api/token/balance/route.ts`
**Tugas:** Endpoint GET untuk mendapatkan saldo token user saat ini.
**Fungsi utama:** `GET`
**Dipanggil oleh:** Navbar, halaman Upload (real-time balance display)
**Memanggil:** `admin`, `auth`, `db`, `token-balance`

---

#### `src/app/api/token/create-transaction/route.ts`
**Tugas:** Endpoint POST untuk membuat transaksi pembelian token — jika Midtrans, membuat Snap token; jika QRIS statis, mengembalikan kode unik untuk total bayar.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Modal beli token
**Memanggil:** `auth-server`, `db`, `midtrans`, `payment`, `ratelimit`, `token-packages`

---

#### `src/app/api/token/confirm-qris/route.ts`
**Tugas:** Endpoint POST untuk mencatat transaksi QRIS statis setelah user mengklaim sudah transfer, dan mengirim notifikasi ke admin.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Modal beli token (flow QRIS statis)
**Memanggil:** `auth-server`, `db`, `payment`, `ratelimit`, `resend`, `token-packages`

---

#### `src/app/api/token/webhook/route.ts`
**Tugas:** Endpoint POST untuk menerima notifikasi webhook dari Midtrans saat pembayaran berhasil, memverifikasi tanda tangan, dan menambah saldo token user.
**Fungsi utama:** `POST`, `verifySignature`
**Dipanggil oleh:** Midtrans server (otomatis setelah pembayaran)
**Memanggil:** `db`, `payment`, `resend`

---

#### `src/app/api/transactions/route.ts`
**Tugas:** Endpoint GET untuk mendapatkan riwayat transaksi pembelian token user (20 terakhir).
**Fungsi utama:** `GET`
**Dipanggil oleh:** Halaman transaksi/profil
**Memanggil:** `auth-server`, `db`

---

#### `src/app/api/contact/route.ts`
**Tugas:** Endpoint POST untuk menyimpan pesan kontak dari user ke DB dan mengirim email notifikasi ke admin.
**Fungsi utama:** `POST`
**Dipanggil oleh:** Halaman Kontak
**Memanggil:** `auth-server`, `db`, `resend`

---

#### `src/app/api/debug/token/route.ts`
**Tugas:** Endpoint debug (hanya untuk admin) yang menampilkan info token user saat ini.
**Fungsi utama:** `GET`
**Dipanggil oleh:** Tools debugging admin
**Memanggil:** `auth-server`, `admin`, `db`

---

### Folder: `src/lib/`

#### `src/lib/auth.ts`
**Tugas:** Mendefinisikan konfigurasi NextAuth lengkap — provider Credentials (email + password + OTP opsional), adapter Drizzle, callbacks JWT/session, dan pembuatan saldo token awal saat user OAuth dibuat.
**Fungsi utama:** `getAuthOptions`
**Dipanggil oleh:** `auth-server.ts`, `auth/[...nextauth]/route.ts`
**Memanggil:** `admin`, `auth-otp`, `env`, `db`, `password`, `token-balance`, `db/schema`

---

#### `src/lib/auth-server.ts`
**Tugas:** Wrapper tipis untuk `getServerSession` agar mudah dipanggil dari Server Components dan Route Handlers.
**Fungsi utama:** `auth`
**Dipanggil oleh:** Hampir semua route handler yang memerlukan autentikasi
**Memanggil:** `auth.ts` (`getAuthOptions`), `next-auth` (`getServerSession`)

---

#### `src/lib/auth-otp.ts`
**Tugas:** Logika penerbitan dan konsumsi kode OTP — menyimpan hash kode di DB dengan batas percobaan dan TTL.
**Fungsi utama:** `issueOtpCode`, `consumeOtpCode`
**Dipanggil oleh:** `auth.ts`, `auth/request-login-code/route.ts`
**Memanggil:** `db`, `otp`, `db/schema.authOtpCodes`

---

#### `src/lib/otp.ts`
**Tugas:** Utilitas kriptografi untuk OTP — menghasilkan kode 6 digit acak dan meng-hash-nya.
**Fungsi utama:** `generateOtpCode`, `hashOtpCode`
**Dipanggil oleh:** `auth-otp.ts`
**Memanggil:** Node.js `crypto`

---

#### `src/lib/password.ts`
**Tugas:** Hashing dan verifikasi password menggunakan scrypt dengan salt acak.
**Fungsi utama:** `hashPassword`, `verifyPassword`
**Dipanggil oleh:** `auth.ts`, `auth/register/route.ts`, `auth/request-login-code/route.ts`, `auth/reset-password/route.ts`
**Memanggil:** Node.js `crypto`

---

#### `src/lib/verification-token.ts`
**Tugas:** Penerbitan dan konsumsi token verifikasi satu-kali (untuk verifikasi email dan reset password) — disimpan sebagai HMAC-SHA256 di tabel `verificationToken`.
**Fungsi utama:** `issueVerificationToken`, `consumeVerificationToken`, `hasUnexpiredVerificationToken`
**Dipanggil oleh:** `auth/register/route.ts`, `auth/verify-email/route.ts`, `auth/forgot-password/route.ts`, `auth/reset-password/route.ts`
**Memanggil:** `db`, Node.js `crypto`

---

#### `src/lib/admin.ts`
**Tugas:** Menentukan apakah email termasuk admin, dan apakah token harus dilewati (bypass) untuk email tersebut.
**Fungsi utama:** `isAdminEmail`, `shouldBypassTokensForEmail`
**Dipanggil oleh:** `auth.ts`, `admin-server.ts`, banyak route handler
**Memanggil:** `env`

---

#### `src/lib/admin-server.ts`
**Tugas:** Guard untuk halaman admin — redirect ke login jika tidak login, `notFound()` jika bukan admin.
**Fungsi utama:** `requireAdmin`
**Dipanggil oleh:** `src/app/admin/layout.tsx`, halaman-halaman admin
**Memanggil:** `admin`, `auth-server`

---

#### `src/lib/admin-health.ts`
**Tugas:** Fungsi health check untuk komponen infrastruktur — database, Redis, Midtrans, QRIS, dan env vars.
**Fungsi utama:** `checkDatabase`, `checkUpstashRedis`, `checkConfigSanity`
**Dipanggil oleh:** Halaman `/admin/health`
**Memanggil:** `@upstash/redis`, `payment`

---

#### `src/lib/analysis-snapshots.ts`
**Tugas:** Menyimpan dan mengambil payload hasil analisis (besar) sebagai JSONB di DB dengan TTL 3 hari.
**Fungsi utama:** `upsertAnalysisSnapshot`, `cleanupExpiredAnalysisSnapshots`, `getAnalysisSnapshotExpiresAt`
**Dipanggil oleh:** `simulations/[jobId]/result/route.ts`, `analyses/[id]/route.ts`, `analyses/recent/route.ts`, `analyses/[id]/export/route.ts`
**Memanggil:** `db`, `db/schema.analysisSnapshots`

---

#### `src/lib/token-balance.ts`
**Tugas:** Memastikan baris saldo token user ada di DB, membuat dengan nilai awal (`INITIAL_FREE_TOKENS`) jika belum ada.
**Fungsi utama:** `ensureInitialTokenBalanceRow`
**Dipanggil oleh:** `auth.ts`, `auth/register/route.ts`, banyak route handler yang memeriksa saldo
**Memanggil:** `db`, `token-constants`

---

#### `src/lib/token-constants.ts`
**Tugas:** Mendefinisikan semua biaya token sebagai konstanta: analisis (5), fix pressure (3), download INP (2), download Excel (1), download PDF (gratis), token awal gratis (5).
**Fungsi utama:** (hanya konstanta ekspor)
**Dipanggil oleh:** Berbagai route handler dan komponen UI
**Memanggil:** Tidak ada

---

#### `src/lib/token-packages.ts`
**Tugas:** Mendefinisikan 4 paket token yang dijual (Mau Coba, Ups Kurang Dikit, Best Value, Tenang Sampai Selesai) beserta alias legacy untuk backward compatibility.
**Fungsi utama:** `resolveTokenPackageKey`, `getTokenPackage`
**Dipanggil oleh:** `token/create-transaction/route.ts`, `token/confirm-qris/route.ts`
**Memanggil:** Tidak ada

---

#### `src/lib/payment.ts`
**Tugas:** Abstraksi provider pembayaran — menentukan apakah menggunakan Midtrans atau QRIS statis berdasarkan env var.
**Fungsi utama:** `getPaymentProvider`, `getQrisStaticConfig`, `getPaymentAdminEmail`
**Dipanggil oleh:** `token/create-transaction/route.ts`, `token/webhook/route.ts`, `token/confirm-qris/route.ts`, `admin-health.ts`
**Memanggil:** `process.env`

---

#### `src/lib/midtrans.ts`
**Tugas:** Inisialisasi singleton klien Midtrans Snap menggunakan server key dari env var.
**Fungsi utama:** `getSnap`
**Dipanggil oleh:** `token/create-transaction/route.ts`
**Memanggil:** `midtrans-client`, `token-packages`

---

#### `src/lib/python-api.ts`
**Tugas:** Membangun URL dasar untuk Python API — menggunakan env var `PYTHON_API_URL` jika tersedia, atau origin dari request URL.
**Fungsi utama:** `getPythonApiBaseUrl`, `buildPythonApiUrl`
**Dipanggil oleh:** Hampir semua route yang berkomunikasi dengan Python backend
**Memanggil:** `process.env`

---

#### `src/lib/ratelimit.ts`
**Tugas:** Menyediakan 4 rate limiter berbasis Redis Upstash — untuk analisis, transaksi, autentikasi, dan pengiriman OTP; dengan fallback "selalu OK" jika Redis tidak dikonfigurasi.
**Fungsi utama:** `rateLimitAnalyze`, `rateLimitCreateTransaction`, `rateLimitAuth`, `rateLimitOtpSend`, `rateLimitBackoff`
**Dipanggil oleh:** Route handler yang memerlukan pembatasan laju
**Memanggil:** `@upstash/ratelimit`, `@upstash/redis`

---

#### `src/lib/resend.ts`
**Tugas:** Klien email Resend dengan fungsi-fungsi spesifik untuk mengirim berbagai jenis email — konfirmasi pembayaran, kode OTP, verifikasi email, reset password, notifikasi admin.
**Fungsi utama:** `getResendClient`, `sendPaymentConfirmationEmail`, `sendAdminPendingPaymentEmail`, `sendAuthCodeEmail`, `sendVerifyEmailLinkEmail`, `sendResetPasswordLinkEmail`
**Dipanggil oleh:** Route handler yang perlu mengirim email
**Memanggil:** `resend` (package npm)

---

#### `src/lib/env.ts`
**Tugas:** Memvalidasi dan mengekspos environment variable server dengan Zod schema — melempar error deskriptif jika ada yang kurang.
**Fungsi utama:** `getServerEnv`
**Dipanggil oleh:** `auth.ts`, `admin.ts`, `auth/register/route.ts`, dan lainnya
**Memanggil:** `zod`, `process.env`

---

#### `src/lib/http.ts`
**Tugas:** Helper untuk mem-parse response HTTP menjadi pasangan `{text, json}`.
**Fungsi utama:** `parseJsonResponse`
**Dipanggil oleh:** `analyze/route.ts`, `fix-pressure/route.ts`, `simulations/[jobId]/route.ts`
**Memanggil:** Tidak ada

---

#### `src/lib/utils.ts`
**Tugas:** Utilitas UI kecil — `cn` untuk menggabungkan class CSS, `formatIdr` untuk format Rupiah, dan `normalizeQrisQrImageUrl`.
**Fungsi utama:** `cn`, `formatIdr`, `normalizeQrisQrImageUrl`
**Dipanggil oleh:** Komponen UI
**Memanggil:** `clsx`

---

#### `src/lib/request-ip.ts`
**Tugas:** Mengekstrak IP klien dari header `x-forwarded-for` atau `x-real-ip`.
**Fungsi utama:** `getClientIp`
**Dipanggil oleh:** Route handler autentikasi (untuk rate limit per IP)
**Memanggil:** Tidak ada

---

#### `src/lib/request-origin.ts`
**Tugas:** Menentukan origin URL aplikasi untuk membuat link absolut (email verifikasi dll).
**Fungsi utama:** `getRequestOrigin`
**Dipanggil oleh:** `auth/register/route.ts`, `auth/forgot-password/route.ts`
**Memanggil:** `process.env`

---

#### `src/lib/invoice-pdf.ts`
**Tugas:** Menghasilkan file PDF bukti pembayaran secara client-side (tanpa dependensi library PDF eksternal) dan memicu download.
**Fungsi utama:** `downloadInvoicePdf`, `buildPdfLines`
**Dipanggil oleh:** Komponen modal checkout (client-side)
**Memanggil:** Browser `Blob`, `URL.createObjectURL`

---

#### `src/lib/business.ts`
**Tugas:** Mengekspos informasi bisnis (nama, email, telepon, alamat) dari env var sebagai objek terstruktur.
**Fungsi utama:** `getBusinessInfo`
**Dipanggil oleh:** Komponen footer, halaman kontak
**Memanggil:** `process.env`

---

#### `src/lib/ui-events.ts`
**Tugas:** Konstanta dan fungsi helper untuk event kustom UI — khususnya event membuka modal beli token.
**Fungsi utama:** `openBuyTokenModal`
**Dipanggil oleh:** Komponen UI (ketika token habis)
**Memanggil:** `window.dispatchEvent`

---

#### `src/lib/db/schema.drizzle.js`
**Tugas:** Mendefinisikan semua tabel database menggunakan Drizzle ORM — lihat Section 4 untuk detail per tabel.
**Fungsi utama:** (tidak ada fungsi, hanya definisi tabel)
**Dipanggil oleh:** Semua route handler yang mengakses DB, `drizzle.config.js`
**Memanggil:** `drizzle-orm/pg-core`

---

### Folder: `src/app/` (Halaman)

#### `src/app/layout.tsx`
**Tugas:** Root layout Next.js — membungkus semua halaman dengan Navbar, Footer, Session Provider, Toast Provider, dan menyisipkan script Midtrans Snap jika dikonfigurasi.
**Dipanggil oleh:** Next.js (otomatis)
**Memanggil:** `layout/Footer`, `layout/Navbar`, `providers/SessionProvider`, `providers/ToastProvider`, `lib/payment`

---

#### `src/app/page.tsx` (Landing Page)
**Tugas:** Halaman beranda publik — menampilkan HeroSection, NetworkPreviewStrip, TechnicalCredibility, VideoTutorial, PricingSection, FAQSection. Mengarahkan user login ke `/dashboard`.
**Dipanggil oleh:** Route `/`
**Memanggil:** Berbagai komponen Section, `next-auth/react`

---

#### `src/app/dashboard/page.tsx`
**Tugas:** Redirect otomatis — jika belum login, ke `/login`; jika sudah login, ke `/upload`.
**Dipanggil oleh:** Route `/dashboard`
**Memanggil:** `auth-server`

---

#### `src/app/upload/page.tsx` (Halaman Utama Aplikasi)
**Tugas:** Halaman utama kerja — upload file `.inp`, menampilkan progress analisis, menampilkan hasil, memungkinkan Fix Pressure, menampilkan riwayat analisis terbaru, dan tombol download.
**Dipanggil oleh:** Route `/upload`
**Memanggil:** Banyak komponen Section, `hooks/*`, `lib/token-constants`, `lib/ui-events`

---

#### `src/app/admin/layout.tsx`
**Tugas:** Layout untuk semua halaman admin — memanggil `requireAdmin()` untuk memastikan hanya admin yang bisa akses, lalu membungkus konten dalam `AdminShell`.
**Dipanggil oleh:** Semua route di bawah `/admin`
**Memanggil:** `admin-server`, `AdminShell`

---

#### `src/app/admin/page.tsx`
**Tugas:** Halaman overview admin — menampilkan metrik 24 jam terakhir (analisis, transaksi, pesan kontak, user baru) dan alert terkait anomali.
**Dipanggil oleh:** Route `/admin`
**Memanggil:** `admin-server`, `db`, `db/schema`

---

---

## Section 3 — Alur Data Utama

### Alur A — User upload file `.inp` dan mendapat hasil analisis

**Langkah 1 — User memilih file di browser**
- File `.inp` dipilih di komponen `UploadZone` (`src/app/upload/page.tsx`)
- Komponen `useFilePreview` melakukan preview ringan (jumlah node/pipa) secara lokal

**Langkah 2 — User klik tombol "Analisis"**
- `src/app/upload/page.tsx` mengirim `POST /api/analyze` dengan file sebagai `multipart/form-data`
- Di `src/app/api/analyze/route.ts`:
  - Sesi dicek via `src/lib/auth-server.ts`
  - Rate limit dicek via `src/lib/ratelimit.ts`
  - Saldo token dicek via `src/lib/token-balance.ts` (skip jika admin)
  - Rekaman analisis dibuat di tabel `analyses` (status: "processing")
  - File diteruskan ke Python API via `src/lib/python-api.ts` ke endpoint `/v1/simulations`
  - `jobId` dikembalikan ke client

**Langkah 3 — Python backend memproses file**
- Python API (Vercel serverless atau `scripts/dev_server.py`) menerima file
- `api/analyze_python.py`:
  - Memuat file: `api/epanet/network_io.py` → `load_network()`
  - Simulasi awal: `api/epanet/simulation.py` → `run_simulation()` + `evaluate_network()`
  - Optimasi diameter: `api/epanet/optimizer.py` → `optimize_diameters()` (maks 15 iterasi serverless)
  - Rekomendasi material: `api/epanet/materials.py` → `material_recommendations_for_network()`
  - Analisis PRV: `api/epanet/prv.py` → `analyze_prv_recommendations()`
  - Ekspor laporan: `api/epanet/reporter.py` → `export_markdown_report()`
  - Ekspor file `.inp`: `api/epanet/network_io.py` → `export_optimized_inp()`
  - File di-encode base64, dikembalikan sebagai JSON `{success, summary, files, nodes, pipes, materials, prv, ...}`

**Langkah 4 — Client polling status**
- `src/app/upload/page.tsx` polling `GET /api/simulations/{jobId}`
- `src/app/api/simulations/[jobId]/route.ts` meneruskan ke Python API → mengembalikan status `{status: "pending"|"done"|"failed"}`

**Langkah 5 — Job selesai, hasil diambil**
- Polling menemukan status selesai, client memanggil `GET /api/simulations/{jobId}/result?analysisId=...`
- `src/app/api/simulations/[jobId]/result/route.ts`:
  - Mengambil hasil lengkap dari Python API
  - Memvalidasi schema response dengan Zod
  - Memotong token dari saldo user (atomik, dengan guard saldo cukup) via tabel `tokenBalances`
  - Menyimpan payload ke tabel `analysisSnapshots` via `src/lib/analysis-snapshots.ts`
  - Memperbarui status analisis ke "success" di tabel `analyses`
  - Mengembalikan data node, pipa, material, PRV ke client

**Langkah 6 — Hasil ditampilkan**
- `src/app/upload/page.tsx` menerima data dan menampilkannya di `ResultsPanel`

---

### Alur B — User login (email + OTP)

**Langkah 1 — User masukkan email dan password**
- `src/app/login/page.tsx` atau `src/app/masuk/page.tsx` menampilkan form login
- Jika fitur OTP aktif (`AUTH_REQUIRE_LOGIN_OTP=true`): form mengirim `POST /api/auth/request-login-code`

**Langkah 2 — Validasi kredensial dan kirim OTP**
- `src/app/api/auth/request-login-code/route.ts`:
  - Rate limit IP dicek via `src/lib/ratelimit.ts`
  - Email dicari di tabel `users` di DB
  - Password diverifikasi via `src/lib/password.ts` (`verifyPassword` dengan scrypt)
  - Jika salah 5x → akun dikunci 15 menit (kolom `loginLockedUntil`)
  - OTP 6 digit dibuat via `src/lib/otp.ts` → di-hash dan disimpan di tabel `authOtpCodes` via `src/lib/auth-otp.ts`
  - OTP dikirim via email menggunakan `src/lib/resend.ts` → `sendAuthCodeEmail()`

**Langkah 3 — User masukkan kode OTP**
- Form login mengirim email + password + OTP ke NextAuth via `POST /api/auth/callback/credentials`
- `src/app/api/auth/[...nextauth]/route.ts` memproses dengan konfigurasi dari `src/lib/auth.ts`

**Langkah 4 — NextAuth memvalidasi dan membuat sesi**
- Di `src/lib/auth.ts` fungsi `authorize()`:
  - Password dicek ulang
  - Jika `mfaEnabled`: OTP dikonsumsi via `src/lib/auth-otp.ts` → `consumeOtpCode()` (memverifikasi hash, mengecek TTL dan batas percobaan)
  - Jika semua valid: mengembalikan objek user
  - NextAuth membuat JWT token dengan `id` dan `isAdmin` user

**Langkah 5 — User berhasil masuk**
- Browser menyimpan cookie sesi NextAuth
- User di-redirect ke `/dashboard` yang kemudian redirect ke `/upload`

---

### Alur C — User beli token

**Langkah 1 — User pilih paket token**
- Modal beli token dibuka (dipicu oleh `openBuyTokenModal()` dari `src/lib/ui-events.ts`)
- Daftar paket dari `src/lib/token-packages.ts` ditampilkan (4 paket: Mau Coba, Ups Kurang Dikit, Best Value, Tenang Sampai Selesai)

**Langkah 2a — Flow Midtrans (jika provider=midtrans)**
- `POST /api/token/create-transaction` di `src/app/api/token/create-transaction/route.ts`:
  - Membuat order ID unik (`EPANET-{userId8}-{timestamp}`)
  - Memanggil Midtrans Snap API via `src/lib/midtrans.ts` → `getSnap().createTransactionToken()`
  - Menyimpan transaksi ke tabel `transactions` (status: "pending") dengan `snapToken`
  - Mengembalikan `snapToken` ke client
- Client membuka popup Snap Midtrans dengan token tersebut
- Setelah pembayaran, Midtrans memanggil `POST /api/token/webhook` di `src/app/api/token/webhook/route.ts`:
  - Verifikasi tanda tangan SHA512 Midtrans
  - Update status transaksi ke "paid"
  - Tambah saldo via tabel `tokenBalances` (atomic SQL `coalesce + increment`)
  - Kirim email konfirmasi via `src/lib/resend.ts`

**Langkah 2b — Flow QRIS Statis (jika provider=qris_static)**
- `POST /api/token/create-transaction` mengembalikan kode unik (1-99) dan total bayar
- User scan QR, transfer jumlah persis (termasuk kode unik)
- User klik konfirmasi → `POST /api/token/confirm-qris` di `src/app/api/token/confirm-qris/route.ts`:
  - Menyimpan transaksi ke tabel `transactions` (status: "pending")
  - Mengirim email notifikasi ke admin (`PAYMENT_ADMIN_EMAIL`)
- Admin memverifikasi manual → mengkonfirmasi di panel `/admin/payments`
- Admin klik "Konfirmasi Bayar" → token ditambah ke saldo user

**Langkah 3 — Token bertambah di akun user**
- Saldo di tabel `tokenBalances` bertambah
- Endpoint `GET /api/token/balance` mengembalikan saldo terbaru
- UI Navbar dan halaman Upload menampilkan saldo yang diperbarui

---

## Section 4 — Database

### Tabel `users`
**Fungsi:** Menyimpan data akun pengguna aplikasi.
**Kolom penting:**
- `id` (text, PK) — UUID unik user
- `email` (text, unique) — email login
- `passwordHash` (text) — hash scrypt password
- `emailVerified` (timestamp) — null jika belum verifikasi email
- `loginLockedUntil` (timestamp) — waktu unlock akun setelah 5x gagal login
**Tabel terhubung:** `token_balances`, `analyses`, `transactions`, `contact_messages`, `admin_token_events`, `accounts`, `sessions`

---

### Tabel `token_balances`
**Fungsi:** Menyimpan saldo token setiap user — satu baris per user.
**Kolom penting:**
- `userId` (text, unique FK → users) — pemilik saldo
- `balance` (integer) — saldo token saat ini
- `totalBought` (integer) — total token pernah dibeli/diterima
- `totalUsed` (integer) — total token pernah dipakai
- `updatedAt` (timestamp) — waktu terakhir update
**Tabel terhubung:** `users`

---

### Tabel `analyses`
**Fungsi:** Mencatat setiap pekerjaan analisis yang dijalankan user.
**Kolom penting:**
- `userId` (text, FK → users) — siapa yang menjalankan
- `kind` (text) — "optimize" atau "fix_pressure"
- `parentAnalysisId` (integer) — untuk fix_pressure, menunjuk ke analisis awal
- `status` (text) — "processing" | "success" | "failed"
- `issuesFound`, `issuesFixed` (integer) — ringkasan hasil
**Tabel terhubung:** `users`, `analysis_snapshots`

---

### Tabel `analysis_snapshots`
**Fungsi:** Menyimpan payload hasil analisis yang besar sebagai JSONB dengan masa berlaku 3 hari.
**Kolom penting:**
- `analysisId` (integer, PK+FK → analyses) — satu snapshot per analisis
- `payload` (jsonb) — seluruh data hasil (nodes, pipes, materials, files URL, PRV, dll)
- `expiresAt` (timestamp, diindeks) — waktu kedaluwarsa snapshot
- `createdAt` (timestamp)
**Tabel terhubung:** `analyses`

---

### Tabel `transactions`
**Fungsi:** Mencatat setiap transaksi pembelian token.
**Kolom penting:**
- `userId` (text, FK → users) — pembeli
- `orderId` (text, unique) — ID order unik format `EPANET-{userId8}-{timestamp}`
- `package` (text) — kunci paket token
- `tokens` (integer) — jumlah token yang dibeli
- `amount` (integer) — total harga dalam Rupiah
- `status` (text) — "pending" | "paid" | "failed"
**Tabel terhubung:** `users`

---

### Tabel `contact_messages`
**Fungsi:** Menyimpan pesan kontak dari pengunjung/user.
**Kolom penting:**
- `userId` (text, nullable FK → users) — null jika pengirim tidak login
- `name`, `email`, `topic`, `message` (text) — isi pesan
- `status` (text) — "open" | (lainnya dikelola admin)
- `adminNotes` (text) — catatan internal admin
**Tabel terhubung:** `users`

---

### Tabel `admin_token_events`
**Fungsi:** Log audit untuk setiap perubahan token yang dilakukan admin secara manual.
**Kolom penting:**
- `userId` (text, FK → users) — user yang saldo-nya diubah
- `adminEmail` (text) — admin yang melakukan perubahan
- `delta` (integer) — selisih token (positif = tambah, negatif = kurang)
- `balanceBefore`, `balanceAfter` (integer) — saldo sebelum dan sesudah
- `note` (text) — alasan perubahan
**Tabel terhubung:** `users`

---

### Tabel `auth_otp_codes`
**Fungsi:** Menyimpan hash kode OTP yang dikirim via email, dengan tracking percobaan.
**Kolom penting:**
- `email`, `purpose` (text) — identifikasi kepemilikan OTP
- `codeHash` (text) — hash SHA-256 dengan pepper dari NEXTAUTH_SECRET
- `expiresAt` (timestamp) — batas waktu berlaku
- `consumedAt` (timestamp) — null jika belum digunakan
**Tabel terhubung:** (tidak ada FK eksplisit)

---

### Tabel `accounts` (NextAuth)
**Fungsi:** Menyimpan akun OAuth (Google dll) yang terhubung ke user.
**Kolom penting:** `userId`, `provider`, `providerAccountId`, token-token OAuth
**Tabel terhubung:** `users`

---

### Tabel `sessions` (NextAuth)
**Fungsi:** Menyimpan sesi aktif user (jika strategi database digunakan — saat ini JWT).
**Kolom penting:** `sessionToken`, `userId`, `expires`
**Tabel terhubung:** `users`

---

### Tabel `verificationToken` (NextAuth)
**Fungsi:** Menyimpan hash token verifikasi email dan reset password satu-kali.
**Kolom penting:** `identifier`, `token` (hash HMAC-SHA256), `expires`
**Tabel terhubung:** (tidak ada FK, diidentifikasi via identifier string)

---

## Section 5 — Duplikasi dan Risiko

### 1. Duplikasi Folder Engine Python

**Folder `scripts/epanet/` dan `api/epanet/` adalah salinan manual yang harus selalu disinkronkan.**

Kedua folder ini berisi file dengan nama identik:
- `config.py`
- `network_io.py`
- `simulation.py`
- `diameter.py`
- `optimizer.py`
- `materials.py`
- `prv.py`
- `reporter.py`
- `__init__.py`

**Risiko nyata:** Setiap kali ada perbaikan bug atau perubahan logika di `scripts/epanet/`, pengembang harus ingat untuk juga memperbarui `api/epanet/`. Jika lupa, versi CLI dan versi web akan menghasilkan hasil berbeda. Tidak ada mekanisme otomatis (tes, CI, atau symlink) yang memastikan keduanya sinkron.

---

### 2. Fungsi dengan Nama Mirip tapi File Berbeda

| Nama Fungsi | File 1 | File 2 | Perbedaan |
|---|---|---|---|
| `pipe_working_pressure_m` | `scripts/epanet/materials.py` | `scripts/epanet/optimizer.py` (`_pipe_working_pressure_m`) | Isi hampir sama, versi di optimizer adalah fungsi privat (`_`) dengan logika identik |
| `normalizeQrisQrImageUrl` | `src/lib/utils.ts` | `src/lib/payment.ts` | Isi identik persis — duplikasi kode |
| `buildPdfBytes` | `src/app/api/analyses/[analysisId]/export/route.ts` | `src/lib/invoice-pdf.ts` (`buildPdfLines`) | Sama-sama membangun PDF manual tanpa library, struktur berbeda |
| `fetchJson` | `src/app/api/simulations/[jobId]/result/route.ts` (lokal) | `src/lib/http.ts` (`parseJsonResponse`) | Fungsi `fetchJson` di result route tidak menggunakan `parseJsonResponse` dari lib/http |
| `toNumberOrNull` | `src/app/api/simulations/[jobId]/result/route.ts` | `src/app/api/analyses/[analysisId]/export/route.ts` (`toFiniteNumber`) | Logika identik, nama berbeda |
| `fxAscii` dan `fx` | `src/app/api/analyses/[analysisId]/export/route.ts` | Didefinisikan dua kali di file yang sama (`fx` dan `fxAscii`) | `fxAscii` adalah alias dari `fx` — duplikasi tidak perlu |

---

### 3. Hal Lain yang Berisiko Menyebabkan Bug

**a. Pemotongan Token Terjadi di Dua Tempat**
Di `src/app/api/analyze/route.ts` dilakukan pengecekan saldo awal (tapi token BELUM dipotong saat membuat job). Token baru benar-benar dipotong di `src/app/api/simulations/[jobId]/result/route.ts` saat job selesai. Jika user kehabisan token antara submit dan selesai, analisis tetap jalan tapi token tidak bisa dipotong → rekaman analisis ditandai "failed". Ini desain disengaja tapi rentan race condition jika user menjalankan banyak analisis bersamaan.

**b. Saldo Token Awal Diperiksa Dua Kali (tidak konsisten)**
`token-balance.ts` ada logika "jika balance=0 dan totalBought=0 dan totalUsed=0, reset ke INITIAL_FREE_TOKENS". Ini bisa menyebabkan masalah jika user legitimately habis token (balance=0, totalUsed>0) — logika ini tidak akan aktif, yang benar. Tapi logika ini sedikit rumit dan tidak mudah diaudit.

**c. `analyses.tokensUsed` Default = 6, Bukan 5**
Di `schema.drizzle.js`, kolom `tokensUsed` defaultnya adalah `6`, tapi `ANALYSIS_TOKEN_COST` di `token-constants.ts` adalah `5`. Nilai default ini bisa menyebabkan data tidak akurat jika insert dilakukan tanpa menyertakan nilai eksplisit.

**d. `prv.py` Mengimpor `build_pressure_followup` tapi Fungsi Tersebut Tidak Ada di File**
Di `api/analyze_python.py` baris 162 ada:
```
from epanet.prv import (analyze_prv_recommendations, apply_prvs, build_pressure_followup, fine_tune_prvs)
```
Tapi fungsi `build_pressure_followup` tidak ditemukan di `scripts/epanet/prv.py` atau `api/epanet/prv.py`. Ini kemungkinan akan menyebabkan `ImportError` saat handler dipanggil dengan action apapun. Ini adalah bug yang sangat kritis.

**e. Duplikasi Logika Normalisasi URL QRIS**
`normalizeQrisQrImageUrl` didefinisikan di `src/lib/utils.ts` dan `src/lib/payment.ts` dengan isi identik. Perubahan di satu tempat tidak otomatis tercermin di tempat lain.

**f. PDF Dibangun Tanpa Library (Raw PDF Bytes)**
Kode PDF di `export/route.ts` dan `invoice-pdf.ts` membangun file PDF mentah tanpa library. Ini rapuh terhadap karakter non-ASCII — fungsi `escapePdfText` mengganti karakter non-ASCII dengan `?`. Laporan yang mengandung nama node dengan karakter Indonesia (ä, â, dll) dari komentar EPANET bisa rusak.

**g. Batas Iterasi Default Berbeda antara CLI dan Serverless**
`scripts/epanet/config.py` mendefinisikan `MAX_ITERATIONS = 50`, sedangkan `api/analyze_python.py` menggunakan default `15` (bisa di-override via env var). Ini disengaja untuk batas waktu serverless, tapi bisa membingungkan jika hasil CLI dan web berbeda.

---

## Section 6 — Hal yang Belum Jelas

1. **`build_pressure_followup` tidak ada di `prv.py`** — Fungsi ini diimpor di `api/analyze_python.py` baris 162 tapi tidak ditemukan di file `prv.py` manapun. Ini sangat mengindikasikan kode tidak dapat berjalan. Apakah fungsi ini belum diimplementasikan? Apakah ada di versi berbeda? Perlu investigasi segera.

2. **`src/app/api/auth/check-credentials/route.ts`** — File ini disebutkan di daftar glob tapi tidak dibaca isinya secara mendalam. Fungsinya memeriksa kredensial tanpa membuat sesi, tapi tidak jelas apakah fitur ini aktif digunakan di flow login frontend.

3. **Tabel `analyses.kind` menggunakan nilai "optimize" di kode tapi CLAUDE.md menyebut "analyze"** — Di `analyze/route.ts` nilai yang di-insert adalah `kind: "optimize"`, bukan `"analyze"` seperti yang tertulis di dokumentasi CLAUDE.md. Perlu konfirmasi nilai mana yang benar.

4. **Status Simulasi Python** — Route `GET /api/simulations/[jobId]` meneruskan status dari Python backend, tapi tidak jelas bagaimana Python backend mengelola state job (apakah menggunakan antrian, database sementara, atau memory). Dokumentasi Python backend tidak ada dalam file yang diaudit.

5. **`src/app/api/debug/token/route.ts`** — Endpoint debug ini diproteksi oleh `ADMIN_EMAILS` tapi tidak jelas apakah ada pemeriksaan tambahan agar endpoint ini tidak bisa diakses di produksi oleh pihak yang tidak berhak.

6. **Halaman `/admin/users/[id]/page.tsx` dan `/admin/reports/[id]/page.tsx`** — Halaman-halaman detail admin ini tidak dibaca isinya secara mendalam. Tidak jelas level akses dan fitur apa yang tersedia di sana.

7. **`src/lib/admin-health.ts` mengimpor `"server-only"`** — File ini menggunakan directive `"server-only"` tapi fungsi-fungsinya seperti `checkDatabase` memerlukan fungsi `probe` dikirim dari luar. Tidak jelas siapa yang memanggil ini dan bagaimana `probe` didefinisikan di halaman health check.

8. **Masa berlaku snapshot 3 hari (`ANALYSIS_SNAPSHOT_TTL_DAYS = 3`)** — Setelah 3 hari, hasil analisis akan terhapus. Tidak ada mekanisme untuk memperpanjang atau mengarsip. User yang kembali setelah 3 hari tidak bisa melihat hasilnya lagi (tombol download tidak akan berfungsi). Ini mungkin disengaja tapi tidak didokumentasikan untuk user.

9. **`analyses.tokensUsed` default `6` di schema vs `ANALYSIS_TOKEN_COST = 5` di kode** — Ketidakkonsistenan ini ada di `schema.drizzle.js` baris 122. Perlu verifikasi apakah ini typo atau disengaja.

10. **Hook `useFilePreview`** — Disebutkan digunakan di halaman Upload untuk preview file `.inp` tanpa upload ke server. Tidak diaudit implementasinya — tidak jelas apakah parser ini cukup robust untuk file `.inp` yang besar atau malformed.

---

*Dokumen ini mencerminkan kondisi kode per audit pada 2026-05-02. Perubahan kode setelah tanggal ini tidak tercermin di sini.*
