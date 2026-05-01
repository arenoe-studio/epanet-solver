# User Workflow Mapping (Auth)

Dokumen ini memetakan alur autentikasi berdasarkan kode yang ada (read-only mapping).

## Komponen & Tabel yang Terlibat

**Library / helper**
- `src/lib/auth.ts` — konfigurasi NextAuth (Credentials Provider) + callback JWT/session + event `createUser`.
- `src/lib/auth-server.ts` — helper `getServerSession(getAuthOptions())`.
- `src/lib/auth-otp.ts` — issue/consume OTP berbasis tabel `auth_otp_codes`.
- `src/lib/verification-token.ts` — issue/consume token verifikasi berbasis tabel `verificationToken` (hash HMAC).
- `src/lib/resend.ts` — pengiriman email via Resend (kode OTP & link verifikasi/reset).
- `src/lib/token-balance.ts`, `src/lib/token-constants.ts` — pemberian token gratis awal.
- `src/lib/ratelimit.ts` — rate limit (Upstash Redis; fallback “ok” bila env Redis tidak ada).

**API routes**
- `src/app/api/auth/[...nextauth]/route.ts` — endpoint NextAuth (login via `signIn("credentials")`).
- `src/app/api/auth/check-credentials/route.ts` — precheck kredensial untuk UX (mfa required / not verified / not registered / locked).
- `src/app/api/auth/request-login-code/route.ts` — kirim OTP login ke email.
- `src/app/api/auth/register/route.ts` — registrasi user + kirim link verifikasi email.
- `src/app/api/auth/verify-email/route.ts` — verifikasi email via link (GET `email` + `token`).
- `src/app/api/auth/resend-verify-email/route.ts` — kirim ulang link verifikasi (dengan anti-enumeration + backoff).
- `src/app/api/auth/resend-verify-email-code/route.ts` — kirim ulang link verifikasi (nama route “code”, tetapi isi mengirim link).
- `src/app/api/auth/forgot-password/route.ts` — kirim link reset password (anti-enumeration).
- `src/app/api/auth/reset-password/route.ts` — set password baru via token reset.

**UI pages/components**
- `src/app/login/page.tsx`, `src/app/login/LoginClient.tsx` — form login, request OTP login, `signIn("credentials")`.
- `src/app/register/page.tsx`, `src/app/register/RegisterClient.tsx` — form daftar, call `/api/auth/register`.
- `src/app/verify-email-notice/page.tsx`, `src/app/verify-email-notice/verify-email-notice-client.tsx` — halaman “cek email” + resend.
- `src/app/forgot-password/page.tsx`, `src/app/forgot-password/forgot-password-client.tsx` — request link reset.
- `src/app/reset-password/page.tsx`, `src/app/reset-password/reset-password-client.tsx` — set password baru.
- `src/app/masuk/page.tsx`, `src/app/daftar/page.tsx` — redirect ke `/login` dan `/register`.

**Skema DB (Drizzle)**
- `src/lib/db/schema.drizzle.js` (dan sumber TS-nya `src/lib/db/schema.ts`)
  - `users` — user, termasuk `password_hash`, `emailVerified`, `mfa_enabled`, `login_failed_count`, `login_locked_until`.
  - `auth_otp_codes` — OTP (hash), expiry, attempts, consumedAt.
  - `verificationToken` — token verifikasi (hashed), expiry.
  - `token_balances` — saldo token awal.

---

## Section 1 — Alur Login Normal (User Lama, Email Sudah Terdaftar)

Di sistem ini, login “normal” tetap melalui NextAuth Credentials (`signIn("credentials")`). OTP hanya dipakai jika `users.mfaEnabled = true`.

### 1A) Login tanpa MFA (mfaEnabled = false)

1. User buka halaman login.
   - UI: `src/app/login/page.tsx` → render `src/app/login/LoginClient.tsx`.

2. User isi email + password lalu klik “Masuk”.
   - UI: `src/app/login/LoginClient.tsx` memanggil `signIn("credentials")` (NextAuth).
   - Endpoint: `src/app/api/auth/[...nextauth]/route.ts` → NextAuth handler.

