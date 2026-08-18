# FinanceMy

FinanceMy adalah aplikasi web pengelolaan keuangan pribadi berbasis React dan Firebase. Aplikasi membantu pengguna memahami saldo, arus kas, budget, tagihan, target keuangan, serta kondisi uang sampai pemasukan berikutnya.

> Kelola uangmu, pahami kebiasaanmu, dan rencanakan masa depanmu.

## Fitur yang tersedia

- Login, lupa password, protected route, dan onboarding.
- Login pengguna tertutup dan halaman admin `/admin` untuk provisioning akun.
- Dashboard saldo, arus kas, budget adaptif, tagihan, transaksi, forecast, dan insight.
- Form pemasukan, pengeluaran, dan transfer dengan validasi.
- Akun/dompet dan rekonsiliasi saldo.
- Budget fixed, adaptive, rollover, saving, dan hybrid.
- Transaksi rutin, konfirmasi tagihan, dan occurrence key anti-duplikasi.
- Target keuangan, dana darurat, utang, piutang, dan cicilan.
- Laporan grafik serta ringkasan kesehatan keuangan yang transparan.
- Light/dark mode, penyamaran nominal, ekspor JSON/CSV, desktop dan mobile navigation.
- Firestore rules per pengguna, indeks query, dan transaksi atomik untuk perubahan saldo.
- Data demo development yang tidak pernah ditulis ke akun pengguna Firebase.

Tidak ada Firebase Storage, upload foto/file/struk, kamera, OCR, bank API, pembayaran nyata, atau backend di luar Firebase.

## Teknologi

React 19, Vite, Tailwind CSS 4, Firebase Authentication/Firestore, React Router, Lucide React, Recharts, React Hook Form, dan date-fns.

## Menjalankan aplikasi

Prasyarat: Node.js 20+ dan sebuah project Firebase.

```bash
npm install
copy .env.example .env
npm run dev
```

Buka URL yang ditampilkan Vite. Untuk melihat seluruh fitur tanpa membuat akun, pilih **Masuk dengan data demo**. Data demo hanya disimpan di state aplikasi selama sesi berjalan.

Isi `.env` dengan konfigurasi Web App dari Firebase Console. Konfigurasi project yang diberikan sudah digunakan sebagai fallback development, tetapi environment variable tetap direkomendasikan untuk deployment.

Di Firebase Console:

1. Aktifkan Authentication → Sign-in method → Email/Password.
2. Buat Cloud Firestore.
3. Pastikan domain hosting ada di Authentication → Authorized domains.
4. Deploy rules dan indexes dari repository ini.

```bash
npx firebase-tools login
npx firebase-tools use YOUR_PROJECT_ID
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

## Build dan pemeriksaan

```bash
npm run lint
npm run build
```

Hasil build berada di folder `dist/`.

## Admin dan provisioning pengguna

Pendaftaran publik dinonaktifkan. Route `/register` diarahkan ke `/login`, sedangkan akun pengguna dibuat oleh admin melalui `/admin`. Operasi daftar, pembuatan, aktivasi/nonaktivasi, dan reset password berjalan di Netlify Function `admin-users`; Firebase Admin SDK tidak pernah dimuat ke browser.

### Environment variable Netlify

Tambahkan variabel server berikut melalui Netlify **Site configuration → Environment variables**. Jangan beri awalan `VITE_`:

```text
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
FIREBASE_WEB_API_KEY
```

`FIREBASE_ADMIN_PRIVATE_KEY` boleh disimpan dengan karakter `\n`; function akan mengubahnya menjadi newline. Sebagai alternatif, tiga variabel `FIREBASE_ADMIN_*` dapat diganti dengan satu `FIREBASE_SERVICE_ACCOUNT_JSON` yang berisi JSON service account lengkap. Jangan pernah memasukkan nilai rahasia tersebut ke source code atau `.env.example`.

`FIREBASE_WEB_API_KEY` adalah Web API key Firebase yang dipakai server untuk meminta Firebase mengirim email reset password. Meskipun Web API key bukan kredensial Admin SDK, simpan versi server ini tanpa awalan `VITE_`.

### Membuat admin pertama

1. Buat akun email/password admin melalui Firebase Console → Authentication → Users.
2. Unduh service account hanya ke komputer pengelola dan simpan di luar repository, atau gunakan nama file `service-account*.json` yang sudah diabaikan Git.
3. Di PowerShell, jalankan:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_FILE='C:\path-aman\service-account.json'
npm run set-admin -- --email admin@example.com
```

