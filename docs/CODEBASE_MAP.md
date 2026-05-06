# CODEBASE MAP

# SECTION 1 - Frontend Pages & Components

## src/app/layout.tsx
- **Fungsi/komponen:** `RootLayout` (default export), `metadata`
- **Tugas:** Root layout Next.js (App Router): membungkus semua halaman dengan `Navbar`, `Footer`, `AuthSessionProvider`, dan `ToastProvider`; inject Midtrans Snap.js bila provider `midtrans`.
- **State utama:** Tidak ada state React; menghitung `paymentProvider`, `isMidtrans`, `isSandbox`, `snapUrl`, `midtransClientKey`.
- **API yang dipanggil:** Tidak ada fetch langsung; load script Midtrans Snap (`https://app(.sandbox).midtrans.com/snap/snap.js`) bila aktif.
- **Komponen yang diimport:** `Footer`, `Navbar`, `AuthSessionProvider`, `ToastProvider`, `getPaymentProvider`.
- **Catatan penting:** Perilaku Snap.js tergantung env `MIDTRANS_IS_PRODUCTION` dan `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`; script hanya dimuat jika provider `midtrans`.

## src/app/page.tsx
- **Fungsi/komponen:** `HomePage` (default export)
- **Tugas:** Landing page; tombol primary mengarahkan user ke `/dashboard` jika login atau ke `/login?callbackUrl=%2Fdashboard` jika belum login.
- **State utama:** Tidak ada `useState`; derive `isLoggedIn` dari `useSession().status`.
- **API yang dipanggil:** Tidak ada.
- **Komponen yang diimport:** `HeroSection`, `NetworkPreviewStrip`, `TechnicalCredibility`, `VideoTutorial`, `PricingSection`, `FAQSection`; hooks `useSession`, `useRouter`.
- **Catatan penting:** Ini client component (`"use client"`); navigasi login memakai `callbackUrl` encode.

## src/app/dashboard/page.tsx
- **Fungsi/komponen:** `DashboardPage` (default export, async Server Component)
- **Tugas:** Gate halaman dashboard: cek session via `auth()`; kalau belum login redirect ke login; kalau login redirect ke `/upload`.
- **State utama:** Tidak ada.
- **API yang dipanggil:** Tidak ada fetch; memakai helper server `auth()`.
- **Komponen yang diimport:** `redirect` (next/navigation), `auth` (`@/lib/auth-server`).
- **Catatan penting:** Halaman ini tidak render UI; hanya redirect.

## src/app/upload/page.tsx
- **Fungsi/komponen:** `UploadPage` (default export)
- **Tugas:** Alur utama upload & analisis file `.inp`: pilih file → preview → jalankan analisis → polling job simulation → tampilkan hasil / error; juga bisa buka hasil dari riwayat.
- **State utama:** `state` (`AppState`), `selectedFile`, `result`, `errorMessage`, `isAnalyzing`, `isFixingPressure`, `isLoadingHistory`, `viewingHistoryId`, `pollAbortRef` (AbortController).
- **API yang dipanggil:**
  - `POST /api/analyze` (mulai analisis)
  - `GET /api/simulations/:jobId?analysisId=:id` (poll status backend job)
  - `GET /api/simulations/:jobId/result?analysisId=:id` (ambil hasil)
  - `GET /api/analyses/:analysisId` (ambil detail analisis dari riwayat)
  - `POST /api/fix-pressure` (aksi “Fix Pressure”)
  - `fetch(url)` pada helper `urlToFile` untuk download file dari URL riwayat
- **Komponen yang diimport:** `UploadZone`, `RecentAnalysesList`, `FileSelectedCard`, `ProcessingState`, `ResultsPanel`; hooks `useFilePreview`, `useTokenBalance`, `useToast`; `openBuyTokenModal`, constants token.
- **Catatan penting:** Ada beberapa mode UI (`upload`, `file-selected`, `processing`, `results`, `error`); polling memakai `AbortController` (perlu dibatalkan saat user cancel/navigasi); validasi token sebelum run (pakai `ANALYSIS_TOKEN_COST`).

## src/app/checkout/page.tsx
- **Fungsi/komponen:** `CheckoutPage` (default export)
- **Tugas:** Wrapper halaman checkout; render `CheckoutClient` dalam `Suspense` dengan fallback.
- **State utama:** Tidak ada.
- **API yang dipanggil:** Tidak ada (delegasi ke `CheckoutClient`).
- **Komponen yang diimport:** `CheckoutClient` (`@/app/checkout/CheckoutClient`), `Suspense`.
- **Catatan penting:** Halaman ini server component (tanpa `"use client"`); logika utama ada di client component.

## src/app/checkout/CheckoutClient.tsx
- **Fungsi/komponen:** `CheckoutClient` (named export)
- **Tugas:** UI pembelian paket token & riwayat transaksi: pilih paket, buat transaksi, buka popup Midtrans Snap untuk bayar, dan tampilkan invoice/riwayat.
- **State utama:** `selectedPackage`, `busyPackage`, `expandedHistory`, `invoiceTransaction`; derive `isAuthenticated`, `selectedFromQuery`, `transactions` dari SWR.
- **API yang dipanggil:**
  - `GET /api/transactions` (SWR, hanya jika authenticated)
  - `POST /api/token/create-transaction` (buat transaksi + dapatkan `snapToken`)
- **Komponen yang diimport:** `TokenPackageCard`, `InvoiceModal`, `Button`, `Card`; hooks `useToast`, `useTokenBalance`, `useSession`, `useSearchParams`, `useSWR`; util `formatIdr`; token package helpers.
- **Catatan penting:** Mengandalkan `window.snap.pay` (Snap.js dari layout) untuk payment; ada logic reuse `snapToken` jika masih valid (`snapTokenExpiresAt`); beberapa string tampak encoding “â€”” (perlu cek encoding file bila muncul di UI). [PERLU KONFIRMASI]

## src/app/admin/layout.tsx
- **Fungsi/komponen:** `AdminLayout` (default export), `metadata`, `dynamic`, `runtime`
- **Tugas:** Layout area admin; enforce admin via `requireAdmin()` lalu render children dalam `AdminShell` (dengan email).
- **State utama:** Tidak ada.
- **API yang dipanggil:** Tidak ada fetch; akses DB/auth via `requireAdmin` (server).
- **Komponen yang diimport:** `AdminShell`, `requireAdmin`.
- **Catatan penting:** `robots` diset noindex/nofollow; `dynamic = "force-dynamic"` dan `runtime = "nodejs"`.

## src/app/admin/page.tsx
- **Fungsi/komponen:** `AdminOverviewPage` (default export), `dynamic`, `runtime`
- **Tugas:** Halaman overview admin (server-rendered) yang menghitung metrik (users/analyses/transactions/reports) + menampilkan alert dan transaksi paid terbaru.
- **State utama:** Tidak ada (server component).
- **API yang dipanggil:** Tidak ada fetch; query database via Drizzle (`getDb()`).
- **Komponen yang diimport:** `requireAdmin`, `getDb`, schema (`analyses`, `transactions`, `users`, `contactMessages`), Drizzle helpers.
- **Catatan penting:** Banyak kalkulasi time window (24h/7d/30m/1h/today) dan alert routing (mis. `/admin/payments?filter=pending_old`, `/admin/health`, `/admin/reports`); output teks juga tampak encoding “â€”/â†’/Â·”. [PERLU KONFIRMASI]

## src/app/admin/AdminShell.tsx
- **Fungsi/komponen:** `AdminShell` (named export)
- **Tugas:** Shell UI admin: sidebar desktop bisa collapse + mobile bottom-sheet; menyajikan slot `{children}`.
- **State utama:** `collapsed`, `mobileOpen`; `titleId` dari `useId()`.
- **API yang dipanggil:** Tidak ada.
- **Komponen yang diimport:** `AdminSidebar`, React hooks.
- **Catatan penting:** Persist `collapsed` ke `localStorage` key `admin-sidebar-collapsed`; listener `Escape` untuk menutup mobile sheet.

## src/app/admin/AdminSidebar.tsx
- **Fungsi/komponen:** `AdminSidebar` (named export)
- **Tugas:** Sidebar navigasi admin (client): list nav item + tombol kembali ke app + tombol `signOut`.
- **State utama:** Tidak ada `useState`; derive `pathname` via `usePathname()`; prop-driven (`collapsed`, `email`).
- **API yang dipanggil:** Tidak ada.
- **Komponen yang diimport:** `Link`, `signOut`, `usePathname`, `cn` util.
- **Catatan penting:** Active state: item `/admin` harus match exact, item lain pakai `pathname.startsWith(item.href)`; `signOut({ callbackUrl: "/" })` dipanggil saat logout.

## src/app/admin/actions.ts
- **Fungsi/komponen:** Server actions: `adminAdjustTokens`, `adminSetTokens`, `adminUpdateUser`, `adminUpdateReport`, `adminUpdateTransaction`
- **Tugas:** Mutasi data admin (token balance, user, report, transaksi) + revalidate path admin terkait; sebagian mengirim email konfirmasi pembayaran.
- **State utama:** Tidak ada (server).
- **API yang dipanggil:** Tidak ada fetch; operasi DB via Drizzle + `revalidatePath`; email via `sendPaymentConfirmationEmail`.
- **Komponen yang diimport:** `revalidatePath`, `zod`, Drizzle, `requireAdmin`, `getDb`, schema DB, `sendPaymentConfirmationEmail`.
- **Catatan penting:** Validasi input via Zod + `FormData`; `adminUpdateTransaction` menambah token ke user saat status jadi `paid` dan revalidate termasuk `/checkout`.

# SECTION 2 - Components, Types & Lib

## src/components/layout/Navbar.tsx
- **Fungsi/komponen/type:** `Navbar`
- **Tugas:** Top navigation (client) + menu profil; menampilkan token balance; membuka modal riwayat & modal beli token; hide di area `/admin`.
- **Dependensi:** `src/components/modals/AnalysisHistoryModal.tsx`, `src/components/modals/BuyTokenModal.tsx`, `src/components/modals/TransactionHistoryModal.tsx`, `src/lib/ui-events.ts`, `src/hooks/useTokenBalance` [PERLU KONFIRMASI]
- **Catatan penting:** Listener global event `UI_EVENT_OPEN_BUY_TOKEN`; mengelola click-outside + ESC untuk menu profil; `signOut()` tanpa callback; nav items berubah sesuai login.

## src/components/layout/Footer.tsx
- **Fungsi/komponen/type:** `Footer`
- **Tugas:** Footer global; hide di area `/admin`.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Ada teks copyright yang tampak encoding `Â©` di output (kemungkinan encoding file).

