<div align="center">

# 🎬 StreamHub

### Cinema, Anime, Live TV, Sports & Hi-Res Music — All in One Hub
*A cinema-grade progressive web app with multi-server playback, real FLAC streaming, live sports feeds, IPTV, and social listening.*

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[Features](#-features) • [Quick Start](#-quick-start) • [Tech Stack](#-tech-stack) • [Keyboard Shortcuts](#-keyboard-shortcuts) • [Author](#-author) • [Disclaimer](#-legal-disclaimer)

</div>

---

## 🌟 Overview

**StreamHub** aggregates movies, TV, anime, live sports, IPTV channels, and a full music streaming module into one fast, themeable interface. Playback uses third-party embed providers with automatic failover and per-user health tracking, while the music module streams real lossless audio through a multi-provider resolver.

---

## 🚀 Features

### 🎥 Cinema & TV Shows
- **Multi-Server Failover Engine**: 14 embed providers (iShowStream, Vidy, VidLink, VidSrc ×3, Videasy XYZ, VidFast, 2Embed, MultiEmbed, and more) with automatic failover, per-user health scoring, and a loading timeout that advances servers automatically.
- **Overlay Subtitles**: Movies and episodes get synced subtitles fetched server-side from OpenSubtitles/SubDL via SubKong — CC toggle, ±sync offset (persisted per title), and 16-language picker in the player.
- **Rich Media Details**: TMDB-backed synopsis, ratings, trailers, cast, galleries (backdrops/posters/logos), and recommendations.
- **Binge Mode & TV Navigation**: Season/episode drawers, next-episode progression, resume-from-progress.
- **Continue Watching**: Progress persisted per title with resume prompts.

### 🎵 Xainy Music Module
- **Hi-Res Lossless Audio**: Real FLAC pipeline resolving through Monochrome (Tidal-backed), Netease, Joox/Kugou/Migu (Meting), and Internet Archive — with FLAC header verification, honest codec badges, Range-safe same-origin proxying, and next-track prefetch.
- **YouTube Music Integration**: InnerTube search/browse/playback via a server-side Vercel proxy — works without any extension.
- **Spotify Support**: Companion browser extension bridges your Spotify library — all playlists in the sidebar, playlist track normalization, YTM-matched playback.
- **Listen Together**: Real-time synced listening rooms over Supabase Realtime with host-authoritative playback, drift correction, chat, and host migration.
- **Immersive Player**: Full-screen now-playing with synced lyrics (LRCLIB + YTM timed lyrics), artwork-tinted ambient UI, queue drawer, sleep timer, replay stats, and Media Session API controls.
- **Installable PWA**: Add `/music` to your home screen — standalone display, service worker, offline app shell.

### ⚽ Live Sports Center
- **Live Scores & Match Center**: Real-time fixtures with stats, lineups, win-probability, incidents timeline, and direct stream links.
- **Region Timezone Engine**: Kickoff times recalculate per selected region with live clocks.
- **Multiview**: Watch 2–4 matches simultaneously in split screen.
- **Match Hopper**: Jump between live fixtures without leaving the player.

### ⛩️ Dedicated Anime Portal
- **AniList Sync**: Airing schedules, seasonal rankings, romaji/english titles.
- **5 Anime Servers**: AniEmbed, MegaVid, Vidly, Anixo, iShowStream with sub/dub toggle.

### 📺 Global Live TV Guide
- **EPG Integration**: Now/next program data per channel.
- **Categorized Feeds**: News, Entertainment, Kids, Movies, Sports, Music — with favorites and recents.
- **Native HLS Playback** via `hls.js`, Picture-in-Picture support.

### 🔍 Spotlight Command Search (`Cmd + K` / `Ctrl + K`)
Instant search across movies, series, anime, and people with keyboard navigation.

### 🎨 Personalization
- **5 Theme Accents** + OLED dark / light modes, custom accent hex.
- **Watchlist, History & Continue Watching** — all local-first, no account required.
- **Legal pages**: DMCA, Privacy Policy, Terms of Service.

---

## 💻 Tech Stack

- **Frontend**: React 18 + TypeScript (strict), Vite 5, React Router 6
- **State & Data**: Zustand, TanStack Query v5
- **Styling**: Tailwind CSS (Play CDN) + CSS-variable theming
- **Media**: Shaka Player (DASH), hls.js (HLS), Web Audio API analyser
- **Backend**: Vercel serverless functions — `api/hires-stream.js` (FLAC resolver + proxy), `api/subs.js` (subtitle resolver), `api/youtubei.js` (InnerTube proxy), `api/football-data/`, `api/stream.js`
- **Realtime**: Supabase Realtime (Listen Together rooms)
- **APIs**: TMDB, AniList GraphQL, SubKong (OpenSubtitles/SubDL), LRCLIB, Monochrome/Netease/Meting/Archive audio providers
- **Extension**: Companion Chromium extension for YouTube/Spotify session bridging
- **PWA**: Web manifest + service worker (`public/sw.js`)

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
git clone https://github.com/anassar12jS/streamsxainy-site.git
cd streamsxainy-site
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Environment Variables

Copy `.env.example` → `.env.local`. Server-side secrets (never `VITE_`-prefixed):

| Variable | Purpose |
| :--- | :--- |
| `FOOTBALL_DATA_TOKEN` | Football-Data API (sports scores) |
| `VITE_TMDB_API_KEY` | TMDB metadata |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Listen Together realtime rooms (optional) |

> **Note**: `/api/*` serverless functions only run on Vercel. Locally, hires/subtitle/YouTube-Music-proxy calls fail soft and the app falls back to public sources. For full local parity, use `vercel dev`.

### Deployment
Push to GitHub → import into [Vercel](https://vercel.com) → done. `vercel.json` handles SPA rewrites and security headers.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> | Spotlight Command Search |
| <kbd>/</kbd> | Focus Search Bar |
| <kbd>Esc</kbd> | Close Modal / Drawer |
| <kbd>F</kbd> | Toggle Cinema Fullscreen (Player) |
| <kbd>P</kbd> / <kbd>N</kbd> | Previous / Next Episode |

**Music player**: <kbd>Space</kbd> play/pause · <kbd>←</kbd>/<kbd>→</kbd> seek · <kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd> ±10s · <kbd>M</kbd> mute · <kbd>L</kbd> like · <kbd>Q</kbd> queue · <kbd>?</kbd> shortcuts

---

## 📂 Project Structure

```text
├── api/                  # Vercel serverless functions
│   ├── hires-stream.js   #   FLAC/lossless resolver + media proxy
│   ├── subs.js           #   Subtitle resolver (SubKong → SRT cues)
│   ├── youtubei.js       #   YouTube InnerTube proxy
│   ├── stream.js         #   Generic stream proxy
│   └── football-data/    #   Sports data proxy
├── server/hires/         # FLAC provider implementations (Monochrome, Netease, Meting, Archive, Deezer)
├── components/           # Shared UI (Navbar, Footer, CommandSearchModal, SettingsModal…)
├── pages/                # Routes (Home, Discover, Details, VidyPlayer, Sports, LiveTV, Anime, Legal)
├── services/             # API clients & persistence (tmdb, anilist, sports, epg, storage, subtitles…)
├── src/modules/music/    # Xainy Music module (player, routes, store, extension bridge, api)
├── public/               # PWA manifest, service worker, icons, sitemap, robots
├── App.tsx               # Routing hub with lazy-loaded code-splitting
└── vercel.json           # SPA rewrites + security headers
```

---

## 👤 Author

Developed and maintained by **Anas**:

- **GitHub**: [@anassar12jS](https://github.com/anassar12jS)
- **Instagram**: [@xainyx_](https://instagram.com/xainyx_)

---

## ⚖️ Legal Disclaimer

StreamHub is a media discovery and playback-aggregation tool. It does not host, upload, or store video files or copyrighted material on its own servers; playback is provided through third-party embed providers. Music streaming resolves public catalog sources and your own connected accounts (YouTube Music / Spotify via the companion extension). Please review our [DMCA Policy](/dmca), [Privacy Policy](/privacy), and [Terms of Service](/terms), and consult local copyright laws before use.

---

<div align="center">
  <sub>Built with ❤️ for cinephiles, sports fans, and music lovers worldwide.</sub>
</div>

## Sports data setup

Football-Data credentials are server-only. For local development, put `FOOTBALL_DATA_TOKEN` in `.env.local`. In Vercel, add the same variable under Project Settings → Environment Variables, then redeploy. Do not use a `VITE_` prefix for this secret.

The Vercel function at `api/football-data/[...path].js` proxies the supported Football-Data endpoints and applies shared short-term caching. Match pages stop waiting after eight seconds if an upstream feed is slow. When every feed fails, the UI shows no sample fixtures as live data.

F1 and combat sports coverage utilizes live event schedules and direct streams.