Alternatifnya, gunakan `--uid FIREBASE_UID`. Script mempertahankan custom claim lain yang telah dimiliki akun tersebut dan menambahkan `admin: true`.

4. Logout lalu login kembali melalui `/admin` agar Firebase menerbitkan ID token baru.

Admin pertama sebaiknya juga memiliki dokumen `users/{uid}` berstatus `active` bila akun tersebut akan menggunakan aplikasi FinanceMy sebagai pengguna biasa. Netlify Functions tetap memverifikasi claim admin secara langsung.

### Pengujian lokal admin

Gunakan Netlify CLI agar Vite dan Functions berjalan bersama:

```bash
npx netlify dev
```

Siapkan environment variable Admin SDK secara lokal melalui mekanisme environment Netlify atau shell. Jangan memakai `vite dev` untuk menguji endpoint karena Vite sendiri tidak menjalankan `/.netlify/functions/*`.

### Model keamanan

- Setiap request admin membawa Firebase ID token dan diverifikasi dengan `checkRevoked`.
- Endpoint menolak token tanpa custom claim `admin: true`.
- Admin SDK hanya berjalan di Netlify Functions.
- Pengguna nonaktif dinonaktifkan pada Firebase Authentication, refresh token dicabut, dan status Firestore diubah menjadi `disabled`.
- Firestore Rules memeriksa status pengguna pada setiap akses data. Dokumen lama tanpa field `status` diperlakukan aktif selama migrasi.
- Pengguna biasa tidak dapat membuat profil sendiri atau mengubah status miliknya.
- Admin tidak dapat menonaktifkan dirinya atau admin lain melalui dashboard.

## Deploy Firebase Hosting

```bash
npm run build
npx firebase-tools deploy --only hosting
```

File `firebase.json` sudah memiliki SPA rewrite ke `index.html`.

## Deploy Netlify

Repository mengikuti struktur yang sama dengan proyek Activity dan ApplyJob:

```text
FinanceMy/
├── netlify.toml
└── FinanceMy/
    ├── package.json
    ├── public/
    ├── src/
    └── vite.config.js
```

File `netlify.toml` di root repository sudah menetapkan:

- Base directory: `FinanceMy`
- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: versi 22
- SPA fallback: seluruh route diarahkan ke `/index.html`

Langkah deployment:

1. Hubungkan root repository `D:\Project\FinanceMy` ke Netlify.
2. Biarkan konfigurasi build dibaca dari `netlify.toml`.
3. Tambahkan seluruh `VITE_FIREBASE_*` pada Environment Variables.
4. Trigger **Clear cache and deploy site**.
5. Tambahkan domain Netlify ke Firebase Authentication Authorized domains.

File `public/_redirects` tetap disediakan sebagai fallback tambahan untuk React Router.

## Struktur penting

```text
src/
├── components/       # common, layout, forms, accounts, budgets, transactions
├── constants/        # data demo development
├── context/          # auth, theme, dan state finansial
├── firebase/         # konfigurasi Firebase
├── pages/            # auth, dashboard, transaksi, akun, budget, rutin, target, dll.
├── services/         # autentikasi dan operasi Firestore atomik
└── utils/            # Rupiah, tanggal, adaptive budget, dan cash-flow
```

Security rules ada di `firestore.rules`, sedangkan composite indexes ada di `firestore.indexes.json`.

## Catatan keamanan

- Password hanya disimpan oleh Firebase Authentication, bukan Firestore.
- Semua data bisnis berada di `users/{uid}/...` dan rules memeriksa UID pemilik.
- Operasi saldo multi-dokumen menggunakan Firestore transaction.
- Rules memvalidasi nama, tipe, nominal, dan tipe transaksi pada koleksi inti.
- Client tetap harus menampilkan error Firebase dengan bahasa yang mudah dipahami.