## src/components/providers/SessionProvider.tsx
- **Fungsi/komponen/type:** `AuthSessionProvider`
- **Tugas:** Wrapper `next-auth` `SessionProvider` untuk client tree.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Komponen sederhana; semua props hanya `children`.

## src/components/providers/ToastProvider.tsx
- **Fungsi/komponen/type:** `ToastProvider`, `useToast`, `ToastItem` (type export)
- **Tugas:** Toast system sederhana berbasis context; auto-dismiss dan max 4 toast.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** `useToast()` akan throw jika dipakai di luar provider; toast id memakai timestamp+random; beberapa glyph tampak encoding (`âœ“`).

## src/components/auth/PasswordRequirements.tsx
- **Fungsi/komponen/type:** `PasswordRequirements`, `isPasswordValid`
- **Tugas:** UI checklist persyaratan password + helper validasi.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Rule regex simbol cukup long; `isPasswordValid` memastikan semua requirement terpenuhi.

## src/components/checkout/TokenPackageCard.tsx
- **Fungsi/komponen/type:** `TokenPackageCard`
- **Tugas:** Card UI untuk menampilkan paket token + CTA button.
- **Dependensi:** `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/lib/utils.ts`, `src/lib/token-packages.ts`
- **Catatan penting:** Styling badge bergantung `pkg.badgeTone`; mode `compact`, `selected`, `disabled`.

## src/components/modals/BuyTokenModal.tsx
- **Fungsi/komponen/type:** `BuyTokenModal`
- **Tugas:** Modal pilih paket token lalu redirect ke `/checkout?package=...`.
- **Dependensi:** `src/components/ui/dialog.tsx`, `src/components/checkout/TokenPackageCard.tsx`, `src/lib/token-packages.ts`
- **Catatan penting:** Menutup modal lalu `router.push`; state `isChoosing` dipakai untuk disable card lain.

## src/components/modals/AnalysisHistoryModal.tsx
- **Fungsi/komponen/type:** `AnalysisHistoryModal`
- **Tugas:** Modal tabel 20 analisis terakhir (read-only).
- **Dependensi:** `src/components/ui/dialog.tsx`, `src/components/ui/table.tsx`
- **Catatan penting:** Fetch via SWR ke `/api/analyses` hanya ketika modal open; label jenis `fix_pressure` vs `V1`.

## src/components/modals/TransactionHistoryModal.tsx
- **Fungsi/komponen/type:** `TransactionHistoryModal`
- **Tugas:** Modal tabel transaksi terbaru user (maks 5 ditampilkan).
- **Dependensi:** `src/components/ui/dialog.tsx`, `src/components/ui/table.tsx`, `src/lib/utils.ts`, `src/lib/token-packages.ts`, `src/types/transactions.ts`
- **Catatan penting:** Fetch via SWR ke `/api/transactions` hanya ketika open; status label berisi emoji/glyph yang tampak encoding.

## src/components/modals/InvoiceModal.tsx
- **Fungsi/komponen/type:** `InvoiceModal`
- **Tugas:** Modal detail bukti pembayaran + aksi unduh PDF invoice.
- **Dependensi:** `src/components/ui/button.tsx`, `src/components/ui/dialog.tsx`, `src/lib/invoice-pdf.ts`, `src/lib/utils.ts`, `src/lib/token-packages.ts`, `src/types/transactions.ts`
- **Catatan penting:** `downloadInvoicePdf()` membuat PDF sederhana client-side; `statusLabel` hardcoded “Lunas”.

## src/components/sections/HeroSection.tsx
- **Fungsi/komponen/type:** `HeroSection`
- **Tugas:** Hero landing dengan CTA (login vs upload) + link docs.
- **Dependensi:** `src/components/ui/button.tsx`
- **Catatan penting:** Copy “Coba Gratis — 5 Token”; social proof list ada glyph encoding.

## src/components/sections/PricingSection.tsx
- **Fungsi/komponen/type:** `PricingSection`
- **Tugas:** Section harga; klik paket mengarah ke checkout atau login dengan callback.
- **Dependensi:** `src/components/checkout/TokenPackageCard.tsx`, `src/lib/token-packages.ts`
- **Catatan penting:** `callbackUrl` memakai `encodeURIComponent(href)`.

## src/components/sections/FAQSection.tsx
- **Fungsi/komponen/type:** `FAQSection`
- **Tugas:** Accordion FAQ sederhana.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** State `openIndex`; ikon panah menggunakan karakter encoding `â†“`.

## src/components/sections/TechnicalCredibility.tsx
- **Fungsi/komponen/type:** `TechnicalCredibility`
- **Tugas:** Section penjelasan teknis (card list) + link docs.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Copy memuat angka kriteria teknis; banyak karakter khusus (en dash/≤) tampak encoding.

## src/components/sections/VideoTutorial.tsx
- **Fungsi/komponen/type:** `VideoTutorial`
- **Tugas:** Section tutorial + mock UI (coming soon).
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Ada komponen internal `AppMockup()` (tidak diekspor).

## src/components/sections/HowItWorks.tsx
- **Fungsi/komponen/type:** `HowItWorks`
- **Tugas:** Section “3 langkah” cara kerja + link docs.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Pure presentational; ikon inline SVG.

## src/components/sections/NetworkPreviewStrip.tsx
- **Fungsi/komponen/type:** `NetworkPreviewStrip`
- **Tugas:** Strip preview topologi jaringan (SVG) contoh dari koordinat INP.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Data koordinat + vertices besar di file; ini hardcoded contoh jaringan; berpotensi berat untuk bundle client jika tidak di-split. [PERLU KONFIRMASI]

## src/components/sections/UploadZone.tsx
- **Fungsi/komponen/type:** `UploadZone`
- **Tugas:** Dropzone upload (drag-drop + click) untuk file `.inp`.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** State `isDragging`; akses input file via ref; keyboard `Enter`/`Space` memicu picker.

## src/components/sections/FileSelectedCard.tsx
- **Fungsi/komponen/type:** `FileSelectedCard`
- **Tugas:** Menampilkan ringkasan file terpilih + preview counts + CTA “Jalankan Analisis”.
- **Dependensi:** `src/components/ui/button.tsx`, `src/lib/token-constants.ts`, `src/lib/ui-events.ts`, `src/hooks/useFilePreview` (type) [PERLU KONFIRMASI]
- **Catatan penting:** Gate token via `ANALYSIS_TOKEN_COST`; jika saldo kurang tombol jadi “Beli Token”.

## src/components/sections/ProcessingState.tsx
- **Fungsi/komponen/type:** `ProcessingState`
- **Tugas:** UI progress & stepper saat analisis berjalan; ada tombol cancel.
- **Dependensi:** `src/components/ui/button.tsx`, `src/components/ui/progress.tsx`
- **Catatan penting:** Progress disimulasikan (assumed total 30s) + step advancing; pastikan cleanup `setTimeout`/`raf`.

## src/components/sections/RecentAnalysesList.tsx
- **Fungsi/komponen/type:** `RecentAnalysesList`
- **Tugas:** Menampilkan list analisis “3 hari terakhir” + tombol “Lihat Analisis”.
- **Dependensi:** `src/components/ui/button.tsx`
- **Catatan penting:** Fetch SWR `/api/analyses/recent`; menghitung label issues `found -> remaining`.

## src/components/results/ResultsPanel.tsx
- **Fungsi/komponen/type:** `ResultsPanel`
- **Tugas:** Orchestrator UI hasil analisis: navigasi (“← Kembali”, “Analisis File Baru”), ringkasan (`SummaryCard`), tabs detail (Pipa/Node/Material), panel perubahan diameter (conditional), daftar masalah tersisa, rekomendasi PRV (conditional), dan aksi download.
- **Dependensi:** `src/components/results/SummaryCard.tsx`, `src/components/results/PipesTable.tsx`, `src/components/results/NodesTable.tsx`, `src/components/results/RemainingErrors.tsx`, `src/components/results/DiameterChanges.tsx`, `src/components/results/PrvRecommendation.tsx`, `src/components/results/DownloadActions.tsx`, `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/card.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/table.tsx`, `src/types/index.ts`
- **Catatan penting:** Menurunkan data `AnalysisResult` menjadi row sederhana untuk tabel; `result.kind` default ke `"diameter"` bila undefined; tab memakai guard `isTab()` untuk type-safe.

## src/components/results/SummaryCard.tsx
- **Fungsi/komponen/type:** `SummaryCard`
- **Tugas:** Card ringkasan hasil analisis: badge jenis analisis (`AnalysisKind`), badge konvergensi (opsional), engineUsed (opsional) + warning jika `engineUsed="wntr"`, dan grid statistik (issues found/fixed/remaining + durasi).
- **Dependensi:** `src/components/ui/badge.tsx`, `src/components/ui/card.tsx`, `src/types/index.ts`
- **Catatan penting:** `convergenceStatus` hanya ditampilkan jika bernilai salah satu `CONVERGED|STUCK|STAGNANT`.

## src/components/results/PipesTable.tsx
- **Fungsi/komponen/type:** `PipesTable`
- **Tugas:** Tabel kondisi pipa + filter pill “Semua/Bermasalah”; menampilkan diameter, velocity, headloss, dan badge status velocity/headloss.
- **Dependensi:** `src/components/ui/badge.tsx`, `src/components/ui/table.tsx`
- **Catatan penting:** “Bermasalah” = `velocityStatus !== "OK"` ATAU `headlossStatus !== "OK"`; container dibuat scrollable (`max-h` + `overflow-auto`).

## src/components/results/NodesTable.tsx
- **Fungsi/komponen/type:** `NodesTable`
- **Tugas:** Tabel kondisi node + filter pill “Semua/Bermasalah”; menampilkan tekanan (2 desimal) dan badge status tekanan.
- **Dependensi:** `src/components/ui/badge.tsx`, `src/components/ui/table.tsx`
- **Catatan penting:** “Bermasalah” = `pressureStatus !== "OK"`; container dibuat scrollable (`max-h` + `overflow-auto`).

## src/components/results/RemainingErrors.tsx
- **Fungsi/komponen/type:** `RemainingErrors`
- **Tugas:** Menampilkan daftar error tersisa; jika kosong tampil “✅ Tidak ada masalah yang tersisa.”, jika ada ditampilkan sebagai card per error (type + elementId + value/unit + explanation + suggestion).
- **Dependensi:** `src/components/ui/badge.tsx`, `src/components/ui/card.tsx`
- **Catatan penting:** Warna badge type ditentukan heuristik string (mis. `*HIGH*`/`*NEG*` → merah; `*LOW*`/`*SMALL*` → kuning).

