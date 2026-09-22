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

Simpan `KENARI_API_KEY` sebagai secret pada environment Netlify konteks Production. Model bawaan untuk tahap awal adalah `step-3-7-flash:free`; model lain dapat dipilih lewat `KENARI_MODEL`. Setelah secret tersimpan, deploy ulang fungsi. Pesan keuangan akan muncul sebagai draf di **Pengaturan > WhatsApp**. Pengguna memilih akun sumber dana, memeriksa nominal, kategori, tanggal, dan budget, lalu menekan **Catat transaksi**. Saldo baru berubah pada saat itu.