3. Server memverifikasi kredensial.
   - NextAuth config: `src/lib/auth.ts` (`CredentialsProvider.authorize`).
   - Query DB: SELECT dari tabel `users` berdasarkan `lower(email)`.
   - Validasi:
     - Jika `loginLockedUntil > now` → gagal (return `null`).
     - Verifikasi password: `src/lib/password.ts` (`verifyPassword`).
     - Jika password salah → update `users.loginFailedCount` (+1) dan bila >=5 set `users.loginLockedUntil = now + 15 menit`, lalu gagal.
     - Jika password benar → reset `loginFailedCount` ke 0 dan `loginLockedUntil` ke `null` (jika sebelumnya ada).
     - Jika `emailVerified` belum terisi → gagal (return `null`).
     - Jika `mfaEnabled` false → lanjut.

4. Jika sukses, NextAuth membuat sesi JWT.
   - `src/lib/auth.ts`:
     - callback `jwt`: set `token.id`, `token.isAdmin`.
     - callback `session`: expose `session.user.id` dan `session.user.isAdmin`.
   - Tidak ada penulisan DB sesi karena `session.strategy = "jwt"`.

5. Browser diarahkan ke dashboard.
   - UI: `src/app/login/LoginClient.tsx` memakai `router.push(res.url ?? callbackUrl)`.

**Yang dikirim ke DB**
- Read: `users` (SELECT).
- Write (kondisional):
  - Jika password salah: UPDATE `users.login_failed_count`, `users.login_locked_until`.
  - Jika password benar dan sebelumnya ada failure/lock: UPDATE reset ke 0/null.

**Yang dikirim ke email**
- Tidak ada email untuk login tanpa MFA.

### 1B) Login dengan MFA OTP (mfaEnabled = true)

1. User isi email + password dan klik “Masuk”.
   - UI tetap memanggil `signIn("credentials")` dulu (`src/app/login/LoginClient.tsx`).

2. Karena OTP belum diisi, `authorize` akan menolak login.
   - `src/lib/auth.ts`: jika `user.mfaEnabled` dan `otp` tidak ada → return `null`.
   - Akibatnya `signIn` tidak `ok`.

3. UI melakukan precheck untuk menentukan sebab kegagalan.
   - UI: `src/app/login/LoginClient.tsx` memanggil `POST /api/auth/check-credentials`.
   - API: `src/app/api/auth/check-credentials/route.ts`.
   - Query DB: SELECT dari `users` by email.
   - Bila `mfaEnabled = true` dan password valid serta email verified → response `428 { mfaRequired: true }`.

4. User klik “Kirim OTP”.
   - UI: `src/app/login/LoginClient.tsx` memanggil `POST /api/auth/request-login-code`.
   - API: `src/app/api/auth/request-login-code/route.ts`.
   - Rate limit:
     - `rateLimitAuth("request_login_code:ip:email")`
     - `rateLimitOtpSend("login:email:ip")`
     - Catatan: jika env Upstash Redis tidak ada, limiter fallback mengizinkan request (`src/lib/ratelimit.ts`).
   - Query DB: SELECT user & verifikasi password.
   - Jika password salah: UPDATE `users.loginFailedCount` dan lock rule sama (>=5 → 15 menit).
   - Issue OTP:
     - `src/lib/auth-otp.ts` → `issueOtpCode(...)` dengan `purpose: "login"` dan `ttlMinutes = env.AUTH_OTP_TTL_MINUTES ?? 10`.
     - DB write:
       - DELETE semua row `auth_otp_codes` untuk `email+purpose` yang `consumedAt IS NULL` (membersihkan kode sebelumnya).
       - INSERT row baru `auth_otp_codes` berisi `email`, `purpose`, `codeHash`, `expiresAt`.
   - Kirim email OTP:
     - `src/lib/resend.ts` → `sendAuthCodeEmail({ purpose: "login" })`.