## src/components/results/DiameterChanges.tsx
- **Fungsi/komponen/type:** `DiameterChanges`
- **Tugas:** Menampilkan perubahan diameter pipa dalam bentuk tabel; jika kosong tampil “Tidak ada perubahan diameter.”
- **Dependensi:** `src/components/ui/badge.tsx`, `src/components/ui/table.tsx`
- **Catatan penting:** Badge alasan memetakan `V-HIGH|V-LOW|HL-HIGH|HL-SMALL` ke label bahasa Indonesia.

## src/components/results/PrvRecommendation.tsx
- **Fungsi/komponen/type:** `PrvRecommendation`
- **Tugas:** UI rekomendasi PRV dari `AnalysisResult.prvRecommendation`: tabel rekomendasi + warning unresolved nodes + tombol “Add PRV Otomatis — 3 Token” (disabled saat proses atau token kurang).
- **Dependensi:** `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/table.tsx`, `src/types/index.ts`
- **Catatan penting:** `tokenBalance` dicek hanya jika tidak null/undefined; bila `prvRecommendation` null atau `needed=false`, tampilkan status OK.

## src/components/results/DownloadActions.tsx
- **Fungsi/komponen/type:** `DownloadActions`
- **Tugas:** Aksi download export dari server (`POST /api/analyses/:analysisId/export?format=...`): PDF (gratis) + INP (berbayar) tergantung `kind`; menampilkan state busy/error dan link “Beli Token” jika token tidak cukup.
- **Dependensi:** `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/card.tsx`, `src/lib/ui-events.ts`, `src/types/index.ts`
- **Catatan penting:** `downloadExport()` mengunduh via `fetch`→`blob`→`URL.createObjectURL` + parse filename dari `content-disposition`.

## src/hooks/useFilePreview.ts
- **Fungsi/komponen/type:** `useFilePreview`
- **Tugas:** Client hook untuk preview file `.inp` sebelum analisis: POST file ke `/api/analyze/preview`, lalu expose `{ preview, isLoading, error, reset }`.
- **Dependensi:** `src/types/index.ts` (`PreviewResult`), fetch `/api/analyze/preview`
- **Catatan penting:** Menggunakan `AbortController` untuk membatalkan request saat file berubah/unmount; status internal `"idle"|"loading"|"success"|"error"`.

## src/components/ui/button.tsx
- **Fungsi/komponen/type:** `Button` (forwardRef)
- **Tugas:** Primitive button dengan variant/size + styling konsisten.
- **Dependensi:** `src/lib/utils.ts`
- **Catatan penting:** Default `type="button"`; className digabung via `cn`.

## src/components/ui/badge.tsx
- **Fungsi/komponen/type:** `Badge`
- **Tugas:** Primitive badge (default/outline).
- **Dependensi:** `src/lib/utils.ts`
- **Catatan penting:** Styling sederhana; dipakai di ResultsPanel.

## src/components/ui/card.tsx
- **Fungsi/komponen/type:** `Card`, `CardHeader`, `CardTitle`, `CardContent`
- **Tugas:** Primitive card wrappers.
- **Dependensi:** `src/lib/utils.ts`
- **Catatan penting:** `Card` base style + shadow; lainnya hanya padding/typography.

## src/components/ui/dialog.tsx
- **Fungsi/komponen/type:** `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- **Tugas:** Modal dialog minimal (portal + backdrop + ESC close + lock scroll).
- **Dependensi:** `src/lib/utils.ts`
- **Catatan penting:** `DialogContent` render portal hanya setelah mounted; backdrop tombol menutup dialog.

## src/components/ui/progress.tsx
- **Fungsi/komponen/type:** `Progress`
- **Tugas:** Progress bar sederhana dengan clamp 0–100.
- **Dependensi:** `src/lib/utils.ts`
- **Catatan penting:** Menggunakan aria `role="progressbar"`.

## src/components/ui/table.tsx
- **Fungsi/komponen/type:** `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- **Tugas:** Primitive table wrappers (styling).
- **Dependensi:** `src/lib/utils.ts`
- **Catatan penting:** `TableRow` memberi border bawah default; `TableCell` default text warna slate.

