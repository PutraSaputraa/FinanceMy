# FinanceMy

FinanceMy adalah aplikasi web pengelolaan keuangan pribadi berbasis React dan Firebase. Aplikasi membantu pengguna memahami saldo, arus kas, budget, tagihan, target keuangan, serta kondisi uang sampai pemasukan berikutnya.

> Kelola uangmu, pahami kebiasaanmu, dan rencanakan masa depanmu.

## Fitur yang tersedia

- Landing page publik untuk demo, penjualan akses, FAQ, dan roadmap produk.
- Identitas visual FinanceMy dengan logo, hero 3D, ilustrasi smart capture, dan social preview orisinal.
- Login, lupa password, protected route, dan onboarding.
- Login pengguna tertutup dan halaman admin `/admin` untuk provisioning akun.
- Dashboard saldo, arus kas, budget adaptif, tagihan, transaksi, forecast, dan insight.
- Form pemasukan, pengeluaran, dan transfer dengan validasi, serta edit dan hapus transaksi yang memperbarui saldo akun.
- Akun/dompet dan rekonsiliasi saldo.
- Budget per kategori untuk bulan kalender berjalan, dengan panduan harian tetap atau adaptif.
- Transaksi rutin dengan pengingat, pembayaran manual, dan pencegahan pencatatan ganda per periode.
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

Untuk mengarahkan tombol penjualan di landing page ke WhatsApp admin, isi `VITE_SALES_WHATSAPP` dengan nomor internasional tanpa tanda `+`, misalnya `6281234567890`.

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

## Cara kerja budget

Budget baru memiliki nama bebas dan berlaku pada bulan berjalan. Saat mencatat pengeluaran atau refund, pengguna dapat memilih satu budget aktif bulan transaksi tersebut atau **Tanpa budget**. Kategori transaksi tetap dipakai untuk laporan dan tidak otomatis menentukan budget. Pilihan yang sama tersedia saat membayar transaksi rutin; budget dihitung berdasarkan tanggal pembayaran. Transaksi baru menyimpan `budgetId` secara eksplisit, termasuk `null` untuk Tanpa budget.

Budget dan transaksi lama tidak diubah. Transaksi lama yang belum memiliki field `budgetId` tetap dihitung berdasarkan kategori pada budget lama, sehingga angka sebelumnya tetap sama. Saat transaksi lama diedit, budget yang sebelumnya terhitung ditampilkan dan pengguna dapat mengganti atau mengosongkannya. Budget dapat dihapus tanpa menghapus transaksi. Saat bulan berganti, budget lama tidak lagi aktif; buat budget baru untuk bulan berikutnya. Sisa budget tidak otomatis dibawa ke bulan berikutnya. Mode **Tetap** membagi batas bulanan dengan jumlah hari dalam bulan, sedangkan **Adaptif** membagi sisa budget dengan jumlah hari yang tersisa.

## Cara kerja transaksi rutin

Transaksi rutin adalah jadwal dan pengingat, bukan pencatatan otomatis. Setiap jadwal memiliki jenis, nominal, frekuensi, tanggal jatuh tempo berikutnya, kategori, dan akun bawaan. Pengingat muncul pada H-7 sampai jatuh tempo dan tetap tampil bila terlambat; angka di sidebar menunjukkan jumlah jadwal yang perlu perhatian saat aplikasi dibuka. Pengguna dapat mengedit jadwal, termasuk nominal dan akun bawaan, tanpa mengubah transaksi yang sudah dicatat.

Tombol **Bayar** (atau **Terima** untuk pemasukan rutin) meminta konfirmasi nominal dan akun. Untuk pengeluaran, pengguna juga dapat memilih budget atau Tanpa budget. Setelah dikonfirmasi, aplikasi membuat transaksi biasa, memperbarui saldo dan budget yang dipilih, lalu memajukan jatuh tempo satu periode. Perubahan ini dilakukan bersama dalam satu transaksi Firestore dengan identitas unik per periode untuk mencegah pencatatan ganda. Periode yang belum dibayar tidak dilewati otomatis. Tombol **Hapus** menghentikan jadwal serta pengingat berikutnya, tetapi riwayat transaksi tetap tersimpan. Pengingat di aplikasi bukan notifikasi push saat aplikasi tertutup.

## Kategori dan tag pengguna

**Pengaturan > Kategori & tag** menyediakan kategori pengeluaran, kategori pemasukan, dan tag. Pengguna dapat menambah nama dan warna serta menonaktifkan atau mengaktifkan kembali entri. Nama duplikat ditolak tanpa membedakan kapitalisasi dan spasi berlebih. Kategori bawaan dimuat tanpa menulis data awal ke Firestore; pengaturan aktifnya disimpan per pengguna. Riwayat kategori/tag pada transaksi lama tetap tersimpan setelah dinonaktifkan.