5. User masukkan OTP lalu klik “Masuk” lagi.
   - UI: `signIn("credentials", { email, password, otp })`.
   - Server: `src/lib/auth.ts` memanggil `consumeOtpCode(...)`.
     - `src/lib/auth-otp.ts` → SELECT `auth_otp_codes` yang:
       - `email` cocok, `purpose` cocok,
       - `consumedAt IS NULL`,
       - `expiresAt > now`.
     - Jika attempts >= 5 → set `consumedAt = now`, gagal.
     - Jika hash OTP tidak cocok → increment `attempts` (dan jika mencapai 5 juga set `consumedAt`), gagal.
     - Jika cocok → set `consumedAt = now`, sukses.
   - Jika sukses → sesi JWT dibuat seperti 1A, lalu redirect.

**Yang dikirim ke DB**
- Read: `users` (SELECT), `auth_otp_codes` (SELECT saat consume).
- Write:
  - `users`: update failed count/lock saat password salah; reset saat password benar (di authorize).
  - `auth_otp_codes`: delete unconsumed sebelumnya, insert kode baru; update attempts/consumedAt saat verifikasi.

**Yang dikirim ke email**
- Email OTP login: `sendAuthCodeEmail(... purpose: "login")` (`src/lib/resend.ts`).

---

## Section 2 — Alur Registrasi (User Baru)

Alur registrasi saat ini menggunakan email+password, lalu aktivasi akun lewat **link verifikasi** (bukan OTP 6-digit).

1. User buka halaman signup.
   - UI: `/register` (`src/app/register/page.tsx` → `src/app/register/RegisterClient.tsx`).

2. User isi (opsional) nama, email, password, konfirmasi password → klik “Daftar Sekarang”.
   - UI memanggil `POST /api/auth/register`.
   - API: `src/app/api/auth/register/route.ts`.
   - Validasi input: Zod di backend (password minimal 8 + upper/lower/digit/symbol + confirm match).
   - Rate limit: `rateLimitAuth("register:ip")` + `rateLimitOtpSend("verify_email:email:ip")`.

3. Backend cek apakah email sudah ada.
   - DB: SELECT `users` by email.
   - Jika sudah ada → response `409 "Email sudah terdaftar. Silakan masuk."`.

4. Backend membuat user baru (status email belum verified).
   - Generate `userId = randomUUID()`.
   - DB INSERT ke `users`:
     - `id`, `email`, `name`, `passwordHash`.
     - `emailVerified` tidak diisi (jadi user belum bisa login sampai diverifikasi).

5. Token gratis awal diberikan.
   - `src/app/api/auth/register/route.ts` memanggil `ensureInitialTokenBalanceRow(db, userId)`.
   - Nilai token awal: `INITIAL_FREE_TOKENS = 5` (`src/lib/token-constants.ts`).
   - DB INSERT ke `token_balances` untuk `userId` (balance=5, totalBought=5, totalUsed=0) bila row belum ada.
   - Catatan: secara desain ini terjadi **sebelum verifikasi email** (karena user sudah dibuat).

6. Backend membuat token verifikasi email (untuk link).
   - Identifier: `verify_email:${email}`.
   - `src/lib/verification-token.ts` → `issueVerificationToken(...)`:
     - DELETE token lama (berdasarkan `identifier`).
     - INSERT ke tabel `verificationToken`:
       - `identifier`,
       - `token` (hash HMAC-SHA256 dari token asli + `NEXTAUTH_SECRET`),
       - `expires` (24 jam).

7. Backend mengirim email verifikasi (berisi link).
   - Jika Resend client tersedia (`RESEND_API_KEY` ada): `sendVerifyEmailLinkEmail` (`src/lib/resend.ts`).
   - Link mengarah ke: `GET /api/auth/verify-email?email=...&token=...`.
   - Response API register mengembalikan `{ ok: true, emailSent }`.

8. User klik link verifikasi.
   - Endpoint: `src/app/api/auth/verify-email/route.ts` (GET).
   - Rate limit: `rateLimitAuth("verify_email_link:ip:email")`.
   - Consume token: `consumeVerificationToken(...)` (`src/lib/verification-token.ts`).
     - Jika token invalid → redirect ke `/verify-email-notice?reason=invalid`.
     - Jika token expired → redirect ke `/verify-email-notice?reason=expired`.
     - Jika ok → UPDATE `users.emailVerified = now`.
   - Akhirnya redirect ke `/login?verified=1&email=...`.

9. Setelah verified, user bisa login seperti Section 1.

