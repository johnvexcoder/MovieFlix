<div align="center">

<img src="public/logo.svg" width="110" height="110" alt="MovieFlix Logo" />

# MovieFlix

**Self-Hosted, Private Media Streaming Platform**

An enterprise-grade media streaming server and client delivering an authentic Netflix-inspired experience from your own local and networked storage (NAS / HDD). Index, enrich, protect, and stream your movie and TV library — all under your control.

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle-003B57?style=for-the-badge&logo=sqlite)](https://orm.drizzle.team)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=for-the-badge&logo=redis)](https://redis.io)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-Transcode-007808?style=for-the-badge&logo=ffmpeg)](https://ffmpeg.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com)
[![Version](https://img.shields.io/badge/Release-v1.0.0-E50914?style=for-the-badge&logo=github)](https://github.com/johnvexcoder/MovieFlix/releases)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge&logo=gnu)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [What's New in v1.0.0](#whats-new-in-v100)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Media Directory Structure](#media-directory-structure)
- [Maintenance & Operations](#maintenance--operations)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)
- [Default Credentials](#default-credentials)
- [Contributing](#contributing)
- [Author & Credits](#author--credits)
- [License](#license)

---

## Overview

MovieFlix scans your local media directories and turns them into an organized, responsive streaming platform. It probes every file with **FFprobe**, enriches titles with rich artwork and metadata from **The Movie Database (TMDB)**, and streams video over **HTTP 206 partial-content** requests with support for transcoding, subtitles, and download protection.

The platform includes a cinematic Web Audio startup intro, multi-profile management with optional 4-digit PIN locking, time-limited trial accounts with automated cleanup, and a full administrative command center.

---

## What's New in v1.0.0

This is the first tagged release. Highlights of everything that has landed since the project took shape:

**Deployment & Docker**
- **Two-mode Docker installer** (`./install.sh`) — pick **Update only** (keep data + settings, fastest) or **Complete wipeout** (fresh installation that erases and rebuilds everything). Both run on Docker Compose; the wipeout mode safely deletes root-owned `./data` (database, uploads) through a throwaway container.
- **Auto-generated secrets** — running the installer creates a `.env` with brand-new 48-char JWT secrets and sensible defaults, no manual setup required.
- **Low-RAM builds** — standalone Next.js output with bounded Node heaps, memory-capped containers, and a RAM+swap check that warns before the compiler freezes the host.
- SMTP, public URL, and subnet settings are now forwarded through Compose so emails/links work out of the box.

**Email & Notifications**
- **Branded email suite** — every transactional email (welcome, password reset, forgot-password, contact replies, broadcasts) carries the MovieFlix **"M" logo** (embedded as an inline data-URI so it always renders) and the correct support address `movieflix.support@gmail.com`.
- **Passwords are sent in the email** — the welcome email shows the set password and reset emails show the new one, so users can log in immediately instead of waiting for credentials.
- **Contact form auto-reply** — submitting a report / suggestion / request instantly emails the user a "we received it" confirmation.
- **Admin Broadcast Email** — one click to email *every* user or a single user, each greeted by name.

**Player**
- **Play Now autoplay** — tapping Play Now starts playback immediately (muted start that auto-unmutes when the browser allows), no second click.
- **Zoom-to-Fit playback** — video fills the whole screen (`object-cover`), removing the letterbox bars on laptops/PCs and pillarbox bars on phones.
- **Accurate byte-range seeking** — both the stream and transcode routes honor the requested byte offset, fixing stalls when seeking around in long files.

**Admin Panel**
- Active/Offline account badges plus last-connection **IP & location** in the account list.
- **Payment submissions** with one-click **Approve / Reject** (approval can also extend the account duration).
- Fully **responsive on mobile** — manage everything from a phone or tablet.

**Accounts & Sessions**
- Robust session model: multiple concurrent sessions per account (configurable), profile single-session **kick protection**, idle timeouts, and optional same-`/24` subnet enforcement.
- **Auto-initialized database** — on first boot the app creates all tables and the default `admin` account itself; no manual seeding needed.

---

## Features

### Player & Streaming
- **HTTP 206 Range Streaming** — low-latency byte-range delivery with download protection (chunk caps + integrity headers). Both the stream and transcode routes honor the requested byte offset, so seeking is always accurate.
- **Play Now Autoplay** — one-tap play starts the video instantly; on navigation-restricted browsers it starts muted and auto-unmutes when allowed.
- **Zoom-to-Fit Playback** — video fills the screen with no letterbox/pillarbox bars on any device.
- **Adaptive Quality** — user-selectable transcoded renditions (360p → 4K), produced on demand with FFmpeg and cached to disk.
- **Subtitles** — automatic detection of local `.srt` / `.vtt` files adjacent to your media, served with SRT→VTT conversion and an in-player CC menu.
- **Error Recovery** — automatic reload-and-resume on playback errors or stalls, with a manual retry overlay as a fallback.
- **Smart Resume** — watch position synced every 5 seconds; tap resume exactly where you left off.

### Media Library & Metadata
- **Automated Media Scanning** — recursive directory indexing for `.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`, and `.ts`.
- **Smart Filename Parsing** — extracts titles, release years, seasons, and episodes from file names.
- **TMDB Metadata** — synopses, genres, ratings, maturity ratings, posters, backdrops, and episode stills.
- **Local Artwork Fallback** — a matching `poster.jpg` / `folder.jpg` / `backdrop.jpg` next to your video is used automatically before falling back to TMDB.

### Profiles & Accounts
- **Multi-Profile Accounts** — up to 5 profiles per account with independent watch history and preferences.
- **PIN Lock** — optional 4-digit PIN protection with animated input.
- **Trial & Temporary Accounts** — configurable durations with automated cleanup daemon.
- **Account Locking** — admins can lock/unlock accounts and enforce it on every auth path.
- **Session Management** — multiple concurrent sessions per account (configurable), single-session kick protection for profiles, idle timeouts, and optional `SESSION_STRICT_SUBNET` enforcement. Browsing the profile selector never kicks an active session.
- **Active / Offline Badges** — admins see which accounts are active, expired, or offline at a glance.

### Administration (`/admin-panel`)
- Real-time system telemetry (accounts, profiles, server health).
- Account list with **Active/Offline/Expired** status and last-connection **IP & location**.
- **Payment submissions** with one-click **Approve / Reject** (approval can extend the account duration).
- **Broadcast Email** — send an email to every user or a single user instantly, each greeted by name.
- One-click duration extensions, credential resets, and account deletion; fully responsive on mobile.
- Library path mapping with Movies/TV category assignment and manual scan triggers.
- Settings: TMDB key, scanner intervals, session limits, SMTP, and admin credentials.

### Email & Notifications
- **Branded emails** — the MovieFlix **"M" logo** (inline, reliably rendered) and the real support address `movieflix.support@gmail.com` in every message.
- **Credentials included** — welcome emails show the set password; reset emails show the new one.
- **Contact auto-reply** — reports/suggestions/requests get an immediate confirmation email.
- Forgot-password reset links (valid 1 hour), password-change notifications, and expiry reminders.

---

## System Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                     CLIENT BROWSER                                                 |
|   Startup Intro · Profile Selector · PIN Auth · Navbar · Hero · Carousels · Custom Video Player   |
+----------------------------------------------+----------------------------------------------------+
                                               |
                                       Port 9000 (HTTP)
                                               |
+----------------------------------------------v----------------------------------------------------+
|                                    NEXT.JS 16 (APP SERVER)                                          |
|                                                                                                    |
|   +-----------------------------+        +-----------------------------+                          |
|   |   API Routes                |        |   Services & Background     |                          |
|   | /api/auth/*   auth/JWT      |        |  Media Scanner (cron)       |                          |
|   | /api/media/*  library/home  |        |  TMDB Metadata Service     |                          |
|   | /api/media/[id]/stream      |        |  FFprobe Inspector         |                          |
|   | /api/media/[id]/transcode   |        |  Transcode Worker          |                          |
|   | /api/media/[id]/subtitles   |        |  Account Cleanup Daemon    |                          |
|   | /api/media/[id]/image       |        |  Expiry Reminder / Email   |                          |
|   | /api/reminder  settings     |        +-------------+--------------+                          |
|   +-------------+---------------+                      |                                           |
|                 |                                      |                                           |
|   +-------------v--------------------------------------v---------------------------------------+   |
|   |   Persistence                                                 | Media Processing                |   |
|   |   SQLite (Drizzle ORM)     Admins/Accounts/Profiles/Media/... | FFmpeg/FFprobe (transcode,      |   |
|   |   Redis (sessions/cache)                                      | thumbnails, probes)             |   |
|   +---------------------------------------------------------------+--------------------------------+   |
+---------------------------------------------------------------------------------------------------+
                                               |
                                               | Read-only mounts
                                               |
+----------------------------------------------v----------------------------------------------------+
|                              LOCAL / NAS MEDIA VOLUMES                                               |
|                    /media/movies        /media/series                                                 |
+---------------------------------------------------------------------------------------------------+
```

### Data Flow

1. **Scan** — the media scanner walks configured library paths, parses filenames, probes files with FFprobe, and fetches metadata from TMDB.
2. **Index** — results are stored in SQLite; posters/backdrops use local files when present.
3. **Browse** — the client loads carousels from `/api/media` including per-profile watch progress.
4. **Stream** — the player requests byte-range chunks from `/api/media/[id]/stream`; lower qualities are transcoded on demand via `/api/media/[id]/transcode`.
5. **Protect** — all streams and images are auth-gated, range-restricted, and capped to prevent unauthorized bulk downloads.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, shadcn/ui + Base UI |
| Motion | Framer Motion |
| Database | SQLite (better-sqlite3) with Drizzle ORM |
| Cache / Sessions | Redis (ioredis) |
| Media Processing | FFmpeg / FFprobe (fluent-ffmpeg, ffmpeg-static) |
| Metadata | The Movie Database (TMDB) API |
| Auth | JWT Access/Refresh (`jose`), `bcryptjs` password/PIN hashing |
| Email | Nodemailer (SMTP — Gmail app passwords) |

---

## Quick Start

### Option A — Docker Compose (recommended)

Requirements: **Docker** + **Docker Compose v2**, and a valid **TMDB API key** (free at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)). The host should have at least **3 GB of ram+swap** for the Docker build (see Troubleshooting).

**1. Using the installer (easiest):**

```bash
git clone https://github.com/johnvexcoder/MovieFlix.git
cd MovieFlix
./install.sh
```

You get a menu with two modes:

| Mode | What it does |
|------|--------------|
| **1) Update only** | Pulls latest code, rebuilds the image, restarts. Keeps `./data` and `.env`. |
| **2) Complete wipeout** | **Fresh installation** — removes containers, volumes, `./data` (database, accounts, uploads), resets the repo to `origin/main`, and regenerates `.env` with brand-new secrets. |

The installer auto-generates a `.env` with secure random JWT secrets, checks for Docker/Compose/git, warns about low RAM+swap, and handles root-owned data files safely. Edit `.env` afterwards to set `APP_PUBLIC_URL`, `TMDB_API_KEY`, and `SMTP_*`.

**2. Manually (equivalent):**

```bash
git clone https://github.com/johnvexcoder/MovieFlix.git
cd MovieFlix
# Configure environment variables used by docker-compose.yml
export TMDB_API_KEY=your_tmdb_api_key
export JWT_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
```

3. **Point the mounts at your media** — edit the `volumes:` block in `docker-compose.yml`:
   ```yaml
   volumes:
     - ./data:/app/data                                  # Persistent SQLite + thumbnails
     - /path/to/your/movies:/media/movies:ro             # Read-only movie library
     - /path/to/your/series:/media/series:ro             # Read-only series library
   ```

4. **Build & start:**
   ```bash
   docker compose up -d --build
   ```

5. **Verify:**
   ```bash
   docker compose ps
   curl http://localhost:9000/api/health
   ```
   Then open **http://localhost:9000**.

### Option B — Local Development

Requirements: **Node.js 22+**, npm, and a running **Redis** instance (or use Docker for just Redis).

```bash
npm install
cp .env.example .env.local     # then edit values
npm run dev                    # starts server on :9000; DB + default admin are created automatically
```

Scripts:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server on `:9000` |
| `npm run build` | Build for production |
| `npm run start` | Start the production build |
| `npm run typecheck` | Run the TypeScript type checker |
| `npm run lint` | Run ESLint |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:generate` / `db:migrate` / `db:push` | Drizzle migrations |

---

## Environment Configuration

Full reference (see [.env.example](.env.example)):

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | Main app port | `9000` |
| `DATABASE_PATH` | SQLite database file path | `./data/database.sqlite` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets (use long random strings) | *(required)* |
| `TMDB_API_KEY` | Movie Database API key | *(required for metadata)* |
| `APP_PUBLIC_URL` | Public URL used for links inside emails | `http://localhost:9000` |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Outbound email settings (forwarded through Compose) | *(empty = emails skipped)* |
| `SESSION_STRICT_SUBNET` | Restrict sessions to the same `/24` subnet (`0` off, `1` on) | `0` |
| `MEDIA_MOVIES_PATH` / `MEDIA_SERIES_PATH` | Library mount paths | `/media/movies`, `/media/series` |
| `FFMPEG_PATH` | Path to the ffmpeg binary | `ffmpeg` |
| `TRANSCODE_TEMP_DIR` | Where transcoded renditions are cached | `./data/transcode-temp` |
| `TRANSCODE_MAX_CONCURRENT` | Max simultaneous transcodes | `2` |
| `SCAN_INTERVAL_MINUTES` | Auto-scan interval | `10` |
| `SCAN_ON_STARTUP` | Scan when the app boots | `true` |
| `TRIAL_*` | Trial account durations, cleanup, and reminders | — |
| `MAX_CONCURRENT_SESSIONS` | Sessions allowed per account | `3` |
| `ADMIN_ALLOWED_IPS` | CIDR allow-list for the admin panel | — |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Outbound email (notifications/reset) | — |

> **Security:** always set strong, unique `JWT_SECRET` and `JWT_REFRESH_SECRET` values — never ship the defaults.

---

## Media Directory Structure

MovieFlix auto-discovers content recursively. **Movies** are parsed as single titles; **series** are organized by season and episode. Name files so the title, year, season, and episode are extractable, and drop artwork/subtitles next to the video for automatic pickup.

```
/media
├── movies/
│   ├── Inception (2010)/
│   │   ├── Inception (2010).mp4
│   │   └── poster.jpg                 ← optional local artwork (auto-used)
│   ├── Interstellar (2014).mkv
│   └── The Matrix (1999).mp4
└── series/
    └── Breaking Bad/
        ├── Season 1/
        │   ├── Breaking Bad - S01E01.mp4
        │   ├── Breaking Bad - S01E01.en.srt   ← optional subtitle
        │   └── Breaking Bad - S01E02.mp4
        └── Season 2/
            └── Breaking Bad - S02E01.mp4
```

### Naming Conventions

| Type | Example | How it's parsed |
|------|---------|-----------------|
| Movie | `Inception (2010).mp4` | Title + year |
| Episode | `Breaking Bad - S01E02` | Series + season `01` + episode `02` |
| Quality tag | `Movie 1080p.mkv` | Optional extra metadata |

### Supported Formats

- **Video:** `.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`, `.ts`
- **Artwork:** `poster.jpg/.png/.webp`, `folder.jpg`, `backdrop.jpg`, `fanart.jpg`, or `<movie-name>.jpg`
- **Subtitles:** `.srt`, `.vtt` (place alongside the video, optional `en`/`english` language tag, e.g. `Movie.en.srt`)

> If a media file requires transcoding (e.g. a codec browsers can't play natively), MovieFlix flags it and can produce an H.264/AAC rendition on demand.

---

## Maintenance & Operations

### Data & Persistence
- **Database:** SQLite file at `./data/database.sqlite` — back it up regularly (see below).
- **Renditions:** transcoded qualities are cached under `./data/transcode-temp`; cleared automatically on re-transcode.
- **Artwork/Thumbnails:** stored under `./data/thumbnails` and `./data/artwork`.
- **Redis:** session/cache data in the `redis_data` Docker volume — safe to flush; sessions will simply re-issue tokens.

### Backups
Stop-safe backup (or use `sqlite3 .backup` for a live snapshot):
```bash
docker compose exec movieflix-app sh -c 'sqlite3 /app/data/database.sqlite ".backup /backup.sqlite"'
# Then copy /backup.sqlite and your media library to another disk.
```

### Re-scanning the Library
- **Manual:** Admin Panel → Libraries → *Scan now*.
- **Automatic:** the scanner runs on the interval set in env (`SCAN_INTERVAL_MINUTES`, default 10) and at startup (`SCAN_ON_STARTUP`).

### Resetting the Database (fresh start)

Easiest way — the installer's **wipeout** mode does this for you (removes containers, volumes, `./data`, and Redis data, resets the repo, and regenerates `.env`):

```bash
./install.sh      # choose option 2) Complete wipeout
```

Manual equivalent:

```bash
docker compose down
rm -rf ./data/database.sqlite
docker compose exec redis redis-cli FLUSHALL
docker compose up -d --build
```

This wipes accounts, profiles, and watch history — keep a backup first.

### Logs
```bash
docker compose logs -f movieflix-app
docker compose logs -f redis
```

### Health
```bash
curl http://localhost:9000/api/health
```
A `200` response confirms the app, database, and migration are healthy.

---

## Updating

**Recommended — the installer (update mode):**

```bash
cd MovieFlix
git pull origin main        # updates install.sh and the app
./install.sh                # choose option 1) Update only
```

**Manually:**

```bash
cd MovieFlix
git pull origin main
docker compose up -d --build
curl http://localhost:9000/api/health   # confirms app is healthy
```

- The database schema initializes automatically on startup — no migrations to run by hand.
- Update mode never touches `./data` or your `.env`, so accounts, watch history, and secrets are preserved.
- If you maintain a fork or local changes, stash them before pulling (`git stash`), then re-apply.

> **Release notes** are published on the [Releases page](https://github.com/johnvexcoder/MovieFlix/releases).

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| App won't start / health fails | Missing `JWT_SECRET` or bad env | Set strong secrets; run `./install.sh` to generate a correct `.env` |
| Build hangs / freezes the server | Low RAM during `next build` | Add a swapfile: `sudo fallocate -l 6G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` (needs ~3 GB ram+swap) |
| `rm` can't delete `./data` files | App container runs as root | The installer wipes via a throwaway container automatically |
| No posters / metadata | Missing TMDB key or no internet | Add `TMDB_API_KEY`, confirm outbound HTTPS |
| Media not showing | Wrong mount path or disabled library | Verify mounts are read-only-visible and library enabled in Admin Panel |
| Playback fails for some files | Codec not browser-compatible | Let on-demand transcode produce an H.264/AAC rendition |
| Seeking stalls or restarts at 0:00 | Outdated stream-range handling | Update to the current release (accurate byte-range seeking) |
| Downloading full file possible | Direct GET | Range-restriction is enforced; use a player that sends `Range` headers |
| Redis connection errors | Redis down / wrong URL | `docker compose up -d redis`, confirm `REDIS_URL` |
| Emails not sending | SMTP not configured | Set `SMTP_HOST/PORT/USER/PASS/FROM` in `.env` (or Admin Panel Settings) |

---

## Default Credentials

- **Admin Panel:** `http://localhost:9000/admin-panel/login`
- **Username:** `admin`
- **Password:** `admin123`

> ⚠️ **Important:** Change the default password immediately after first login via Admin Panel → Settings → Administrators Roster. The default `admin123` password is only for initial setup convenience.

---

## Contributing

Contributions, bug reports, and feature requests are welcome.

1. Fork the repository and create a feature branch.
2. Follow existing code style; run `npm run typecheck` and `npm run lint` before submitting.
3. Open a pull request describing your change.
4. For security issues, report privately rather than opening a public issue.

---

## Author & Credits

Built with care by **[John Vex Coder](https://github.com/johnvexcoder)** ✨

[![GitHub](https://img.shields.io/badge/GitHub-@johnvexcoder-181717?style=for-the-badge&logo=github)](https://github.com/johnvexcoder)
[![Ko-Fi](https://img.shields.io/badge/Support%20me-Ko--Fi-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/johnvexcoder)

**Special thanks** to the open-source projects this platform builds upon: Next.js, React, Tailwind CSS, Drizzle ORM, FFmpeg, Redis, and The Movie Database (TMDB).

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

You are free to use, modify, and distribute it, provided all derivative works are also distributed under the GPLv3. This project is intended for self-hosted, personal media streaming environments.

See the full text in the [LICENSE](LICENSE) file, or at [gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html).

---

<div align="center">
<p>Made with ❤️ for self-hosters.</p>
</div>