Kategori aktif digunakan oleh form transaksi, jadwal rutin, draf WhatsApp, dan parser Myoui. Transaksi mendukung beberapa tag dan pencarian berdasarkan tag. Kategori disimpan di `users/{uid}/categories`, tag di `users/{uid}/tags`, dan pilihan tag disimpan pada transaksi. Perubahan demo hanya berlaku selama sesi aplikasi.

## Ringkasan bulanan dan pengingat WhatsApp

Aktifkan masing-masing fitur melalui **Pengaturan > WhatsApp > Pengingat & laporan dari Myoui** setelah menghubungkan chat. Keduanya awalnya nonaktif. Preferensi tersimpan di `users/{uid}/settings/assistant`.

- **Ringkasan bulanan:** satu pesan singkat tanggal 1 mulai 09.00 WIB untuk bulan kalender sebelumnya, dengan kesempatan pengiriman susulan sampai tanggal 3 jika konektor sempat terputus. Tidak dikirim bila tidak ada transaksi relevan. Pesan memuat pemasukan, pengeluaran bersih, selisih, satu temuan, dan satu pengeluaran rutin terdekat dalam tujuh hari.
- **Pengingat rutin:** pilihan H-7 (bawaan), H-3, atau hari jatuh tempo. Satu pengingat per jadwal dan tanggal jatuh tempo, termasuk pemasukan rutin. Mengubah waktu pengingat tidak mengulang pesan untuk periode yang sama. Jadwal yang sudah dibayar/dihentikan sebelum pengiriman tidak diingatkan lagi. Pengingat yang terlewat satu hari penuh tidak dikirim sebagai pesan kedaluwarsa.
- Pesan dikirim hanya pada 09.00–20.59 WIB melalui konektor VPS yang aktif, tanpa perlu membuka aplikasi. Saldo dan transaksi tidak diubah oleh pengingat.
- Balas **detail** / **rincian laporan** untuk rincian bulan dari laporan terakhir yang diterima; jika belum pernah menerima laporan, digunakan bulan sebelumnya. **Laporan bulanan** meminta ringkasan bulan sebelumnya. Draf transaksi yang sedang menunggu tetap tersimpan. Respons ini tidak memerlukan model AI.
- **Laporan > Ringkasan bulanan Myoui** menyediakan pemilihan bulan, pratinjau pesan, dan rincian kategori. Angka dihitung ulang dari transaksi yang tersimpan. Transfer antar-akun dikecualikan, biaya admin transfer dihitung sebagai pengeluaran, refund mengurangi pengeluaran, dan rekonsiliasi saldo dikecualikan. Selisih bukan saldo/tabungan. Perbandingan tidak dibuat tanpa data pengeluaran bulan sebelumnya.

### Aktivasi di produksi

1. Deploy `firestore.rules` terbaru agar koleksi tag dapat dibaca/ditulis oleh pemilik akun.
2. Deploy frontend dan Netlify Functions, termasuk `whatsapp-notifications`. Endpoint menggunakan `WA_CONNECTOR_KEY` yang sudah ada.
3. Perbarui kode `whatsapp-service` di VPS dan restart layanan. Endpoint pengingat otomatis diturunkan dari `WA_INGEST_ENDPOINT`; `WA_NOTIFICATION_ENDPOINT` opsional bila alamatnya berbeda.
4. Hubungkan chat dan aktifkan fitur yang diinginkan di pengaturan pengguna.

Konektor memeriksa antrean setiap menit. Function memeriksa status akun, pasangan chat, preferensi, dan jatuh tempo sebelum memberikan lease pengiriman. Dokumen `waNotificationDeliveries` dan `waReportContexts` hanya diakses oleh server. Identitas pengiriman tetap per bulan/jatuh tempo; log lokal `notifications-sent.jsonl` mencegah kirim ulang setelah ACK gagal atau restart. Seperti pengiriman eksternal lain, masih ada celah duplikasi jika proses mati tepat setelah WhatsApp menerima pesan tetapi sebelum log lokal tersimpan; pengiriman tidak diklaim exactly-once.

Pengujian lokal tanpa mengirim pesan nyata:

```bash
node --test scripts/*.test.mjs
node scripts/assistant-ui-qa.mjs
```

Uji UI memerlukan Vite di `http://127.0.0.1:5173` dan Chrome lokal; alamat dapat diganti dengan `QA_URL`, executable dengan `CHROME_PATH`. Di direktori `whatsapp-service`, jalankan `npm test` untuk menguji pengiriman dan pemulihan antrean dengan konektor palsu.