## src/components/ui/tabs.tsx
- **Fungsi/komponen/type:** `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- **Tugas:** Tabs primitive accessible (roving tabindex, keyboard nav, manual/automatic activation).
- **Dependensi:** `src/lib/utils.ts`
- **Catatan penting:** Menggunakan context internal; `TabsContent` unmount ketika tidak selected (kecuali `forceMount`).

## src/types/index.ts
- **Fungsi/komponen/type:** `AppState`, `User`, `NodeResult`, `PipeResult`, `MaterialResult`, `NetworkInfo`, `AnalysisResult`
- **Tugas:** Kumpulan type utama untuk UI/hasil analisis & file export.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** `AnalysisResult` memuat `prv` dan `prvDebug` cukup kompleks; beberapa field opsional (`filesV1`, `filesFinal`, dsb).

## src/types/auth.ts
- **Fungsi/komponen/type:** `AuthActionResponse`
- **Tugas:** Bentuk response standar untuk action auth (OTP, login, register, reset).
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Banyak flag boolean opsional; consumer harus hati-hati membedakan error case.

## src/types/transactions.ts
- **Fungsi/komponen/type:** `TransactionStatus`, `TransactionRow`
- **Tugas:** Type transaksi token & status pembayaran.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** `status` bisa `TransactionStatus | string | null` (ada kemungkinan status lain dari backend).

## src/types/next-auth.d.ts
- **Fungsi/komponen/type:** Module augmentation `next-auth` + `next-auth/jwt`
- **Tugas:** Menambah field `user.id` dan `user.isAdmin` di session/jwt.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Pastikan TS include file d.ts ini (tsconfig `typeRoots`/`include`). [PERLU KONFIRMASI]

## src/types/midtrans-client.d.ts
- **Fungsi/komponen/type:** Module declaration `midtrans-client`
- **Tugas:** Deklarasi module untuk paket `midtrans-client` agar TS tidak error.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Stub; tidak memberi typing detail.

## src/types/midtrans-snap.d.ts
- **Fungsi/komponen/type:** Global `window.snap.pay` typing
- **Tugas:** Definisi TS untuk Snap.js Midtrans yang di-inject via layout.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** `export {}` untuk menjadikan file module; penting agar global merge.

## src/lib/utils.ts
- **Fungsi/komponen/type:** `cn`, `formatIdr`, `normalizeQrisQrImageUrl`, `toFiniteNumber`
- **Tugas:** Util UI umum: classnames, format rupiah, normalisasi URL gambar QRIS, parsing number defensif.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** `cn` wrap `clsx`; `toFiniteNumber` meng-handle decimal koma.

## src/lib/http.ts
- **Fungsi/komponen/type:** `parseJsonResponse`
- **Tugas:** Helper parsing response JSON defensif (return text + json object-or-null).
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Mengembalikan `json` hanya jika object (bukan array).

## src/lib/env.ts
- **Fungsi/komponen/type:** `getServerEnv`, `ServerEnv` (type)
- **Tugas:** Validasi server env var dengan Zod + cache hasil.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Throw error list env var yang invalid/missing; cached singleton `cached`.

## src/lib/payment.ts
- **Fungsi/komponen/type:** `getPaymentProvider`, `PaymentProvider` (type), `getPaymentAdminEmail`
- **Tugas:** Resolver provider pembayaran (saat ini hanya `midtrans`) + email admin pembayaran opsional.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** `getPaymentProvider()` selalu fallback ke `midtrans`; provider lain tidak didukung.

## src/lib/token-constants.ts
- **Fungsi/komponen/type:** `INITIAL_FREE_TOKENS`, `ANALYSIS_TOKEN_COST`, `PRESSURE_ANALYSIS_TOKEN_COST`, `FIX_PRESSURE_TOKEN_COST`, `DOWNLOAD_PDF_TOKEN_COST`, `DOWNLOAD_INP_TOKEN_COST`, `DOWNLOAD_EXCEL_TOKEN_COST`
- **Tugas:** Konstanta pricing token (analisis, fix pressure, export).
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** `PRESSURE_ANALYSIS_TOKEN_COST = 1`; PDF export gratis (0 token).

## src/lib/token-packages.ts
- **Fungsi/komponen/type:** `TOKEN_PACKAGE_ORDER`, `TokenPackageKey` (type), `TokenPackage` (type), `TOKEN_PACKAGES`, `resolveTokenPackageKey`, `getTokenPackage`, `TOKEN_PACKAGES_LIST`
- **Tugas:** Definisi paket token dan helper lookup/alias.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Ada string badge/framing yang tampak encoding (`ðŸ”¥`); alias legacy (`starter`, `value`).

## src/lib/ui-events.ts
- **Fungsi/komponen/type:** `UI_EVENT_OPEN_BUY_TOKEN`, `openBuyTokenModal`
- **Tugas:** Event bus sederhana (window event) untuk membuka modal beli token.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Dipakai oleh `Navbar` dan beberapa CTA (mis. upload/hasil).

## src/lib/admin.ts
- **Fungsi/komponen/type:** `isAdminEmail`, `shouldBypassTokensForEmail`
- **Tugas:** Policy admin (hardcoded master admin) + opsi bypass token untuk admin.
- **Dependensi:** `src/lib/env.ts`
- **Catatan penting:** Admin email hardcoded `arenoe.studio@gmail.com`; `parseEmailList` ada tapi tidak dipakai. [PERLU KONFIRMASI]

## src/lib/admin-server.ts
- **Fungsi/komponen/type:** `requireAdmin`
- **Tugas:** Guard server untuk area admin (redirect login atau 404 jika bukan admin).
- **Dependensi:** `src/lib/admin.ts`, `src/lib/auth-server.ts`
- **Catatan penting:** Redirect ke `/login?callbackUrl=%2Fadmin`; non-admin -> `notFound()`.

## src/lib/admin-health.ts
- **Fungsi/komponen/type:** `checkDatabase`, `checkUpstashRedis`, `checkConfigSanity`, `HealthCheckResult` (type)
- **Tugas:** Health check server-only untuk DB, Upstash Redis, dan sanity config (env vars).
- **Dependensi:** `src/lib/payment.ts`
- **Catatan penting:** Redis check degrade jika env tidak ada; `checkConfigSanity` cek Midtrans keys bila provider midtrans.

## src/lib/python-api.ts
- **Fungsi/komponen/type:** `getPythonApiBaseUrl`, `buildPythonApiUrl`
- **Tugas:** Helper membangun base URL Python API (env override atau origin request).
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Menghapus trailing slash agar konsisten.

## src/lib/midtrans.ts
- **Fungsi/komponen/type:** `PACKAGES`, `getSnap`
- **Tugas:** Wrapper Midtrans Snap server SDK + cache instance.
- **Dependensi:** `src/lib/token-packages.ts`
- **Catatan penting:** Membutuhkan `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` atau `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`; `isProduction` dari `MIDTRANS_IS_PRODUCTION`.

## src/lib/resend.ts
- **Fungsi/komponen/type:** `getResendClient`, `sendPaymentConfirmationEmail`, `sendAdminPendingPaymentEmail`, `sendAuthCodeEmail`, `sendVerifyEmailLinkEmail` [PERLU KONFIRMASI], `sendResetPasswordLinkEmail`
- **Tugas:** Email sender via Resend: konfirmasi pembayaran, notifikasi admin pending, OTP/auth, verifikasi email, reset password.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Banyak template HTML inline; `from` default `onboarding@resend.dev` atau `AUTH_EMAIL_FROM`; sebagian output tampak encoding (em dash).

## src/lib/invoice-pdf.ts
- **Fungsi/komponen/type:** `InvoicePdfInput` (type), `downloadInvoicePdf`
- **Tugas:** Generate PDF invoice minimal langsung di browser (tanpa library eksternal).
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** `escapePdfText` mengganti non-ascii jadi `?`; PDF 1 halaman fixed layout.

## src/lib/business.ts
- **Fungsi/komponen/type:** `BusinessInfo` (type), `getBusinessInfo`
- **Tugas:** Ambil info bisnis dari env public untuk dipakai di UI/dokumen.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Default email `support@epanet-solver.com` jika env kosong.

## src/lib/ratelimit.ts
- **Fungsi/komponen/type:** `rateLimitAnalyze`, `rateLimitCreateTransaction`, `rateLimitAuth`, `rateLimitOtpSend`, `rateLimitBackoff`
- **Tugas:** Rate limiting via Upstash (sliding window) + backoff exponential sederhana.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Jika Redis env tidak ada -> semua limiter return ok (no-op), tapi `rateLimitBackoff` masih return cooldown base.

## src/lib/request-ip.ts
- **Fungsi/komponen/type:** `getClientIp`
- **Tugas:** Ambil IP client dari headers (`x-forwarded-for` / `x-real-ip`).
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Fallback `"unknown"`.

## src/lib/request-origin.ts
- **Fungsi/komponen/type:** `getRequestOrigin`
- **Tugas:** Menentukan origin request (base URL) dari env atau headers.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Prioritas `APP_BASE_URL`/`NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL`; fallback header forwarded proto/host.

## src/lib/analysis-snapshots.ts
- **Fungsi/komponen/type:** `ANALYSIS_SNAPSHOT_TTL_DAYS`, `getAnalysisSnapshotExpiresAt`, `cleanupExpiredAnalysisSnapshots`, `upsertAnalysisSnapshot`
- **Tugas:** TTL snapshot analisis (3 hari) + cleanup/upsert ke DB.
- **Dependensi:** `src/lib/db/schema` (import langsung) [PERLU KONFIRMASI]
- **Catatan penting:** Ada fallback upsert via delete+insert jika conflict update gagal.

## src/lib/token-balance.ts
- **Fungsi/komponen/type:** `ensureInitialTokenBalanceRow`
- **Tugas:** Pastikan row token balance ada untuk user baru; isi default `INITIAL_FREE_TOKENS`.
- **Dependensi:** `src/lib/token-constants.ts`, `src/lib/db/schema` + `src/lib/db` (import langsung) [PERLU KONFIRMASI]
- **Catatan penting:** Logic special-case jika semua nol -> reset ke initial free tokens.

## src/lib/auth-server.ts
- **Fungsi/komponen/type:** `auth`
- **Tugas:** Wrapper `getServerSession(getAuthOptions())`.
- **Dependensi:** `src/lib/auth.ts`
- **Catatan penting:** Dipakai server components/API routes untuk ambil session.

## src/lib/auth.ts
- **Fungsi/komponen/type:** `getAuthOptions`
- **Tugas:** Konfigurasi NextAuth: Drizzle adapter + Credentials login (email/password + OTP optional) + session/jwt callbacks.
- **Dependensi:** `src/lib/admin.ts`, `src/lib/auth-otp.ts`, `src/lib/env.ts`, `src/lib/password.ts`, `src/lib/token-balance.ts`, `src/lib/db` + `src/lib/db/schema` [PERLU KONFIRMASI]
- **Catatan penting:** Lockout setelah 5 gagal (15 menit); require `emailVerified`; jika `mfaEnabled` butuh OTP `consumeOtpCode`; `events.createUser` menambah initial tokens.

## src/lib/auth-otp.ts
- **Fungsi/komponen/type:** `issueOtpCode`, `consumeOtpCode`
- **Tugas:** Issue & consume OTP code untuk login/verify/reset (hash + TTL + max attempts).
- **Dependensi:** `src/lib/otp.ts`, `src/lib/db/schema` + `src/lib/db` [PERLU KONFIRMASI]
- **Catatan penting:** MAX_ATTEMPTS=5; consume mengincrement attempts dan auto-consume saat limit.

## src/lib/otp.ts
- **Fungsi/komponen/type:** `OtpPurpose` (type), `generateOtpCode`, `hashOtpCode`
- **Tugas:** Generator OTP 6 digit + hash SHA-256 dengan pepper.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** OTP numeric; `hashOtpCode` format `${pepper}:${code}`.

## src/lib/password.ts
- **Fungsi/komponen/type:** `hashPassword`, `verifyPassword`
- **Tugas:** Hash password via scrypt + verify timing-safe.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Stored format `scrypt$N$r$p$salt$hash`; default params N=16384 r=8 p=1.

## src/lib/verification-token.ts
- **Fungsi/komponen/type:** `issueVerificationToken`, `consumeVerificationToken`, `hasUnexpiredVerificationToken`, `getEmailFromResetToken`
- **Tugas:** Token HMAC untuk verifikasi email / reset password + helper cek/consume.
- **Dependensi:** `src/lib/db/schema` + `src/lib/db` [PERLU KONFIRMASI]
- **Catatan penting:** Token disimpan hashed (HMAC) di DB; identifier reset password memakai prefix `reset_password:`.

# SECTION 3 - API Routes & Database

## src/app/api/analyze/route.ts
- **Method:** `POST`
- **Auth:** Wajib login via `auth()`; unauthorized => 401 (lihat line 21–24).
- **Token:** Pre-check token balance sebelum membuat job; cost = `ANALYSIS_TOKEN_COST` (lihat line 14, 53–56). Token final didebit saat result sukses (bukan di sini) via `/api/simulations/:jobId/result`. [KRITIS]
- **Input:** `multipart/form-data` dengan field `file: File` (.inp); validasi ekstensi & size (MAX 10MB).
- **Output:** Sukses: `{ success: true, analysisId, jobId }`; Error: `{ error }` (401/400/402/429/500) atau `{ success:false, error }` saat backend python error.
- **DB:** Insert `analyses` status `processing` + `tokensUsed` (line 61–67); update `analyses.status="failed"` saat backend gagal/timeout (line 89, 113).
- **Catatan penting:** Rate limit `rateLimitAnalyze("user:<id>")`; backend call ke Python API `/v1/simulations` timeout 15s (lihat `AbortSignal.timeout(15000)`).

## src/app/api/analyze/preview/route.ts
- **Method:** `POST`
- **Auth:** Wajib login via `auth()`; unauthorized => 401.
- **Token:** Tidak ada debit token (hanya preview/validasi awal).
- **Input:** `multipart/form-data` dengan `file: File` (.inp); validasi ekstensi + size (MAX 10MB).
- **Output:** Sukses: `{ success:true, ...previewPayload }`; Invalid file => 422 `{ success:false, error }`.
- **Dependensi:** `src/lib/auth-server.ts`, `src/lib/http.ts`, `src/lib/python-api.ts`, `next/server` (`NextResponse`).
- **Catatan penting:** Proxy ke Python API `/v1/preview` dengan timeout 15s.

## src/app/api/analyze/diameter/route.ts
- **Method:** `POST`
- **Auth:** Wajib login via `auth()`; unauthorized => 401.
- **Token:** Pre-check token balance; cost = `ANALYSIS_TOKEN_COST` (jika tidak bypass admin).
- **Input:** `multipart/form-data` dengan `file: File` + optional tuning `max_iterations`, `time_budget_s`.
- **Output:** Sukses: `{ success:true, analysisId, jobId }`; Error: `{ success:false, error }` (termasuk 402 bila token kurang).
- **DB:** Insert `analyses(kind="diameter")` status `processing`; update status `failed` jika backend gagal/timeout.
- **Dependensi:** `src/lib/auth-server.ts`, `src/lib/admin.ts`, `src/lib/db`, `src/lib/db/schema`, `src/lib/http.ts`, `src/lib/python-api.ts`, `src/lib/ratelimit.ts`, `src/lib/token-balance.ts`, `src/lib/token-constants.ts`.
- **Catatan penting:** Proxy ke Python API `/v1/analyze/diameter` dengan timeout 15s.

## src/app/api/analyze/pressure/route.ts
- **Method:** `POST`
- **Auth:** Wajib login via `auth()`; unauthorized => 401.
- **Token:** Pre-check token balance; cost = `PRESSURE_ANALYSIS_TOKEN_COST` (jika tidak bypass admin).
- **Input:** `multipart/form-data` dengan `file: File`.
- **Output:** Sukses: `{ success:true, analysisId, jobId }`; Error: `{ success:false, error }` (termasuk 402 bila token kurang).
- **DB:** Insert `analyses(kind="pressure")` status `processing`; update status `failed` jika backend gagal/timeout.
- **Dependensi:** `src/lib/auth-server.ts`, `src/lib/admin.ts`, `src/lib/db`, `src/lib/db/schema`, `src/lib/http.ts`, `src/lib/python-api.ts`, `src/lib/ratelimit.ts`, `src/lib/token-balance.ts`, `src/lib/token-constants.ts`.
- **Catatan penting:** Proxy ke Python API `/v1/analyze/pressure` dengan timeout 15s.

## src/app/api/analyze/add-prv/route.ts
- **Method:** `POST`
- **Auth:** Wajib login via `auth()`; unauthorized => 401.
- **Token:** Pre-check token balance; cost = `FIX_PRESSURE_TOKEN_COST` (jika tidak bypass admin).
- **Input:** `multipart/form-data` dengan `file: File` + `prvRecommendations` (JSON string, wajib, non-empty array).
- **Output:** Sukses: `{ success:true, analysisId, jobId }`; Error: `{ success:false, error }` / 422 jika rekomendasi invalid.
- **DB:** Insert `analyses(kind="add_prv")` status `processing`; update status `failed` jika backend gagal/timeout.
- **Dependensi:** `src/lib/auth-server.ts`, `src/lib/admin.ts`, `src/lib/db`, `src/lib/db/schema`, `src/lib/http.ts`, `src/lib/python-api.ts`, `src/lib/ratelimit.ts`, `src/lib/token-balance.ts`, `src/lib/token-constants.ts`.
- **Catatan penting:** Proxy ke Python API `/v1/analyze/add-prv` dengan timeout 15s.

## src/app/api/fix-pressure/route.ts
- **Method:** `POST`
- **Auth:** Wajib login via `auth()`; unauthorized => 401 (line 21–24).
- **Token:** Pre-check token balance; cost = `FIX_PRESSURE_TOKEN_COST` (lihat line 14, 61–62). Debit final tetap terjadi di `/api/simulations/:jobId/result`. [KRITIS]
- **Input:** `multipart/form-data` dengan `file: File` + optional `parentAnalysisId` (line 50–54).
- **Output:** Sukses: `{ success: true, analysisId, jobId }`; Error mirip analyze.
- **DB:** Insert `analyses` (`kind="fix_pressure"`, `parentAnalysisId`, `status="processing"`) (line 67–75); update `analyses.status="failed"` jika backend gagal/timeout (line 96, 121).
- **Catatan penting:** `parentAnalysisId` diparse ke number dan diset null jika invalid (line 50–54, 72).

## src/app/api/simulations/[jobId]/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()` (line 12–15).
- **Token:** Tidak ada debit token.
- **Input:** Params: `jobId` (path); Query: `analysisId` (line 20–21).
- **Output:** Proxy JSON dari backend python; jika backend invalid => `{ error }`.
- **DB:** Jika backend mengembalikan `status === "failed"` dan `analysisId` valid, update `analyses.status="failed"` untuk user tersebut (lihat update `analyses` di line 32).
- **Catatan penting:** Update `analyses` dibatasi `analyses.id` dan `analyses.userId` (lihat line 32 context). [PERLU KONFIRMASI detail where clause]

