<div align="center">

# 🎵 Discord Lyrics Status

**Sinkronkan lirik Spotify secara real-time ke custom status Discord kamu**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue)](https://github.com/MMahesa/discord-lyrics)
[![GitHub](https://img.shields.io/badge/GitHub-MMahesa-black?logo=github)](https://github.com/MMahesa/discord-lyrics)

</div>

---

## ✨ Fitur

- 🎵 **Lirik real-time** — ditampilkan baris per baris mengikuti posisi lagu
- 💬 **Status Discord otomatis** — lirik langsung muncul di custom status kamu
- 🌐 **Web Dashboard** — tampilan visual di browser (`http://localhost:3000`)
- 🖥️ **Terminal UI** — box display langsung di terminal dengan progress bar
- 🎛️ **Menu mode saat startup** — pilih mode Terminal, Dashboard, atau keduanya
- 🎨 **Album art + genre** — metadata via iTunes API (tanpa API key)
- ⚡ **Rate-limit aware** — menghormati batas Discord API secara otomatis
- 🔄 **Lyrics cache** — meminimalkan request ke lrclib.net

---

## 📋 Prasyarat

| Kebutuhan | Versi |
|-----------|-------|
| OS | **Windows 10/11** (pakai SMTC untuk baca Spotify) |
| Node.js | **v18+** |
| Spotify | Desktop app yang sedang memutar musik |
| Discord | Akun aktif dengan token |

---

## 🚀 Instalasi

### 1. Clone repo

```bash
git clone https://github.com/MMahesa/discord-lyrics.git
cd discord-lyrics
```

### 2. Install dependencies

```bash
npm install
```

### 3. Konfigurasi `.env`

Salin file contoh lalu isi nilainya:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_USER_TOKEN=token_discord_kamu_disini
POLL_INTERVAL_MS=800
WEB_PORT=3000
```

### 4. Jalankan

```bash
npm start
```

Saat startup, kamu akan melihat **menu pilihan mode**:

```
? Pilih mode tampilan:
  ❯ Terminal + Dashboard (keduanya)
    Terminal saja
    Dashboard saja (buka browser otomatis)
```

---

## 🔑 Cara Mendapatkan Discord Token

> ⚠️ **Peringatan:** Discord User Token bersifat **sangat sensitif**. Jangan pernah share ke siapapun atau commit ke git. Token ini memberikan akses penuh ke akun kamu.

1. Buka **Discord** di browser (bukan aplikasi)
2. Tekan `F12` → buka tab **Network**
3. Filter request dengan kata `api`
4. Klik request ke `discord.com/api` manapun
5. Lihat tab **Headers** → cari `Authorization`
6. Salin nilai tersebut ke `DISCORD_USER_TOKEN` di file `.env`

---

## 🎛️ Mode Jalankan

Saat `npm start`, kamu akan ditanya mode tampilan:

| Mode | Deskripsi |
|------|-----------|
| **Terminal + Dashboard** | Tampilan di terminal dan web dashboard di browser |
| **Terminal saja** | Hanya box UI di terminal, web server tidak dijalankan |
| **Dashboard saja** | Web server aktif, browser dibuka otomatis, terminal minimal |

Mode juga bisa di-set permanen di `.env`:

```env
RUN_MODE=both        # Terminal + Dashboard
RUN_MODE=terminal    # Terminal saja
RUN_MODE=dashboard   # Dashboard saja
```

---

## 📁 Struktur Proyek

```
discord-lyrics/
├── src/
│   ├── index.js       # Entry point + loop utama + menu CLI
│   ├── spotify.js     # Baca media aktif via Windows SMTC (PowerShell)
│   ├── lyrics.js      # Fetch & parse lirik dari lrclib.net
│   ├── status.js      # Update custom status Discord
│   ├── dashboard.js   # Render terminal UI (chalk box)
│   ├── musicmeta.js   # Metadata lagu via iTunes API
│   └── webserver.js   # Express server + SSE + HTML dashboard
├── .env               # Konfigurasi lokal (tidak di-commit)
├── .env.example       # Template konfigurasi
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

---

## ⚙️ Konfigurasi Lengkap

| Variabel | Default | Deskripsi |
|----------|---------|-----------|
| `DISCORD_USER_TOKEN` | _(wajib)_ | Token akun Discord kamu |
| `POLL_INTERVAL_MS` | `800` | Interval cek Spotify (ms) |
| `WEB_PORT` | `3000` | Port web dashboard |
| `RUN_MODE` | _(tanya saat start)_ | `terminal`, `dashboard`, atau `both` |
| `DEBUG_POSITION` | `0` | Set `1` untuk debug posisi lirik |

---

## 🛠️ Troubleshooting

**Status tidak berubah di Discord?**
- Pastikan `DISCORD_USER_TOKEN` sudah benar
- Cek apakah Spotify sedang aktif memutar lagu (bukan pause)

**Lirik tidak muncul?**
- Tidak semua lagu ada di database lrclib.net
- Coba lagu yang lebih populer untuk test

**Dashboard tidak terbuka?**
- Buka manual: `http://localhost:3000`
- Pastikan port `3000` tidak dipakai aplikasi lain (ubah `WEB_PORT` jika perlu)

**Error PowerShell?**
- Pastikan kamu menggunakan Windows 10/11
- Jalankan sebagai user biasa (bukan Administrator)

---

## 📦 Dependencies

| Package | Versi | Kegunaan |
|---------|-------|----------|
| `axios` | ^1.7.7 | HTTP requests (Discord API, lyrics, metadata) |
| `chalk` | ^5.3.0 | Warna terminal |
| `dotenv` | ^16.4.5 | Load variabel dari `.env` |
| `express` | ^4.19.2 | Web dashboard server |

---

## ⚠️ Disclaimer

Proyek ini menggunakan **Discord User Token** (bukan Bot Token) untuk mengubah custom status. Penggunaan user token untuk otomatisasi melanggar [Terms of Service Discord](https://discord.com/terms). Gunakan dengan risiko sendiri. Project ini dibuat murni untuk keperluan pribadi dan edukasi.

---

## 📄 Lisensi

Didistribusikan di bawah **MIT License** — lihat file [LICENSE](LICENSE) untuk detail.

---

<div align="center">

Made by [mmahesa](https://github.com/MMahesa)

</div>