## Admin dan provisioning pengguna

Pendaftaran publik dinonaktifkan. Route `/register` diarahkan ke `/login`, sedangkan akun pengguna dibuat oleh admin melalui `/admin`. Operasi daftar, pembuatan, aktivasi/nonaktivasi, dan reset password berjalan di Netlify Function `admin-users`; Firebase Admin SDK tidak pernah dimuat ke browser.

### Environment variable Netlify

Tambahkan variabel server berikut melalui Netlify **Site configuration → Environment variables**. Jangan beri awalan `VITE_`:

```text
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
```

`FIREBASE_ADMIN_PRIVATE_KEY` boleh disimpan dengan karakter `\n`; function akan mengubahnya menjadi newline. Sebagai alternatif, tiga variabel `FIREBASE_ADMIN_*` dapat diganti dengan satu `FIREBASE_SERVICE_ACCOUNT_JSON` yang berisi JSON service account lengkap. Jangan pernah memasukkan nilai rahasia tersebut ke source code atau `.env.example`.

### Menghubungkan WhatsApp pengguna

Pengguna yang login membuka **Pengaturan > WhatsApp**, membuat kode pasangan, lalu mengirim kode itu sebagai satu pesan dari chat miliknya ke nomor WhatsApp Business FinanceMy. Kode berlaku 10 menit dan hanya dapat dipakai sekali. Backend menghubungkan ID chat dan nomor yang berhasil ditemukan ke satu UID; chat atau nomor yang sudah terhubung ke akun lain akan ditolak. Pengguna dapat memutuskan sambungan dari halaman yang sama.

Asisten WhatsApp bernama **Myoui**. Selain membuat draf transaksi teks dan foto struk, Myoui dapat membaca data FinanceMy, memberikan panduan budget harian, menyusun prioritas keuangan, dan menyimulasikan dampak rencana pengeluaran. Saran dan simulasi tidak mengubah data; transaksi tetap memerlukan konfirmasi `SUBMIT`.

Fungsi `whatsapp-link` membutuhkan variabel Netlify `WA_CONNECTOR_KEY` dengan nilai acak yang sama dengan variabel di `/etc/financemy-whatsapp.env` pada VPS. Simpan sebagai environment variable Netlify yang tersedia untuk **Functions**, tanpa awalan `VITE_`. Jangan masukkan kunci ke Git, URL, atau browser. Endpoint yang dipakai VPS adalah `https://myfinancemy.netlify.app/.netlify/functions/whatsapp-link`. Setelah mengubah variabel, lakukan deploy ulang Netlify dan restart `financemy-whatsapp.service`.

Dokumen `waPairingCodes`, `waPendingByUser`, `waConnections`, `waSenderLinks`, dan `waPhoneLinks` hanya diakses melalui Netlify Function dengan Firebase Admin SDK. Konektor menyimpan pesan dalam antrean lokal VPS sampai endpoint FinanceMy berhasil memprosesnya. Status pesan dan draf tersimpan di ruang data pengguna; foto struk hanya disimpan sementara di VPS lalu dihapus setelah pengiriman berhasil.

Saat membuat pengguna, admin mengisi email, username, dan password awal. Akun langsung aktif sehingga pengguna dapat login tanpa membuka email untuk mengatur password. Password dikirim langsung ke Firebase Authentication dan tidak pernah disimpan di Firestore. Fitur lupa/reset password melalui email tetap tersedia bila pengguna membutuhkannya.

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

## Aset merek

Aset visual siap pakai berada di `src/assets/`:

- `financemy-logo-mark.png` — logo mark transparan untuk aplikasi dan favicon.
- `financemy-logo-lockup.png` — logo horizontal transparan untuk materi promosi.
- `financemy-hero-3d.png` — ilustrasi hero aktif dengan gaya 3D premium dan latar transparan.
- `financemy-smart-capture.png` — ilustrasi smart capture aktif dengan gaya 3D premium dan latar transparan.
- `financemy-hero-3d-handcrafted.png` dan `financemy-smart-capture-handcrafted.png` — varian matte handcrafted yang tetap disimpan sebagai alternatif.

Social preview berada di `public/financemy-og.png`.

## Catatan keamanan

- Password hanya disimpan oleh Firebase Authentication, bukan Firestore.
- Semua data bisnis berada di `users/{uid}/...` dan rules memeriksa UID pemilik.
- Operasi saldo multi-dokumen menggunakan Firestore transaction.
- Rules memvalidasi nama, tipe, nominal, dan tipe transaksi pada koleksi inti.
- Client tetap harus menampilkan error Firebase dengan bahasa yang mudah dipahami.