**Email yang dikirim**
- Email verifikasi (link) via `sendVerifyEmailLinkEmail` (`src/lib/resend.ts`).

**Tabel yang diisi**
- `users` — INSERT user baru.
- `token_balances` — INSERT saldo token awal (5).
- `verificationToken` — INSERT token verifikasi (hashed) + expiry.

---

## Section 3 — Case-Case yang Harus Ditangani

Di bawah ini “apa yang SEKARANG terjadi” sesuai kode, dan apakah sudah ada penanganannya.

### 1) User salah password / OTP salah

**Password salah**
- Yang terjadi:
  - Saat `signIn("credentials")` → `src/lib/auth.ts`:
    - Verifikasi password gagal → `users.loginFailedCount` bertambah.
    - Jika gagal >= 5 kali → `users.loginLockedUntil` diset 15 menit.
    - Login gagal (return `null`).
  - UI kemudian memanggil `POST /api/auth/check-credentials` dan bila password salah, API membalas `401 { passwordWrong: true }` (tanpa menambah counter).
- Penanganan:
  - Ada: lock sementara setelah 5 kegagalan (15 menit).

**OTP salah (MFA login)**
- Yang terjadi:
  - OTP diverifikasi di `consumeOtpCode` (`src/lib/auth-otp.ts`).
  - Jika OTP salah:
    - `attempts` bertambah.
    - Jika attempts mencapai 5 → `consumedAt` diset (kode dianggap “habis”).
  - Dari sisi UI: `signIn` akan gagal, lalu UI melakukan `/api/auth/check-credentials` dan kemungkinan besar akan kembali menampilkan status “OTP diperlukan” (bukan pesan “OTP salah”), karena endpoint check-credentials hanya memeriksa bahwa MFA enabled.
- Penanganan:
  - Ada pembatasan attempts per kode (maks 5) di DB.
  - Belum ada pesan spesifik “OTP salah” yang jelas dari flow UI/Server (lebih ke UX gap).

### 2) OTP expired sebelum digunakan

- Yang terjadi:
  - `consumeOtpCode` hanya memilih row dengan `expiresAt > now`; OTP yang expired tidak akan ditemukan → fungsi mengembalikan `false`.
  - Row expired tidak otomatis dihapus (tidak ada cleanup), kecuali nanti ditimpa oleh `issueOtpCode` (DELETE unconsumed untuk email+purpose).
- Penanganan:
  - Ada (OTP tidak bisa dipakai jika expired).
  - Tidak ada cleanup eksplisit untuk row expired (hanya implisit saat issue ulang).

### 3) User request OTP berkali-kali (spam)

- Yang terjadi:
  - Endpoint OTP login: `src/app/api/auth/request-login-code/route.ts`.
  - Ada rate limit:
    - `rateLimitAuth("request_login_code:ip:email")` (limit 30/10 menit jika Redis ada).
    - `rateLimitOtpSend("login:email:ip")` (limit 5/15 menit jika Redis ada).
  - Di UI, ada cooldown berbasis `localStorage` untuk tombol “Kirim OTP” (bukan security, hanya UX).
  - Bila Upstash Redis env tidak terpasang, limiter fallback mengizinkan request (server-side) (`src/lib/ratelimit.ts`).
- Penanganan:
  - Ada rate limit (jika Redis tersedia).
  - Jika Redis tidak tersedia, proteksi spam server-side efektifnya tidak ada. (Dampak ditulis di Section 4.)

### 4) User lupa password — apakah ada flow reset password?

- Yang terjadi:
  - Ada.
  - UI: `src/app/forgot-password/*` → `POST /api/auth/forgot-password`.
  - API: `src/app/api/auth/forgot-password/route.ts`:
    - Anti-enumeration: selalu return `{ ok: true }` walau email tidak terdaftar.
    - Jika user ada, issue token reset (`identifier = reset_password:${email}`) TTL 1 jam via `verificationToken`.
    - Kirim email link reset: `sendResetPasswordLinkEmail` (`src/lib/resend.ts`) menuju `/reset-password?email=...&token=...`.
  - UI reset: `src/app/reset-password/*` → `POST /api/auth/reset-password`.
  - API reset: `src/app/api/auth/reset-password/route.ts`:
    - consume token reset (invalid/expired → 400).
    - UPDATE `users.passwordHash`, reset `loginFailedCount` dan `loginLockedUntil`.
