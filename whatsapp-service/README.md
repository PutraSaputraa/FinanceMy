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