## src/app/api/simulations/[jobId]/result/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()` (line 61–64).
- **Token:** Debit token dilakukan di sini setelah backend result sukses; `tokenCost` = `FIX_PRESSURE_TOKEN_COST` jika `analysis.kind==="fix_pressure"` else `ANALYSIS_TOKEN_COST` (line 339). Debit dilakukan via update `tokenBalances.balance -= tokenCost` (line 363) + mark `analyses.status="failed"` jika saldo kurang (line 356/372/377). [KRITIS]
- **Input:** Params: `jobId`; Query wajib `analysisId` (line 70–73).
- **Output:** Sukses: `{ success:true, analysisId, summary, prv, files, filesV1, filesFinal, nodes, pipes, materials, networkInfo?, warnings?, diagnostics?, detailsTruncated, traceId }` (traceId selalu diinject). Error: `{ success:false, error, errorCode, traceId }` atau `{ error, traceId }`.
- **DB:** Read `analyses` untuk validasi ownership; update `analyses.status="success"` (line 386) + write ringkasan counts; update `tokenBalances` untuk debit (line 363).
- **Catatan penting:** Idempotent: jika `analysis.status === "success"`, route langsung return result tanpa debit ulang (lihat blok “Idempotency” tepat sebelum debit; [PERLU KONFIRMASI line]). Ada trace id header `x-trace-id`.

## src/app/api/simulations/[jobId]/files/[name]/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()` (line 10–13).
- **Token:** Tidak ada.
- **Input:** Params: `jobId`, `name`.
- **Output:** Proxy file bytes dari backend dengan pass-through `content-type` dan `content-disposition` (line 41).
- **DB:** Tidak ada.
- **Catatan penting:** Route ini mengekspos akses file backend berdasarkan `jobId` + `name`; keamanan hanya auth check (tidak ada ownership check). [KRITIS, PERLU KONFIRMASI risiko] 

## src/app/api/analyses/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()` (line 12–15).
- **Token:** Tidak ada.
- **Input:** Tidak ada.
- **Output:** `{ items: AnalysisRow[] }`.
- **DB:** Select dari tabel `analyses` untuk user, orderBy `createdAt`, limit 20 (line 30–33).
- **Catatan penting:** Ini list raw analisis (bukan snapshot payload).

## src/app/api/analyses/recent/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()`.
- **Token:** Tidak ada.
- **Input:** Tidak ada.
- **Output:** `{ items: RecentRow[] }` hasil dedup by `rootId` (max 20).
- **DB:** `cleanupExpiredAnalysisSnapshots` (line 21), lalu join `analyses` + `analysisSnapshots` (line 34–44).
- **Catatan penting:** Hanya menampilkan analisis yang punya snapshot belum expired (TTL 3 hari).

## src/app/api/analyses/[analysisId]/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()`.
- **Token:** Tidak ada.
- **Input:** Params `analysisId` (string -> number).
- **Output:** Payload JSON snapshot (apa adanya) atau `{ error }` 400/404.
- **DB:** Cleanup snapshot (line 30) lalu select `analysisSnapshots.payload` join `analyses` (line 36–37) dengan filter userId + expiresAt.
- **Catatan penting:** Return payload snapshot mentah (line 52); format payload bergantung writer (di `/api/simulations/:jobId/result`).

## src/app/api/analyses/[analysisId]/export/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()` (line 428) dan ownership check `analyses.id + analyses.userId` (line 470–471).
- **Token:** Ada charge token per format bila `tokenCost>0` dan tidak bypass admin; mapping cost pakai `DOWNLOAD_*_TOKEN_COST` (line 456–459) dan debit via `tokenBalances` update (line 518–524); ada `refundTokens()` untuk rollback jika export gagal (line 412–418, dipanggil di line 551 dan 962). [KRITIS]
- **Input:** Params: `analysisId`; Query: `format` in `{inp,pdf,xlsx,excel}` (line 22), `variant` in `{v1,final,source}` (line 23), optional lainnya (mis. `condition`?) [PERLU KONFIRMASI]
- **Output:** 
  - `format=inp`: file download (.inp) via `Response` bytes + `content-disposition`
  - `format=pdf`: PDF bytes
  - `format=xlsx|excel`: HTML-as-XLS bytes (content-type `application/vnd.ms-excel`)
  - Error JSON: `{ error }` (401/400/402/404/500)
- **DB:** Read `analyses` + `analysisSnapshots` (line 479–481); update `tokenBalances` untuk charge/refund (line 518–524; refund line 415–418).
- **Catatan penting:** Catatan di backend result: download “sekarang melalui `/api/analyses/:analysisId/export` agar jobId tidak diekspos ke client” (lihat `/api/simulations/:jobId/result` line 310). [KRITIS]

## src/app/api/token/balance/route.ts
- **Method:** `GET`
- **Auth:** Menggunakan `auth()`; jika `session.user.id` tidak ada tapi `email` ada, lookup userId via DB by email (line 14–25). Unauthorized => 401 (line 29).
- **Token:** Jika admin bypass => return balance hardcoded `999999` (line 32–33); else return row `ensureInitialTokenBalanceRow` (line 37–38).
- **Input:** Tidak ada.
- **Output:** `{ balance, totalBought, totalUsed }` atau `{ error }`.
- **DB:** Read `users` (email lookup) + `token_balances` via helper `ensureInitialTokenBalanceRow`.
- **Catatan penting:** `shouldBypassTokensForEmail` mem-bypass check token untuk admin.

## src/app/api/token/create-transaction/route.ts
- **Method:** `POST`
- **Auth:** Wajib login via `auth()` (line 37–40) dan email wajib ada (line 41–46).
- **Token:** Tidak ada debit token.
- **Input:** JSON `{ package: string }` divalidasi zod -> `TokenPackageKey` (line 22, 57–66).
- **Output:** Sukses: `{ provider, snapToken, orderId }`; Error: `{ error }` (401/429/422/400/500).
- **DB:** Ensure `users` row exists (insert jika tidak ada), insert `transactions` status pending + `snapToken` (lihat insert `transactions` line 103).
- **Catatan penting:** Rate limit per user (line 49); orderId format `EPANET-<userIdPrefix>-<timestamp>`; provider hanya `midtrans`.

## src/app/api/token/webhook/route.ts
- **Method:** `POST`
- **Auth:** Tidak pakai session; autentikasi via signature Midtrans (lihat `verifySignature` line 24–30; reject 403 line 43–44). [KRITIS]
- **Token:** Menambah token balance user jika pembayaran “paid” (settlement/capture). Tidak ada token cost.
- **Input:** JSON webhook Midtrans (`order_id`, `status_code`, `gross_amount`, `signature_key`, `transaction_status`, optional `payment_type`).
- **Output:** Hampir selalu `{ ok: true }` (termasuk jika tx tidak ditemukan) atau `{ error }` untuk invalid body/signature.
- **DB:** Read `transactions` by `orderId`; update `transactions.status` (pending/failed/paid) (line 69/76); upsert `tokenBalances` add tokens (line 87+); read `users.email` untuk kirim email konfirmasi.
- **Catatan penting:** Tidak memverifikasi `gross_amount` dengan DB; hanya signature + orderId match. [KRITIS, PERLU KONFIRMASI risiko]

## src/app/api/transactions/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()` (line 12).
- **Token:** Tidak ada.
- **Input:** Tidak ada.
- **Output:** `{ items: TransactionRow[] }`.
- **DB:** Select dari `transactions` untuk user, limit 20 (line 34–37).
- **Catatan penting:** Mengembalikan `snapToken` + `snapTokenExpiresAt` ke client.

## src/app/api/contact/route.ts
- **Method:** `POST`
- **Auth:** Optional: mencoba `auth()` untuk `userId` (line 39) tapi tetap menerima request tanpa login.
- **Token:** Tidak ada.
- **Input:** JSON `{ name,email,topic,message }` divalidasi zod (line 12).
- **Output:** Sukses `{ success: true }`; Error `{ error }` 400/422/500.
- **DB:** Insert `contactMessages` (line 42).
- **Catatan penting:** Email sending via Resend adalah non-fatal (error ditelan) (lihat blok try/catch setelah insert).

## src/app/api/debug/token/route.ts
- **Method:** `GET`
- **Auth:** Wajib login via `auth()`; produksi => 404 duluan (line 13).
- **Token:** Tidak ada.
- **Input:** Tidak ada.
- **Output:** Debug JSON: `{ ok:true, sessionUser, dbUser, tokenBalance }` atau `{ ok:false, error,... }` (401).
- **DB:** Read `users` + `tokenBalances` (line 44 menunjukkan query tokenBalances).
- **Catatan penting:** Pastikan route ini tidak aktif di production (guard `NODE_ENV` line 13).

## src/app/api/auth/[...nextauth]/route.ts
- **Method:** `GET`, `POST`
- **Auth:** Ditangani NextAuth handler (line 7–15).
- **Token:** N/A.
- **Input:** Sesuai NextAuth.
- **Output:** Sesuai NextAuth.
- **DB:** Ditangani adapter Drizzle via `getAuthOptions()`.
- **Catatan penting:** Semua auth session/jwt logic ada di `src/lib/auth.ts`.