- Penanganan:
  - Ada, dan menggunakan link token (bukan OTP 6-digit).

### 5) Email tidak terdaftar tapi user coba login

- Yang terjadi:
  - UI login setelah `signIn` gagal akan memanggil `POST /api/auth/check-credentials`.
  - API membalas `404 { notRegistered: true }` + pesan “Email belum terdaftar. Silakan daftar dulu.”
  - UI mengarahkan user ke `/register?email=...`.
- Penanganan:
  - Ada (UX diarahkan ke registrasi).

### 6) User sudah terdaftar tapi coba register lagi dengan email sama

- Yang terjadi:
  - `POST /api/auth/register` melakukan SELECT `users` by email.
  - Jika ada → `409 "Email sudah terdaftar. Silakan masuk."`.
- Penanganan:
  - Ada.

### 7) Sesi expired — apa yang terjadi?

- Yang terjadi:
  - `src/lib/auth.ts` menggunakan `session.strategy = "jwt"` dan tidak menset `session.maxAge` / `jwt.maxAge` secara eksplisit.
  - Perilaku expiry mengikuti default NextAuth + cookie JWT.
- Penanganan:
  - [TIDAK DITEMUKAN] — perlu konfirmasi kebijakan expiry yang diinginkan (default NextAuth berlaku karena tidak di-override di kode).

### 8) User non-aktif atau diblokir admin — apakah ada mekanismenya?

- Yang terjadi:
  - Skema `users` tidak memiliki kolom seperti `isActive`, `isBanned`, `disabledAt`, dsb (`src/lib/db/schema.ts`).
  - `authorize` (`src/lib/auth.ts`) juga tidak mengecek status non-aktif/banned.
- Penanganan:
  - Belum ada mekanisme blokir user berbasis DB yang terlihat dari kode.

---

## Section 4 — Gap dan Yang Belum Ada

Daftar gap yang terlihat dari kode saat ini, beserta dampaknya.

1) **Pesan spesifik untuk OTP salah / OTP expired (UX)**
- Sekarang: saat OTP salah/expired, `signIn` gagal; UI cenderung kembali ke status “OTP diperlukan” dari `/api/auth/check-credentials`.
- Dampak: user tidak tahu apakah OTP salah, expired, atau ada masalah lain; bisa bolak-balik request OTP.

2) **Proteksi spam OTP bergantung pada Upstash Redis env**
- Sekarang: jika `UPSTASH_REDIS_REST_URL/TOKEN` tidak ada, `rateLimitAuth` & `rateLimitOtpSend` selalu `{ ok: true }`.
- Dampak: endpoint `/api/auth/request-login-code` bisa dipanggil berkali-kali (berpotensi email bombing & biaya email).

3) **Verifikasi email via OTP 6-digit tidak ada (meski UI/route naming mengarah ke sana)**
- Indikasi:
  - Ada UI `src/app/verify/VerifyClient.tsx` yang memanggil `POST /api/auth/verify-email` dengan `{ email, code }`.
  - Tetapi `src/app/api/auth/verify-email/route.ts` yang ada hanya `GET` (verifikasi via link token), tidak ada `POST` untuk verifikasi pakai kode.
- Dampak: jika halaman `/verify` atau flow OTP verifikasi email dipakai, kemungkinan besar tidak berfungsi sesuai ekspektasi. (Flow verifikasi yang benar saat ini adalah via link email.)

4) **Kebijakan sesi/expiry tidak didefinisikan di kode**
- Sekarang: tidak ada konfigurasi eksplisit untuk `maxAge` / refresh policy di `src/lib/auth.ts`.
- Dampak: tim tidak punya kontrol eksplisit (mengandalkan default); requirement keamanan/compliance bisa tidak terpenuhi.

5) **Tidak ada mekanisme “user diblokir/non-aktif”**
- Sekarang: tidak ada kolom status user dan tidak ada pengecekan di login.
- Dampak: admin tidak bisa menonaktifkan user dengan tegas melalui sistem auth (kecuali cara manual di luar flow ini).

