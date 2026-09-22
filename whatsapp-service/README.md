# FinanceMy WhatsApp service

Layanan ini menghubungkan satu nomor WhatsApp Business lewat QR dan menyimpan pesan pribadi yang baru masuk ke antrean lokal di VPS. Belum ada panggilan Kenari, pencocokan akun FinanceMy, atau penulisan transaksi ke Firebase.

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

Sesi login dan antrean `inbox.jsonl` disimpan di `~/.local/share/financemy-whatsapp` dengan izin hanya untuk pengguna pemilik. Antrean menyimpan ID pesan untuk mencegah duplikasi, ID pengirim, nomor telepon jika berhasil ditemukan, jenis, teks, dan waktu. Nomor `@lid` tidak ditafsirkan sebagai nomor telepon. Pesan tetap berstatus `unassigned` sampai akun pengguna diverifikasi dan dicocokkan.

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
WA_CONNECTOR_KEY=<kunci-acak-yang-sama-dengan-Netlify>
```

Atur `WA_CONNECTOR_KEY` yang sama pada environment Netlify untuk **Functions**, bukan di `netlify.toml` atau kode frontend. Setelah mengubah environment, deploy ulang fungsi Netlify dan restart layanan VPS. Jangan bagikan nilai kunci di chat atau commit ke Git.