## src/app/api/auth/check-credentials/route.ts
- **Method:** `POST`
- **Auth:** Tidak perlu session; rate-limit berdasarkan IP+email (line 35).
- **Token:** Tidak ada.
- **Input:** JSON `{ email, password }` (zod).
- **Output:** Sukses `{ ok:true }`; error bisa include flags `notRegistered`, `useOAuth`, `passwordWrong`, `notVerified`, `mfaRequired` (lihat banyak return `NextResponse.json`).
- **DB:** Read `users` by email (sql lower compare).
- **Catatan penting:** Mengembalikan 428 jika `mfaEnabled` (line 99–100).

## src/app/api/auth/request-login-code/route.ts
- **Method:** `POST`
- **Auth:** Tidak perlu session; rate-limit (line 40) + OTP send rate-limit (line 113).
- **Token:** Tidak ada.
- **Input:** JSON `{ email, password }`.
- **Output:** `{ ok:true }` atau error flags `notRegistered`, `useOAuth`, `passwordWrong`.
- **DB:** Read `users`; update `users.loginFailedCount/loginLockedUntil` saat password salah (line 90–97); insert OTP via `issueOtpCode` (line 122); email via `sendAuthCodeEmail` (line 130).
- **Catatan penting:** Lockout threshold 5 gagal -> 15 menit (line 90–92).

## src/app/api/auth/register/route.ts
- **Method:** `POST`
- **Auth:** Tidak perlu session; rate-limit register (line 60) + rate-limit OTP verify email (line 101).
- **Token:** Tidak ada (tapi membuat initial token balance row untuk user baru).
- **Input:** JSON `{ name?, email, password, confirmPassword? }` dengan password policy ketat.
- **Output:** `{ ok:true, emailSent:boolean }` atau `{ error }`.
- **DB:** Insert `users` (line 110) + `ensureInitialTokenBalanceRow` (line 117); issue verification token (line 124); cleanup user jika gagal issue token (line 134).
- **Catatan penting:** Email verifikasi memakai link `/api/auth/verify-email?...` (dibuat sebelum send; line 149). [KRITIS untuk flow verifikasi]

## src/app/api/auth/verify-email/route.ts
- **Method:** `GET`
- **Auth:** Tidak perlu session; rate-limit link verify (line 40).
- **Token:** Tidak ada.
- **Input:** Query `email`, `token` (zod) (line 20+).
- **Output:** Redirect ke `/verify-email-notice?...` untuk invalid/expired, atau redirect ke `/login?verified=1&email=...` setelah sukses (line 82).
- **DB:** Consume verification token (line 52) + update `users.emailVerified` (line 78).
- **Catatan penting:** Semua outcome menggunakan redirect (bukan JSON).

## src/app/api/auth/resend-verify-email/route.ts
- **Method:** `POST`
- **Auth:** Tidak perlu session.
- **Token:** Tidak ada.
- **Input:** JSON `{ email }`.
- **Output:** `{ ok:true, emailSent, cooldownSeconds }` atau error 400/422/429.
- **DB:** Read `users` (line sekitar 62, [PERLU KONFIRMASI]); issue verification token (line 96).
- **Catatan penting:** Anti-enumeration: jika user tidak ada / sudah verified tetap return ok (line 73–78); memakai backoff 30s–15m window 6h (line 46–55). [KRITIS untuk abuse]

## src/app/api/auth/forgot-password/route.ts
- **Method:** `POST`
- **Auth:** Tidak perlu session.
- **Token:** Tidak ada.
- **Input:** JSON `{ email }`.
- **Output:** Biasanya `{ ok:true }` (anti-enumeration) (line 55–57); bisa error 429 untuk rate-limit.
- **DB:** Read `users` by email; issue reset token TTL 1 jam (line 71) + send reset email best-effort (line 81).
- **Catatan penting:** Anti-enumeration explicit comment (line 55).

## src/app/api/auth/reset-password/route.ts
- **Method:** `POST`
- **Auth:** Tidak perlu session.
- **Token:** Tidak ada.
- **Input:** JSON `{ token, password, confirmPassword? }`.
- **Output:** `{ ok:true }` atau `{ error }` (400/422/429).
- **DB:** Resolve email from reset token (line 75), consume token (line 90), update `users.passwordHash` + reset lock counters (line 106–110).
- **Catatan penting:** Setelah consume token gagal => error “kadaluarsa” (line 97+). [PERLU KONFIRMASI line]

## src/lib/db/index.ts
- **Fungsi yang diekspor:** `getDb()` (buat client Drizzle Neon HTTP + cache), `DbClient` (type), `DrizzleDb` (type)
- **Tabel yang diakses:** melalui schema `src/lib/db/schema.ts` (semua tabel)
- **Catatan penting:** `DATABASE_URL` wajib ada (throw line 14–16); `cachedDb` singleton (line 9–20).

## src/lib/db/schema.ts
- **Fungsi yang diekspor:** Table definitions Drizzle: `users` (line 15), `authOtpCodes` (line 34), `accounts`, `sessions`, `verificationTokens`, `tokenBalances` (line 97), `analyses` (line 112), `analysisSnapshots` (line 127), `transactions` (line 143), `contactMessages` (line 165), `adminTokenEvents` (line 184)
- **Tabel yang diakses:** Semua tabel di atas
- **Catatan penting:** `analyses.tokensUsed` default `6` di schema.ts (lihat line sekitar 112 block; berbeda dengan `schema.drizzle.js` yang default 5). [KRITIS, PERLU KONFIRMASI mana yang benar di DB]

## src/lib/db/schema.drizzle.js
- **Fungsi yang diekspor:** `module.exports = { accounts, analyses, analysisSnapshots, authOtpCodes, adminTokenEvents, contactMessages, sessions, tokenBalances, transactions, users, verificationTokens }`
- **Tabel yang diakses:** Sama dengan `schema.ts`
- **Catatan penting:** Ini output JS untuk drizzle tooling; terlihat kolom `transactions.uniqueCode` yang tidak ada di `schema.ts` (lihat block `transactions` di file). [KRITIS, PERLU KONFIRMASI drift schema]

## src/lib/db/migrations/0000_yielding_ender_wiggin.sql
- **Fungsi yang diekspor:** N/A (SQL migration)
- **Tabel yang diakses:** Create: `accounts`, `analyses`, `sessions`, `token_balances`, `transactions`, `users`, `verificationToken`; tambah FK + unique index `token_balances_user_id_unique`.
- **Catatan penting:** Baseline schema awal (tokens_used default 6 di `analyses`).

## src/lib/db/migrations/0001_dashing_paibok.sql
- **Fungsi yang diekspor:** N/A
- **Tabel yang diakses:** `transactions` (unique index order_id), `users` (unique index email)
- **Catatan penting:** Enforce uniqueness.

## src/lib/db/migrations/0002_add_analysis_kind_parent.sql
- **Fungsi yang diekspor:** N/A
- **Tabel yang diakses:** `analyses` add columns `kind` + `parent_analysis_id`
- **Catatan penting:** Mendukung flow fix-pressure sebagai child analysis.

## src/lib/db/migrations/0003_same_radioactive_man.sql
- **Fungsi yang diekspor:** N/A
- **Tabel yang diakses:** Create `auth_otp_codes`; alter `users` add `password_hash`, `mfa_enabled`, `login_failed_count`, `login_locked_until`; index `auth_otp_codes_email_purpose_idx`
- **Catatan penting:** Menambah auth password + MFA + lockout + OTP table.

## src/lib/db/migrations/0004_checkout_snapshot.sql
- **Fungsi yang diekspor:** N/A
- **Tabel yang diakses:** `transactions` add `snap_token`, `snap_token_expires_at`
- **Catatan penting:** Dipakai untuk “lanjutkan pembayaran” tanpa membuat token baru.

## src/lib/db/migrations/0005_puzzling_wendell_vaughn.sql
- **Fungsi yang diekspor:** N/A
- **Tabel yang diakses:** Create `analysis_snapshots` + FK + index expires_at
- **Catatan penting:** TTL snapshot dipakai untuk “recent” dan “open history” tanpa simpan file permanen.

## src/lib/db/migrations/0006_military_steel_serpent.sql
- **Fungsi yang diekspor:** N/A
- **Tabel yang diakses:** Create `admin_token_events`, `contact_messages` + FK + indexes
- **Catatan penting:** Mendukung admin audit log token + fitur contact form.

## src/lib/db/migrations/meta/_journal.json
- **Fungsi yang diekspor:** N/A (drizzle meta)
- **Tabel yang diakses:** N/A
- **Catatan penting:** Daftar urutan migration yang sudah dibuat (idx 0–6).

## src/lib/db/migrations/meta/0000_snapshot.json
- **Fungsi yang diekspor:** N/A (drizzle snapshot)
- **Tabel yang diakses:** N/A
- **Catatan penting:** Metadata schema pada saat migration 0000. [PERLU KONFIRMASI]

## src/lib/db/migrations/meta/0001_snapshot.json
- **Fungsi yang diekspor:** N/A (drizzle snapshot)
- **Tabel yang diakses:** N/A
- **Catatan penting:** Metadata schema pada saat migration 0001. [PERLU KONFIRMASI]

## src/lib/db/migrations/meta/0003_snapshot.json
- **Fungsi yang diekspor:** N/A (drizzle snapshot)
- **Tabel yang diakses:** N/A
- **Catatan penting:** Metadata schema pada saat migration 0003. [PERLU KONFIRMASI]

## src/lib/db/migrations/meta/0005_snapshot.json
- **Fungsi yang diekspor:** N/A (drizzle snapshot)
- **Tabel yang diakses:** N/A
- **Catatan penting:** Metadata schema pada saat migration 0005. [PERLU KONFIRMASI]

## src/lib/db/migrations/meta/0006_snapshot.json
- **Fungsi yang diekspor:** N/A (drizzle snapshot)
- **Tabel yang diakses:** N/A
- **Catatan penting:** Metadata schema pada saat migration 0006. [PERLU KONFIRMASI]

# SECTION 4 - Python Engine

