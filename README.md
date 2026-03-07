<div align="center">
<img width="1200" height="475" alt="SoundStream Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🎵 SoundStream - Modern Music Player

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)

**SoundStream** adalah aplikasi pemutar musik modern berbasis web dan mobile yang memberikan pengalaman mendengarkan musik yang mulus, responsif, dan elegan.

</div>

---

## ✨ Fitur Utama

-   **🔍 Smart Search**: Cari lagu favorit Anda dengan cepat dan mudah.
-   **📂 Playlist Management**: Buat, edit, dan kelola playlist musik pribadi Anda dengan mudah.
-   **💾 Offline Downloads**: Unduh lagu favorit langsung ke perangkat Anda untuk didengarkan tanpa koneksi internet.
-   **📜 Smart Lyrics**: Fitur lirik yang terintegrasi (eksperimental).
-   **🎧 High Fidelity Player**: Kontrol penuh atas pemutaran musik (Shuffle, Repeat, Volume, Seek).
-   **📱 Cross-Platform**: Tersedia untuk Web (PWA) dan Android (via Capacitor).
-   **🕒 Playback History**: Secara otomatis menyimpan riwayat lagu yang telah Anda putar.

---

## 🛠️ Teknologi yang Digunakan

-   **Frontend**: React 19, TypeScript, Vite.
-   **Styling**: Tailwind CSS 4, Framer Motion (untuk animasi yang mulus), Lucide React (icons).
-   **Backend/Storage**: Express.js, Better-SQLite3 (untuk riwayat), LocalForage (untuk data browser).
-   **Mobile SDK**: Capacitor (untuk build Android).

---

## 🚀 Cara Instalasi & Menjalankan

### Prasyarat
-   [Node.js](https://nodejs.org/) (versi terbaru sangat disarankan)
-   [Git](https://git-scm.com/)

### Langkah-langkah

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/yanzyuyu/musicplayer-main.git
    cd musicplayer-main
    ```

2.  **Instal Dependensi:**
    ```bash
    npm install
    ```

3.  **Jalankan di Local:**
    ```bash
    npm run dev
    ```
    Aplikasi akan berjalan di `http://localhost:5173`.

---

## 📱 Build untuk Android

Aplikasi ini sudah mendukung build Android menggunakan Capacitor.

1.  **Build Proyek Web:**
    ```bash
    npm run build
    ```

2.  **Sync dengan Capacitor:**
    ```bash
    npx cap sync android
    ```

3.  **Buka di Android Studio:**
    ```bash
    npx cap open android
    ```
    Dari Android Studio, Anda bisa langsung menjalankan aplikasi di emulator atau perangkat fisik.

---

## 🏗️ Struktur Proyek

```text
├── android/            # File proyek Android (Capacitor)
├── public/             # Aset publik & PWA icons
├── src/
│   ├── App.tsx         # Komponen utama aplikasi
│   ├── main.tsx        # Entry point React
│   └── index.css       # Tailwind & styling global
├── server.ts           # Backend server (Express)
├── capacitor.config.ts # Konfigurasi Capacitor
└── vite.config.ts      # Konfigurasi Vite
```

---

## 📝 Lisensi

Distribusi bebas untuk tujuan pembelajaran. Pastikan mematuhi kebijakan penggunaan API SoundCloud/Gemini sesuai kebutuhan.

---

<div align="center">
Dibuat dengan ❤️ oleh <a href="https://github.com/yanzyuyu"><b>yanzyuyu</b></a>
</div>
