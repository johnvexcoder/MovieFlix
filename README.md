<div align="center">

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="120" height="120" fill="none">
  <defs>
    <linearGradient id="readmeMLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b20710" />
      <stop offset="40%" stop-color="#e50914" />
      <stop offset="100%" stop-color="#800208" />
    </linearGradient>
    <linearGradient id="readmeMRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#800208" />
      <stop offset="60%" stop-color="#e50914" />
      <stop offset="100%" stop-color="#ff3b47" />
    </linearGradient>
    <linearGradient id="readmeMDiag1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4d5a" />
      <stop offset="40%" stop-color="#e50914" />
      <stop offset="100%" stop-color="#7a0006" />
    </linearGradient>
    <linearGradient id="readmeMDiag2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff5964" />
      <stop offset="50%" stop-color="#e50914" />
      <stop offset="100%" stop-color="#6e0005" />
    </linearGradient>
    <filter id="readmeMShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="-2" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>
  <path d="M 32 216 L 32 24 C 32 20, 36 16, 42 16 L 70 16 C 76 16, 80 20, 80 24 L 80 216 C 80 220, 76 224, 70 224 L 42 224 C 36 224, 32 220, 32 216 Z" fill="url(#readmeMLeft)" />
  <path d="M 160 216 L 160 24 C 160 20, 164 16, 170 16 L 198 16 C 204 16, 208 20, 208 24 L 208 216 C 208 220, 204 224, 198 224 L 170 224 C 164 224, 160 220, 160 216 Z" fill="url(#readmeMRight)" />
  <path d="M 40 18 L 78 18 L 132 168 L 94 168 Z" fill="url(#readmeMDiag1)" filter="url(#readmeMShadow)" />
  <path d="M 108 168 L 146 168 L 200 18 L 162 18 Z" fill="url(#readmeMDiag2)" filter="url(#readmeMShadow)" />
</svg>

# MovieFlix

**Self-Hosted, Private Media Streaming Platform**

An enterprise-grade media streaming server and client designed to deliver an authentic Netflix-inspired streaming experience from local and networked storage (NAS / HDD).