## api/analyze_python.py
- **Fungsi/class yang diekspor:** `UserError(Exception)`, `_env_int()`, `_env_float()`, `handler(BaseHTTPRequestHandler)` (HTTP handler class untuk POST), helper: `_read_multipart_file()`, `_b64_file()`, `_build_prv_targets()`, `_pressure_debug_snapshot()`
- **Tugas:** Entry-point HTTP server Python untuk menerima file `.inp` (multipart), menjalankan analisis/optimasi (diameter + PRV fix), lalu mengembalikan JSON hasil + base64 file output.
- **Input:** Request `multipart/form-data` field `file` (bytes) + optional `action` (`analyze`/`fix_pressure`) (lihat `_read_multipart_file` line 60). Env tuning: `EPANET_SOLVER_MAX_ITERATIONS` (default 15) line 39, `EPANET_SOLVER_TIME_BUDGET_S` (default 20.0s) line 40.
- **Output:** JSON response:
  - sukses: `{ success: true, summary, prv, prvDebug, filesV1, filesFinal?, files, nodes, pipes, materials, networkInfo }`
  - error user/validasi: status 422 `{ success:false, refund:false, error }`
  - error sistem: status 500 `{ success:false, refund:true, error:"System error" }`
- **Library eksternal:** stdlib (`base64`, `cgi`, `json`, `os`, `tempfile`, `traceback`, `uuid`, `http.server`, `pathlib`); internal package `epanet.*`; (indirect) `wntr`, `pandas`, `epyt` via modules.
- **Dipanggil oleh:** Backend Next.js memanggil endpoint Python `/v1/simulations` (lihat `src/app/api/analyze/route.ts` dan `src/app/api/fix-pressure/route.ts`).
- **Catatan penting:** Hard limits: file max 10MB (check di `do_POST`, [PERLU KONFIRMASI line]), iterations serverless default 15 (line 39) + time budget 20s (line 40); PRV stages loop `for stage in range(1, PRV_MAX_STAGES + 1)` (line 220) dan rerun diameter optimizer dibatasi `min(10, MAX_ITERATIONS_SERVERLESS)` (line 266).

## api/server/handlers/preview.py
- **Fungsi/class yang diekspor:** `preview_inp()` (+ helper parse section `.inp`)
- **Tugas:** Parse file `.inp` untuk preview tanpa simulasi (units/headloss, ringkasan counts, daftar node/pipa, warnings).
- **Dependensi:** `api/epanet/network_io.py` (`InpValidationError`, `load_network`), stdlib (`tempfile`, `pathlib`).
- **Catatan penting:** Validasi `UNITS=LPS` (raise `InpValidationError` bila bukan LPS).

## api/server/handlers/diameter.py
- **Fungsi/class yang diekspor:** `analyze_diameter()`
- **Tugas:** Jalankan optimasi diameter (sim baseline → optimize → sim after) dan return payload ringkasan + tabel pipes/nodes/materials + diameterChanges + remainingErrors.
- **Dependensi:** `api/epanet/network_io.py`, `api/epanet/simulation.py`, `api/epanet/optimizer.py`, `api/epanet/materials.py`, `api/server/handlers/shared.py` (`_build_remaining_errors`), stdlib (`tempfile`, `time`, `pathlib`).
- **Catatan penting:** Mengisi `summary.convergenceStatus` berdasarkan snapshots; `diameterChanges` dibangun dari map hasil optimizer.

## api/server/handlers/pressure.py
- **Fungsi/class yang diekspor:** `analyze_pressure()`
- **Tugas:** Simulasi jaringan untuk evaluasi tekanan node + generate rekomendasi PRV jika ada P-HIGH; return `prvRecommendation` + remainingErrors.
- **Dependensi:** `api/epanet/network_io.py`, `api/epanet/simulation.py`, `api/epanet/prv.py` (`analyze_prv_recommendations`, `build_pressure_followup`), `api/server/handlers/shared.py` (`_build_remaining_errors`), stdlib (`tempfile`, `pathlib`).
- **Catatan penting:** Node synthetic `J_PRV_*` dikecualikan dari output; `engineUsed` ditentukan dari audit unit (`_unit_audit`).

## api/server/handlers/add_prv.py
- **Fungsi/class yang diekspor:** `add_prv()`
- **Tugas:** Terapkan PRV berdasarkan rekomendasi (`apply_prvs`) + fine-tune setting (`fine_tune_prvs`), lalu simulasi ulang dan return payload node pressures + remainingErrors + log PRV terpasang.
- **Dependensi:** `api/epanet/network_io.py`, `api/epanet/simulation.py`, `api/epanet/prv.py` (`apply_prvs`, `fine_tune_prvs`), `api/server/handlers/shared.py` (`_build_remaining_errors`), stdlib (`tempfile`, `pathlib`).
- **Catatan penting:** Raise `ValueError` jika `prv_recommendations` kosong; output berisi `prvInstalled` untuk UI/download.

## api/server/handlers/shared.py
- **Fungsi/class yang diekspor:** `_build_remaining_errors()` (internal helper)
- **Tugas:** Normalisasi list `violations` (issue/element/value) menjadi payload UI `remainingErrors` lengkap dengan `unit`, `explanation`, `suggestion`.
- **Dependensi:** (tidak ada import internal)
- **Catatan penting:** Mapping penjelasan berbasis code issue (P-NEG/P-LOW/P-HIGH/V-HIGH/V-LOW/HL-HIGH/HL-SMALL).

## api/epanet/__init__.py
- **Fungsi/class yang diekspor:** (tidak ada; hanya marker package)
- **Tugas:** Menandai folder `epanet` sebagai package.
- **Input:** N/A
- **Output:** N/A
- **Library eksternal:** none
- **Dipanggil oleh:** Di-import oleh `api/analyze_python.py` lewat `from epanet...`
- **Catatan penting:** Kosong.

## api/epanet/config.py
- **Fungsi/class yang diekspor:** Konstanta global: `PRESSURE_MIN`, `PRESSURE_MAX`, `VELOCITY_MIN`, `VELOCITY_MAX`, `HL_MAX`, `DIAMETER_SIZES_MM`, `DIAMETER_SIZES_M`, `MAX_ITERATIONS`, `HW_C_DEFAULT`, `PRV_PRESSURE_TARGET`, `PRV_MAX_ITERATIONS`, `PRV_MAX_STAGES`, `OUTPUT_FOLDER_NAME`, `SEARCH_PATHS`
- **Tugas:** Konfigurasi standar teknis (Permen PU 18/2007), daftar diameter standar, dan parameter optimasi/PRV.
- **Input:** N/A (semua hardcoded constants).
- **Output:** N/A (dipakai sebagai import constants).
- **Library eksternal:** none
- **Dipanggil oleh:** `network_io.py` (SEARCH_PATHS), `diameter.py`, `optimizer.py`, `simulation.py`, `prv.py`, `reporter.py`, dan `analyze_python.py` (fallback `PRV_MAX_STAGES=4` line 51 jika import gagal).
- **Catatan penting:** Banyak nilai hardcoded (contoh: `PRESSURE_MIN=10`, `PRESSURE_MAX=80`, `HL_MAX=10`, `PRV_MAX_STAGES=4`) — perubahan standar akan berdampak ke seluruh engine.

## api/epanet/network_io.py
- **Fungsi/class yang diekspor:** `InpValidationError`, `validate_inp_file()`, `sanitize_inp_vertices()`, `load_network()`, `find_inp_file()`, `export_optimized_inp()`
- **Tugas:** Load & validasi `.inp` (section wajib, units, headloss) + sanitasi `[VERTICES]` + ekspor `.inp` teroptimasi (WNTR writer atau fallback patch teks).
- **Input:** `Path` ke file `.inp`; `export_optimized_inp(original_inp_path, wn_optimized, output_path)`.
- **Output:** `load_network()` -> `wntr.network.WaterNetworkModel`; `sanitize_inp_vertices()` -> string `.inp` bersih; `export_optimized_inp()` menulis file ke disk.
- **Library eksternal:** `wntr`, `tempfile`, `pathlib`.
- **Dipanggil oleh:** `api/analyze_python.py` (line 155: `load_network`, `export_optimized_inp`).
- **Catatan penting:** Validasi menuntut `UNITS=LPS` + `HEADLOSS=H-W` (lihat `validate_inp_file`); sanitasi vertices hanya untuk visual tapi mencegah WNTR crash.

## api/epanet/diameter.py
- **Fungsi/class yang diekspor:** `next_diameter_up()`, `next_diameter_down()`, `ceil_standard_diameter()`, `d_min_for_vmax()`, `d_min_for_headloss()`, `recommend_diameter()`, `mm()`, `status_symbol()`
- **Tugas:** Util diameter pipa: rounding ke diameter standar + rumus batas `Vmax` dan `HLmax` (inverse Hazen-Williams).
- **Input:** Flow `flow_m3s`, parameter target (`v_max`, `hl_target_per_km`, `C`), diameter `d_m`.
- **Output:** Diameter rekomendasi (meter) + meta breakdown (`recommend_diameter`).
- **Library eksternal:** stdlib `math`; internal `config`.
- **Dipanggil oleh:** `optimizer.py` (untuk iterasi diameter), `reporter.py` (status_symbol).
- **Catatan penting:** Jika `Q < 1e-12` return 0 (bisa mempengaruhi ceil ke diameter minimum di caller).

## api/epanet/materials.py
- **Fungsi/class yang diekspor:** `recommend_material()`, `pipe_working_pressure_m()`, `material_recommendations_for_network()`
- **Tugas:** Matriks rekomendasi material/C Hazen-Williams berdasarkan tekanan kerja dan diameter; menghitung tekanan kerja pipa dari head.
- **Input:** `pressure_m`, `diameter_mm`; `wn`, `head_series`, `sim_results`.
- **Output:** Dict rekomendasi material per pipe (`{ material, C, notes, pressureWorkingM, diameterMm }`).
- **Library eksternal:** `wntr`.
- **Dipanggil oleh:** `optimizer.py` (set roughness per material), `api/analyze_python.py` (line 158/186/309/372: material recommendations).
- **Catatan penting:** Override khusus: jika `P>160m` dan `D>114mm`, ganti dari GIP/Steel ke HDPE PN16 + note (hardcoded).

## api/epanet/simulation.py
- **Fungsi/class yang diekspor:** `EpanetToolkitUnavailable`, `run_simulation()`, `evaluate_network()`, `severity_breakdown()`, `severity_score()` (+ banyak helper internal untuk unit normalization & EPyT safe-close)
- **Tugas:** Menjalankan simulasi hidraulik (WNTR/EPANET toolkit) + evaluasi pelanggaran standar (P, V, HL) + scoring severity.
- **Input:** `wn: WaterNetworkModel`; `evaluate_network(wn, sim_results)` menerima output `run_simulation`.
- **Output:** `run_simulation()` -> dict `pressure/head/flow/velocity/headloss` (dan audit unit `_unit_audit`); `evaluate_network()` -> `{node_status, pipe_status, violations, all_ok, all_vhl_ok}`.
- **Library eksternal:** `wntr`, `pandas`, stdlib (`threading`, `tempfile`, `pathlib`, `os`), optional `epyt` (EPANET toolkit) via `from epyt import epanet` di helper.
- **Dipanggil oleh:** `api/analyze_python.py` (line 165, 173–174, 183–184, 295–296), `optimizer.py`, `prv.py`, `reporter.py`.
- **Catatan penting:** Ada global lock `_EPANET_TOOLKIT_LOCK` (line 107) karena EPANET toolkit bindings tidak thread-safe; node synthetic `J_PRV_*` dikecualikan dari violation counting pressure (lihat comment di `evaluate_network`, [PERLU KONFIRMASI line]).

