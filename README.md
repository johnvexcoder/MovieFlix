<div align="center">

# 🎬 MovieFlix

### **Self-Hosted, Private, Enterprise-Grade Media Streaming Platform**

An ultra-premium, private media streaming platform designed to bring an authentic Netflix-grade experience to your personal local and NAS storage.

[![Author](https://img.shields.io/badge/Author-John%20Vex%20Coder-red?style=for-the-badge&logo=github)](https://github.com/johnvexcoder)
[![Ko-Fi](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Ko--Fi-orange?style=for-the-badge&logo=kofi)](https://ko-fi.com/johnvexcoder)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle%20ORM-003B57?style=for-the-badge&logo=sqlite)](https://orm.drizzle.team)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com)

---

</div>

## 🌟 Overview

**MovieFlix** transforms your local media folders (HDD/SSD/NAS) into a polished, responsive streaming platform. It automatically scans your filesystem, parses filenames, fetches rich metadata & artwork from The Movie Database (TMDB), inspects file codecs using FFprobe, and delivers a modern streaming UI with multi-profile support, time-limited trial accounts, HTTP range streaming, and a full administrative command center.

---

## ✨ Key Features

### 🎆 1. Next-Gen Cinematic Startup Animation
- **3D Laser Ribbons:** Multi-layered, volumetric laser ribbons that weave together the iconic **"M"** monogram with specular sheen and anamorphic lens flares.
- **Hyperspace Prism Burst:** Explodes outward into 42 radial spectrum light beams with particle acceleration, shockwave rings, and perspective depth.
- **Web Audio "Ta-Dum" Synthesizer:** Multi-harmonic sub-bass impact, brass swells, and high-frequency sparkle synthesized purely via browser Web Audio API (zero external audio file dependencies).
- **Interactive Controls:** Toggle sound, skip with `Space` / `Escape`, or click anywhere to jump directly to profiles.

### 👥 2. Multi-Profile System & PIN Security
- **Multi-Profile Support:** Up to 5 customizable user profiles per account with independent watch history, continue watching progress, and preferences.
- **Rich Avatar Browser:** Extensive categorized emoji/icon picker with gradient backdrops and search.
- **PIN Lock Protection:** Optional 4-digit PIN access for private profiles featuring animated digit dials, auto-focus, and tactile error shaking.

### ⏱️ 3. Temporary / Trial Account Management
- **Time-Limited Accounts:** Admins can create guest or trial accounts with customizable durations (12h, 24h, 3 days, 7 days, or custom).
- **Live Countdown Meters:** Visual time-remaining progress meters and color-coded alert badges (<24h urgent warnings).
- **Automated Background Cleanup:** Background daemon runs every 5 minutes to automatically expire and clean up temporary accounts, profiles, and watch history upon duration end.

### 🔍 4. Automated Media Scanner & TMDB Metadata
- **Filesystem Indexer:** Scans configured local directory paths recursively for video files (`.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`, `.ts`, `.m4v`).
- **Filename Parser:** Intelligently extracts title, release year, season, and episode from common release naming conventions (e.g., `Inception (2010)`, `Breaking.Bad.S01E01`).
- **TMDB Integration:** Retrieves high-resolution posters, backdrops, plot synopses, cast, directors, release years, and maturity ratings.
- **FFprobe Inspection & Thumbnails:** Extracts audio/video codecs, bitrates, resolutions, and generates 25% preview thumbnail captures.

### 📺 5. TV Series Season & Episode Hierarchy
- **Structured Navigation:** Organized Season tabs with episode listings, runtime badges, episode summaries, and TMDB stills.
- **Next-Episode Countdown:** End-screen overlay that counts down to the next episode automatically.
- **Quick Episode Drawer:** Switch between episodes directly from within the video player without exiting.

### 🎥 6. Netflix-Grade Video Player
- **HTTP 206 Partial Content Range Streaming:** Fast seeking and bandwidth-efficient video delivery.
- **Smart Playback Resume:** Automatically saves playback position every 5 seconds and resumes seamlessly on your next session.
- **Custom Auto-Hiding HUD:** Overlays fade after 3.5s of inactivity; cursor hides automatically.
- **Full Player Controls:**
  - Fast seek (±10s) with animated rotation indicators (`J` / `L` or Arrow keys).
  - Variable playback speeds (0.75x, 1.0x, 1.25x, 1.5x, 2.0x).
  - Picture-in-Picture (PiP) mode (`P`).
  - Native Fullscreen (`F`).
  - Interactive Scrubber with timestamp preview tooltip and buffer bar.
  - Shortcut Cheatsheet overlay (`?`).

### 🛡️ 7. Admin Command Center (`/admin-panel`)
- **System Telemetry:** Real-time metrics for active accounts, expired accounts, total profiles, and server status.
- **Account Control:** 1-click duration extensions (+24h, +48h, +7d presets), password reset modals, and profile management.
- **Library Manager:** Directory mapping, content category assignment (Movies / TV Series), enable/disable switches, and manual scan triggers with live status feedback.
- **Platform Settings:** TMDB API key configuration, scanner interval tuning, session limits, trial policies, and administrator credentials.

---

## 🏗️ Architecture & Security

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                           │
│  • Startup Cinematic Intro Animation                        │
│  • Profile Selection & 4-Digit PIN Lock                     │
│  • Netflix Floating Navbar, Hero Spotlight & Content Rows   │
│  • Custom HUD Video Player (HTTP Range Stream & Resume)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                      Port 9000 (HTTP/HTTPS)
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  NEXT.JS 16 APP SERVER                      │
│                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐  │
│  │     API Routes        │      │   Services & Daemons   │  │
│  │ • /api/auth/*         │      │ • Media Scanner        │  │
│  │ • /api/media/*        │      │ • TMDB Metadata Fetch  │  │
│  │ • /api/media/stream   │      │ • FFprobe Inspector    │  │
│  │ • /api/admin/*        │      │ • Account Cleanup (5m) │  │
│  └───────────┬───────────┘      └───────────┬────────────┘  │
│              │                              │               │
│  ┌───────────▼──────────────────────────────▼────────────┐  │
│  │                  SQLite & Drizzle ORM                 │  │
│  │  (Admins, Accounts, Profiles, Media, History, Logs)   │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│              LOCAL STORAGE / NAS MEDIA VOLUMES              │
│       /media/movies/                /media/series/          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- **Frontend Library:** [React 19](https://react.dev)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com) & [shadcn/ui](https://ui.shadcn.com)
- **Animations:** [Framer Motion](https://www.framer.com/motion)
- **Database:** SQLite with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) & [Drizzle ORM](https://orm.drizzle.team)
- **Media Engine:** [FFmpeg](https://ffmpeg.org) & [FFprobe](https://ffmpeg.org/ffprobe.html) via `fluent-ffmpeg` & `ffmpeg-static`
- **Metadata Provider:** [The Movie Database (TMDB) API](https://www.themoviedb.org)
- **Authentication:** JWT Access/Refresh Tokens (`jose`), `bcryptjs` for PIN/password hashing

---

## 🚀 Quick Start

### Option 1: Native Node.js Run

#### 1. Prerequisites
- Node.js 20+ LTS
- npm or pnpm

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
*(Optional: Add your `TMDB_API_KEY` for automated metadata)*

#### 4. Seed Default Admin
```bash
npm run db:seed
```

#### 5. Start the Server
```bash
npm run dev
```
Open **`http://localhost:9000`** in your browser.

---

### Option 2: Docker Compose

Run MovieFlix isolated in Docker with persistent database and mounted media folders:

#### 1. Configure `docker-compose.yml`
Map your local media directories under `volumes`:
```yaml
volumes:
  - ./data:/app/data                        # Persistent SQLite database & thumbnails
  - /path/to/your/movies:/media/movies:ro   # Read-only movie storage
  - /path/to/your/series:/media/series:ro   # Read-only series storage
```

#### 2. Start Containers
```bash
docker compose up -d --build
```

#### 3. View Logs & Health
```bash
docker compose logs -f
curl http://localhost:9000/api/health
```

---

## 🔑 Default Credentials

- **Admin Panel URL:** `http://localhost:9000/admin-panel`
- **Default Username:** `admin`
- **Default Password:** `admin123`

*(You can change the admin credentials immediately inside **Admin Panel -> Settings**)*

---

## 📁 Recommended Media Folder Structure

```
/media/
├── movies/
│   ├── Inception (2010)/
│   │   └── Inception (2010).mp4
│   ├── Interstellar (2014).mkv
│   └── The Matrix (1999).mp4
└── series/
    └── Breaking Bad/
        ├── Season 1/
        │   ├── S01E01.mp4
        │   └── S01E02.mp4
        └── Season 2/
            ├── S02E01.mp4
            └── S02E02.mp4
```

---

## 👨‍💻 Author & Credits

- **Author:** **John Vex Coder**
- **GitHub:** [@johnvexcoder](https://github.com/johnvexcoder)
- **Support / Buy Me a Coffee:** [ko-fi.com/johnvexcoder](https://ko-fi.com/johnvexcoder)

---

## 📄 License

This project is built for personal and self-hosted media streaming. Enjoy your private home cinema!
