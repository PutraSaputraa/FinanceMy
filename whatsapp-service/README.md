# FinanceMy WhatsApp service

Layanan ini menghubungkan satu nomor WhatsApp Business lewat QR, menyimpan pesan pribadi ke antrean lokal di VPS, lalu meneruskan pesan teks ke FinanceMy. Fungsi server Netlify mencocokkan pengirim dengan akun yang sudah dipasangkan, meminta Kenari mengubah pesan ke draf, dan menunggu pengguna memeriksa draf sebelum mencatat transaksi.

## Menjalankan di VPS

Jalankan sebagai pengguna biasa (`financemy`), bukan `root`:

```bash
cd ~/financemy-whatsapp
sudo apt-get install -y unzip
npm ci
npx puppeteer browsers install chrome
sudo env PUPPETEER_CACHE_DIR="$HOME/.cache/puppeteer" ./node_modules/.bin/puppeteer browsers install chrome --install-deps
npm start
```

Scan QR dari **WhatsApp Business > Perangkat tertaut > Tautkan perangkat**. Setelah muncul `WhatsApp siap menerima pesan`, kirim pesan uji dari nomor lain. Terminal hanya menampilkan status penyimpanan, tanpa isi pesan. Pesan grup dan status tidak disimpan.

Sesi login dan antrean `inbox.jsonl` disimpan di `~/.local/share/financemy-whatsapp` dengan izin hanya untuk pengguna pemilik. Antrean menyimpan ID pesan untuk mencegah duplikasi, ID pengirim, nomor telepon jika berhasil ditemukan, jenis, teks, dan waktu. Nomor `@lid` tidak ditafsirkan sebagai nomor telepon. ID pesan yang telah diteruskan disimpan di `delivered.jsonl`, sehingga pengiriman ulang sesudah restart tidak membuat draf ganda.

## Menjalankan terus-menerus

Setelah login QR berhasil, hentikan `npm start` dengan **Ctrl+C**. Salin `deploy/financemy-whatsapp.service` ke `/etc/systemd/system/`, lalu jalankan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now financemy-whatsapp.service
systemctl status financemy-whatsapp.service
journalctl -u financemy-whatsapp.service -n 30 --no-pager
```

Layanan berjalan sebagai `financemy` dan memakai sesi QR yang sama. Jika sesi kedaluwarsa, layanan berhenti dan perlu dipindai ulang secara interaktif. Folder sesi dan antrean berisi data sensitif; jangan unggah atau bagikan isinya.

## Menghubungkan chat ke akun

Pengguna login ke FinanceMy, buka **Pengaturan > WhatsApp**, buat kode sekali pakai, lalu kirim kode itu sebagai satu pesan dari chat miliknya ke nomor WhatsApp Business FinanceMy. Pesan kode tidak disimpan sebagai transaksi. Kode berlaku 10 menit dan hanya dapat digunakan sekali. Satu chat dan satu nomor hanya dapat terhubung ke satu akun.

Konektor perlu dua variabel di `/etc/financemy-whatsapp.env` (izin `0600`, pemilik `root`):

```ini
WA_PAIRING_ENDPOINT=https://myfinancemy.netlify.app/.netlify/functions/whatsapp-link
WA_INGEST_ENDPOINT=https://myfinancemy.netlify.app/.netlify/functions/whatsapp-message
WA_CONNECTOR_KEY=<kunci-acak-yang-sama-dengan-Netlify>
```

Atur `WA_CONNECTOR_KEY` yang sama pada environment Netlify untuk **Functions**, bukan di `netlify.toml` atau kode frontend. Setelah mengubah environment, deploy ulang fungsi Netlify dan restart layanan VPS. Jangan bagikan nilai kunci di chat atau commit ke Git.

Simpan `KENARI_API_KEY` sebagai secret pada environment Netlify konteks Production. Model bawaan untuk tahap awal adalah `step-3-7-flash:free`; model lain dapat dipilih lewat `KENARI_MODEL`. Setelah secret tersimpan, deploy ulang fungsi. Pesan keuangan dibalas sebagai draf di chat dan juga terlihat di **Pengaturan > WhatsApp**. Pengguna dapat membalas `REVISI akun BCA`, `REVISI nominal 30000`, `SUBMIT`, atau `BATAL`. Hanya satu draf aktif per akun di chat; draf lain tetap bisa ditinjau di web. `SUBMIT` hanya diterima bila nama, nominal, tanggal, dan akun sumber dana jelas. Saldo baru berubah setelah `SUBMIT` atau pengguna menekan **Catat transaksi** di web.

## Pengingat dan ringkasan bulanan

Konektor juga memeriksa `whatsapp-notifications` setiap menit setelah WhatsApp siap. Endpoint otomatis memakai origin dan direktori yang sama dengan `WA_INGEST_ENDPOINT`. Untuk alamat khusus, isi `WA_NOTIFICATION_ENDPOINT` dengan URL HTTPS. Kunci `WA_CONNECTOR_KEY` tetap sama.

Deploy fungsi Netlify terbaru sebelum memperbarui/restart konektor. Pengguna mengaktifkan ringkasan bulanan dan/atau pengingat rutin melalui **Pengaturan > WhatsApp**; keduanya nonaktif secara bawaan. Pesan dikirim mulai 09.00 sampai sebelum 21.00 WIB. Ringkasan bulan sebelumnya tersedia tanggal 1–3, sementara pengingat rutin mengikuti H-7/H-3/hari H yang dipilih pengguna.

Status pengiriman disimpan di Firestore dengan lease lima menit dan di `notifications-sent.jsonl` pada direktori sesi VPS (izin `0600`). Pertahankan file itu saat memperbarui layanan. Pesan yang sudah masuk log tidak dikirim ulang walaupun ACK ke Netlify gagal atau layanan restart. Jika proses mati persis sesudah WhatsApp menerima pesan sebelum log disimpan, masih mungkin terjadi duplikasi; protokol ini tidak menjamin exactly-once. Jangan menjalankan dua konektor untuk sesi WhatsApp yang sama.

Balasan `detail` menampilkan rincian laporan terakhir tanpa mengubah atau menghapus draf transaksi. Semua uji di `npm test` menggunakan pengiriman palsu dan tidak menghubungi WhatsApp nyata.