## api/epanet/optimizer.py
- **Fungsi/class yang diekspor:** `optimize_diameters()` (+ helpers `_pipe_working_pressure_m`, `_apply_material_roughness`)
- **Tugas:** Modul iterasi diameter otomatis untuk menyelesaikan issue V/HL (pressure ditangani PRV module). Menghasilkan snapshot tiap iterasi.
- **Input:** `wn_orig`, optional `max_iterations`, `time_budget_s`.
- **Output:** `(wn_optimized, final_eval, diameter_changes, snapshots)`.
- **Library eksternal:** `wntr`, stdlib `copy`, `time`; internal `config`, `diameter`, `materials`, `simulation`.
- **Dipanggil oleh:** `api/analyze_python.py` (line 156/177 dan rerun line 268).
- **Catatan penting:** Stopping criteria: `CONVERGED` saat `all_vhl_ok`, atau `STUCK`/`STAGNANT` jika tidak ada perubahan/masalah tidak berubah; roughness diupdate berdasarkan rekomendasi material.

## api/epanet/prv.py
- **Fungsi/class yang diekspor:** `PrvRecommendation` (dataclass), `analyze_prv_recommendations()`, `apply_prvs()`, `fine_tune_prvs()`, `build_pressure_followup()` (+ banyak helper geometri/zone)
- **Tugas:** Analisis rekomendasi PRV untuk node P-HIGH (Modul 3A), otomatis menyisipkan PRV pada pipe (Modul 3B), dan fine-tune setting PRV agar tekanan downstream berada di band.
- **Input:** `wn`, `sim_results`, `eval_results`; `apply_prvs(wn, recommendations)`; `fine_tune_prvs(wn, zone_targets)`; `build_pressure_followup(wn, sim_results, eval_results, prv?)`.
- **Output:** 
  - `analyze_prv_recommendations` -> dict `{ needed, tokenCost?, recommendations?, unresolvedNodes? ... }`
  - `apply_prvs` -> list log PRV yang disisipkan (pipeA/valve/pipeB)
  - `fine_tune_prvs` -> list tuning log per iterasi
  - `build_pressure_followup` -> dict status + remaining nodes + recommendations/actions
- **Library eksternal:** `wntr`, stdlib (`collections.deque`, `dataclasses`, `typing`)
- **Dipanggil oleh:** `api/analyze_python.py` (line 160–163, 187, 237, 253, 289, 305).
- **Catatan penting:** "File ini sekarang hanya re-export dari prv_analysis.py dan prv_apply.py. Semua logika sudah dipindah ke ketiga file tersebut."
- **Catatan penting:** Feasibility setting berbasis static head banding elevasi (fungsi `_feasible_setting`); PRV setting di-clamp >=0; synthetic nodes `J_PRV_*` dipakai untuk modeling upstream/downstream.

## api/epanet/prv_helpers.py
- **Fungsi/class yang diekspor:** (helper internal) `_directed_edges_from_flow()`, `_pipe_dir()`, `_bfs_reachable()`, `_node_elev()`, `_feasible_setting()`, `_restrict_to_band()`, `_midpoint_coords()`, `_node_xy()`, `_polyline_len()`, `_split_polyline_at_fraction()`, `_current_setting()`, `_is_synthetic_prv_node()`, `_normalize_prv_targets()`, `_discover_prv_zone_targets()`
- **Tugas:** Kumpulan helper private top-level untuk modul PRV (graph flow, elevasi/feasibility band, geometri split pipe, discovery zona tuning).
- **Catatan penting:** Helper tetap private (prefix `_`) dan diimpor oleh `prv_analysis.py` dan `prv_apply.py`.

## api/epanet/prv_analysis.py
- **Fungsi/class yang diekspor:** `PrvRecommendation` (dataclass), `analyze_prv_recommendations()`, `build_pressure_followup()`
- **Tugas:** Modul analisis PRV: rekomendasi PRV (Modul 3A) + follow-up status/rekomendasi setelah fix.
- **Catatan penting:** `build_pressure_followup()` memanggil `analyze_prv_recommendations()`; helper lokal di dalam fungsi tetap ada (mis. `_collect()`).

## api/epanet/prv_apply.py
- **Fungsi/class yang diekspor:** `apply_prvs()`, `fine_tune_prvs()`
- **Tugas:** Modul apply PRV: sisip PRV ke network (Modul 3B) + tuning iteratif setting PRV per zona.
- **Catatan penting:** `fine_tune_prvs()` menyimpan helper lokal `_emit()` dan `_zone_pressures()` di dalam fungsi.

## api/epanet/reporter.py
- **Fungsi/class yang diekspor:** `export_markdown_report()` (+ helper tabel markdown)
- **Tugas:** Membuat laporan markdown (before/after) lengkap: ringkasan, violations, tabel node/pipa, rekomendasi material, dan log PRV/fine-tune.
- **Input:** `output_path: Path`, `wn`, `baseline_eval`, `after_eval`, `diameter_changes`, `materials`, `prv`, `prv_fix_log`, `prv_tune_log`, `pressure_followup`, `prv_debug_log`, `report_kind` (mis. `v1`/`final`) [PERLU KONFIRMASI signature lengkap]
- **Output:** Menulis file `.md` ke `output_path`.
- **Library eksternal:** `wntr`, stdlib (`datetime`, `pathlib`); internal `config`, `diameter`, `simulation`.
- **Dipanggil oleh:** `api/analyze_python.py` (line 157, dipanggil dua kali: v1 & final).
- **Catatan penting:** Menandai flow terbalik (q<0) sebagai saran balik arah pipa; banyak karakter khusus (â†’, â€” dll) menunjukkan potensi isu encoding pada output.

## Alur Panggilan Python Engine (Call Graph)
analyze_python.py
  → network_io.load_network()
  → simulation.run_simulation()                        # baseline
  → simulation.evaluate_network()
  → optimizer.optimize_diameters()                     # modul diameter (V/HL)
  → simulation.run_simulation()                        # after diameter
  → simulation.evaluate_network()
  → materials.material_recommendations_for_network()
  → prv.analyze_prv_recommendations()
  → reporter.export_markdown_report()                  # v1
  → network_io.export_optimized_inp()                  # optimized_v1.inp
  → (jika action=fix_pressure)
      → loop stage 1..PRV_MAX_STAGES
          → prv.apply_prvs()                           # sisipkan PRV
          → prv.fine_tune_prvs()                       # tuning setting PRV
          → optimizer.optimize_diameters(max<=10, time_budget<=20s)  # rerun setelah PRV
          → simulation.run_simulation()
          → simulation.evaluate_network()
          → prv.analyze_prv_recommendations()          # rekomendasi lanjutan
      → prv.build_pressure_followup()
      → materials.material_recommendations_for_network()
      → reporter.export_markdown_report()              # final
      → network_io.export_optimized_inp()              # optimized_final.inp

# SECTION 5 — Index Cepat (Quick Reference)

| Fungsi/Komponen | File | Tugas Singkat |
|---|---|---|
| `RootLayout` | `src/app/layout.tsx` | Root layout + inject Midtrans Snap.js bila provider midtrans |
| `HomePage` | `src/app/page.tsx` | Landing page + CTA routing login/dashboard |
| `UploadPage` | `src/app/upload/page.tsx` | Flow upload → analisis → polling → hasil/error |
| `ResultsPanel` | `src/components/results/ResultsPanel.tsx` | UI hasil analisis + export + PRV/fix pressure |
| `CheckoutClient` | `src/app/checkout/CheckoutClient.tsx` | Checkout token + transaksi + Snap.js payment |
| `Navbar` | `src/components/layout/Navbar.tsx` | Nav + token balance + buka modal riwayat/beli token |
| `ToastProvider` / `useToast()` | `src/components/providers/ToastProvider.tsx` | Toast context untuk notif UI |
| `openBuyTokenModal()` | `src/lib/ui-events.ts` | Trigger event global untuk membuka modal beli token |
| `useTokenBalance()` | `src/hooks/useTokenBalance` | Ambil saldo token user (client hook) [PERLU KONFIRMASI] |
| `auth()` | `src/lib/auth-server.ts` | Ambil session server via NextAuth |
| `getAuthOptions()` | `src/lib/auth.ts` | Konfigurasi NextAuth (credentials + adapter + callbacks) |
| `requireAdmin()` | `src/lib/admin-server.ts` | Guard server untuk area admin |
| `shouldBypassTokensForEmail()` | `src/lib/admin.ts` | Policy bypass token untuk admin |
| `getDb()` | `src/lib/db/index.ts` | Init + cache Drizzle Neon DB client |
| `users` / `analyses` / `transactions` / `tokenBalances` | `src/lib/db/schema.ts` | Definisi tabel utama app |
| `POST /api/analyze` | `src/app/api/analyze/route.ts` | Buat analysis job + call Python API (pre-check token) |
| `POST /api/fix-pressure` | `src/app/api/fix-pressure/route.ts` | Buat fix_pressure job + call Python API |
| `GET /api/simulations/:jobId/result` | `src/app/api/simulations/[jobId]/result/route.ts` | Ambil result + debit token on success + snapshot |
| `GET /api/analyses/:analysisId/export` | `src/app/api/analyses/[analysisId]/export/route.ts` | Export file + charge token per format + refund on failure |
| `POST /api/token/webhook` | `src/app/api/token/webhook/route.ts` | Webhook Midtrans: update tx + add token balance |
| `handler.do_POST()` | `api/analyze_python.py` | Entry HTTP Python engine: run analyze/fix_pressure dan return JSON |
| `load_network()` | `api/epanet/network_io.py` | Validasi + load .inp menjadi WaterNetworkModel |
| `optimize_diameters()` | `api/epanet/optimizer.py` | Iterasi diameter otomatis untuk V/HL |
| `run_simulation()` / `evaluate_network()` | `api/epanet/simulation.py` | Simulasi hidraulik + evaluasi pelanggaran standar |
| `analyze_prv_recommendations()` / `apply_prvs()` / `fine_tune_prvs()` | `api/epanet/prv.py` | Analisis PRV + sisip PRV + tuning setting |
| `export_markdown_report()` | `api/epanet/reporter.py` | Generate laporan markdown before/after + log PRV |