[![Author](https://img.shields.io/badge/Author-John%20Vex%20Coder-red?style=for-the-badge&logo=github)](https://github.com/johnvexcoder)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Ko--Fi-orange?style=for-the-badge&logo=kofi)](https://ko-fi.com/johnvexcoder)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle%20ORM-003B57?style=for-the-badge&logo=sqlite)](https://orm.drizzle.team)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com)

---

</div>

## Overview

MovieFlix indexes local media directories into an organized, responsive streaming platform. The system inspects media files using FFprobe, extracts metadata and high-resolution artwork via The Movie Database (TMDB) API, and serves video streams via HTTP 206 Partial Content range requests.

The interface includes a Web Audio startup intro animation, multi-profile user management with optional 4-digit PIN access, temporary guest accounts with automated background cleanup, and an administrative command center for library monitoring and system configuration.

---

## Core Capabilities

### 1. Cinematic Startup Animation
- **3D Laser Ribbons:** Multi-layered, gradient-shaded laser ribbons forming the MovieFlix "M" monogram with specular highlights.
- **Hyperspace Light Burst:** 42 radial spectrum light beams with particle acceleration, shockwave rings, and optical dispersion.
- **Synthesized Audio:** Multi-harmonic sub-bass impact, brass swells, and high-frequency shimmer synthesized in real-time using the browser Web Audio API with zero external audio assets.
- **Controls:** Sound toggle, click-to-skip, or keyboard shortcuts (`Space` / `Escape`).

### 2. Multi-Profile Management and Security
- **Profile Architecture:** Up to 5 customizable user profiles per account with independent watch history and preferences.
- **Avatar Browser:** Categorized emoji and avatar icon browser with search capabilities.
- **PIN Lock Protection:** Optional 4-digit PIN security with animated digit dials, auto-focus, and input validation.

### 3. Temporary and Trial Account Lifecycle
- **Configurable Durations:** Admin provisioning of time-limited accounts (12 hours, 24 hours, 3 days, 7 days, or custom durations).
- **Time Remaining Meters:** Visual time-remaining indicators with color-coded status alerts.
- **Automated Daemon Cleanup:** Periodic background service executing every 5 minutes to identify expired accounts and purge associated profiles and watch data.

### 4. Automated Media Scanning and Metadata
- **Filesystem Indexing:** Recursive directory scanning supporting `.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`, and `.ts` files.
- **Filename Parser:** Pattern matching for titles, release years, seasons, and episodes.
- **TMDB Integration:** Automated retrieval of synopses, cast, directors, genres, release dates, maturity ratings, posters, backdrops, and episode stills.
- **Media Probing:** FFprobe inspection of video/audio codecs, bitrates, dimensions, and automated 25% duration thumbnail extraction.

### 5. Television Series Structure
- **Hierarchy:** Season-by-season tabbed navigation with episode lists, stills, and descriptions.
- **Auto-Play Progression:** Automated countdown overlay leading into the next episode.
- **In-Player Episode Selector:** Switch episodes without leaving the active playback session.

### 6. Video Player and Streaming Engine
- **HTTP 206 Range Streaming:** Low-latency byte-range delivery supporting random seeking.
- **Smart Progress Resume:** Periodic watch progress synchronization (every 5 seconds) allowing instant playback resumption.
- **Custom Player HUD:** Auto-hiding control bar (3.5s inactivity timeout) with cursor concealment.
- **Controls and Shortcuts:**
  - Fast seek (`±10s`) via `J` / `L` or Arrow keys.
  - Playback rate adjustment (`0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`).
  - Native Fullscreen (`F`) and Picture-in-Picture (`P`).
  - Interactive scrubber with buffer tracker and hover timestamp tooltips.
  - Shortcut cheatsheet (`?`).

### 7. Administration Command Center (`/admin-panel`)
- **System Telemetry:** Real-time metrics for active accounts, expired accounts, total profiles, and server health.
- **Account Control:** 1-click duration extensions (+24h, +48h, +7d), credential resets, and account deletion.
- **Library Configuration:** Directory mapping, content category assignment (Movies / TV Series), enable/disable toggles, and manual scan triggers.
- **Settings Management:** TMDB API key configuration, scanner interval tuning, session limits, and administrator credentials.

---

## System Architecture

```
+-------------------------------------------------------------------+
|                        CLIENT BROWSER                             |
|  - Startup Intro Animation (Web Audio API Synthesizer)            |
|  - Profile Selector with 4-Digit PIN Authentication               |
|  - Floating Navbar, Hero Spotlight & Content Carousels            |
|  - Custom Video Player (HTTP 206 Range Streaming & Resume)        |
+---------------------------------+---------------------------------+
                                  |
                           Port 9000 (HTTP)
                                  |
+---------------------------------v---------------------------------+
|                      NEXT.JS 16 APP SERVER                        |
|                                                                   |
|  +------------------------------+  +---------------------------+  |
|  |         API Routes           |  |    Services & Daemons     |  |
|  |  /api/auth/*                 |  |  Media Scanner            |  |
|  |  /api/media/*                |  |  TMDB Metadata Service    |  |
|  |  /api/media/[id]/stream      |  |  FFprobe Inspector        |  |
|  |  /api/admin/*                |  |  Account Cleanup Daemon   |  |
|  +--------------+---------------+  +-------------+-------------+  |
|                 |                                |                |
|  +--------------v--------------------------------v-------------+  |
|  |                    SQLite (Drizzle ORM)                     |  |
|  |  Admins | Accounts | Profiles | Media | WatchHistory | Logs |  |
|  +-------------------------------------------------------------+  |
+---------------------------------+---------------------------------+
                                  |
+---------------------------------v---------------------------------+
|                   LOCAL / NAS MEDIA VOLUMES                       |
|           /media/movies/                /media/series/            |
+-------------------------------------------------------------------+
```

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI & Components:** React 19, Tailwind CSS 4, shadcn/ui
- **Motion & Transitions:** Framer Motion
- **Database:** SQLite with better-sqlite3 and Drizzle ORM
- **Media Processing:** FFmpeg and FFprobe via fluent-ffmpeg & ffmpeg-static
- **Metadata Provider:** The Movie Database (TMDB) API
- **Security:** JWT Access/Refresh Tokens (`jose`), `bcryptjs` password/PIN hashing

---

## Getting Started

### Method 1: Local Installation

#### 1. Requirements
- Node.js 20+ LTS
- npm or pnpm

#### 2. Installation
```bash
npm install
```

#### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

#### 4. Database Initialization
```bash
npm run db:seed
```

#### 5. Start Application
```bash
npm run dev
```
Navigate to `http://localhost:9000`.

---

### Method 2: Docker Compose

Deploy the application within an isolated Docker container with persistent volumes for database records and media files:

#### 1. Directory Mapping in `docker-compose.yml`
```yaml
volumes:
  - ./data:/app/data                        # Persistent SQLite database and thumbnails
  - /path/to/your/movies:/media/movies:ro   # Read-only movie directory
  - /path/to/your/series:/media/series:ro   # Read-only series directory
```

#### 2. Start Services
```bash
docker compose up -d --build
```

#### 3. Inspection and Health
```bash
docker compose logs -f
curl http://localhost:9000/api/health
```

---

## Default Credentials

- **Admin Panel URL:** `http://localhost:9000/admin-panel`
- **Default Username:** `admin`
- **Default Password:** `admin123`

*Administrator credentials can be updated inside Admin Panel -> Settings.*

---

## Media Directory Structure

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

## Author and Credits

- **Author:** **John Vex Coder**
- **GitHub:** [https://github.com/johnvexcoder](https://github.com/johnvexcoder)
- **Support / Buy Me a Coffee:** [https://ko-fi.com/johnvexcoder](https://ko-fi.com/johnvexcoder)

---

## License

This project is open-source and intended for self-hosted, personal media streaming environments.
