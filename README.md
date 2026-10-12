# 🎨 Buku Mewarna

Game mewarna untuk anak — **self-hosted**, **tiada iklan**, jalan sepenuhnya dalam browser.
Satu container Docker (nginx + fail statik), tiada build step, tiada backend, tiada login.

Dibina sebagai alternatif kepada app "coloring page" di Play Store yang penuh iklan.

![preview](docs/preview.png)

## Ciri

- **Tekan untuk warnakan** (tap-to-fill) — 30 lukisan: haiwan, kenderaan, makanan, alam, robot, dino
- **12 mandala** dijana secara matematik (setiap satu corak berbeza)
- **Berus + pemadam** dengan slider saiz
- **24 warna** + color picker untuk warna sendiri
- **✨ Warna auto** — isi semua bahagian dengan warna rawak
- **Undo / redo** (butang ↶ ↷ atau Ctrl+Z / Ctrl+Shift+Z)
- **💾 Simpan** — muat turun PNG 1200×1200 + simpan dalam galeri dalam app (🖼️ Hasil Seni, 12 terakhir)
- **Bunyi "pop" ASMR** setiap kali warnakan (boleh tutup dengan 🔊)
- Sparkle effect pada setiap tap
- UI mesra anak: butang besar, warna cerah, sesuai untuk telefon & tablet

## Deploy sendiri

```bash
git clone https://github.com/Kengkorok/buku-mewarna.git
cd buku-mewarna
docker compose up -d --build
chmod -R a+rX site          # WAJIB: nginx dalam container tak boleh baca fail mode 600
```

Buka `http://<IP-server>:8450`.

Untuk akses dari luar rumah tanpa buka port ke internet, guna Tailscale:
`http://<hostname-tailnet>:8450`.

Tip untuk anak: buka di Chrome → menu ⋮ → **Add to Home screen** → jadi ikon macam app biasa.

## Struktur

```
buku-mewarna/
├── docker-compose.yml      # port 8450 -> 80, bind mount ./site
├── Dockerfile              # nginx:alpine + salinan site/
├── nginx.conf              # gzip + cache header
├── site/                   # app (statik, tiada build step)
│   ├── index.html
│   ├── style.css
│   ├── app.js              # logik: fill, brush, undo, magic, save, mandala
│   ├── pages.js            # 30 lukisan (dijana oleh tools/gen_pages.py)
│   └── manifest.webmanifest + icon.svg
└── tools/
    ├── gen_pages.py        # penjana lukisan (SVG, region-based)
    ├── contact_sheet.py    # render semua page jadi 1 PNG untuk semak art
    ├── verify_app.py       # ujian browser (playwright) — fill, brush, undo, save
    └── inspect_gallery.py  # debug layout galeri
```

## Cara lukisan berfungsi

Setiap lukisan ialah satu SVG 400×400. Semua bentuk yang boleh diwarnakan ada `class="r"`
(region) — app warnakan dengan set `fill` pada elemen itu (bukan flood-fill raster), jadi
warna sentiasa tajam tanpa "halo" putih pada garis.

- `class="r"` = region boleh warna (fill putih + garis hitam)
- `class="d"` = garisan hiasan (mata, misai, garisan roda) — tak boleh warna
- `class="f"` = titik hitam penuh

## Tambah / ubah lukisan

1. Edit `tools/gen_pages.py` — tambah fungsi yang pulangkan string SVG (guna helper `C()`, `E()`, `R()`, `P()`).
2. Daftarkan dalam senarai `PAGES` di bawah fail.
3. Jana semula + semak art:
   ```bash
   python3 tools/gen_pages.py            # tulis site/pages.js
   python3 tools/contact_sheet.py        # tulis sheet.png — tengok semua lukisan sekali
   chmod -R a+rX site
   ```
4. Refresh browser (bind mount — tak perlu rebuild).

Ubah `style.css` / `app.js` pun sama: edit → refresh. Rebuild image hanya perlu bila
ubah `Dockerfile` / `nginx.conf`:

```bash
docker compose up -d --build
```

## Ujian

```bash
pip3 install playwright && python3 -m playwright install chromium
python3 tools/verify_app.py
```

Skrip ini buka app dalam Chromium headless, tekan region, lukis dengan berus, undo/redo,
magic-fill, simpan (semak fail PNG turun + galeri dalam app), dan cetak JSON keputusan +
screenshot dalam `shots/`.

## Troubleshooting

| Masalah | Sebab / ubat |
|---|---|
| 403 Forbidden pada semua fail | Permission fail `600`. Betulkan: `chmod -R a+rX site` |
| Port 8450 dah dipakai | Tukar mapping dalam `docker-compose.yml` (`"8451:80"`) |
| Perubahan tak muncul | Browser cache — refresh / incognito |

## Lesen

MIT — lihat [LICENSE](LICENSE).
