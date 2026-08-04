# FinanceMy

FinanceMy adalah aplikasi web pengelolaan keuangan pribadi berbasis React dan Firebase. Aplikasi membantu pengguna memahami saldo, arus kas, budget, tagihan, target keuangan, serta kondisi uang sampai pemasukan berikutnya.

> Kelola uangmu, pahami kebiasaanmu, dan rencanakan masa depanmu.

## Fitur yang tersedia

- Login, register, lupa password, protected route, dan onboarding.
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

## Deploy Firebase Hosting

```bash
npm run build
npx firebase-tools deploy --only hosting
```

File `firebase.json` sudah memiliki SPA rewrite ke `index.html`.

## Deploy Netlify

1. Hubungkan repository ke Netlify.
2. Build command: `npm run build`.
3. Publish directory: `dist`.
4. Tambahkan seluruh `VITE_FIREBASE_*` pada Environment Variables.
5. Tambahkan domain Netlify ke Firebase Authentication Authorized domains.

Untuk SPA fallback Netlify, buat rewrite `/* /index.html 200` melalui konfigurasi dashboard atau file `_redirects` di folder `public`.

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
