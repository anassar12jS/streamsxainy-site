<div align="center">

# 🎬 StreamHub

### The Ultimate Cinema, Sports & Anime Streaming Hub
*A modern, ultra-fast, multi-source entertainment platform with live TV, sports schedules, and multi-server playback.*

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[Features](#-features) • [Quick Start](#-quick-start) • [Tech Stack](#-tech-stack) • [Keyboard Shortcuts](#-keyboard-shortcuts) • [Author](#-author) • [Disclaimer](#-legal-disclaimer)

</div>

---

## 🌟 Overview

**StreamHub** is a cinema-grade progressive web application built for movie buffs, anime enthusiasts, and live sports fans. It aggregates high-performance streaming mirrors, real-time sports satellite feeds, IPTV channels, and comprehensive metadata from TMDB and AniList into a seamless, distraction-free interface.

---

## 🚀 Features

### 🎥 Cinema & TV Shows
- **Multi-Server Failover Engine**: Instant switching between 8+ streaming nodes including Vidy, VidLink, VidSrc, Videasy, Vidora, CinemaOS, and VidFast.
- **Rich Media Details**: TMDB-backed synopsis, ratings, trailers, cast lists, crew bios, and similar content recommendations.
- **Binge Mode & TV Navigation**: Quick season and episode drawers with automatic next-episode progression.
- **Cross-Session Resume**: Saves your watch time, season, and episode progress directly in local storage.

### ⚽ Live Sports Center
- **Satellite & Web Feeds**: Live sports streaming with multi-provider failover (`Streamed`, `VIPRow`, `StreamEast`, and HD mirrors).
- **Match Countdown Clocks**: Real-time ticker countdowns to kickoff in your local timezone.
- **Ad & Popup Shield**: Built-in sandbox mode that neutralizes aggressive popups from third-party sports streams.
- **Category Filter Pills**: Football ⚽, Basketball 🏀, UFC/MMA 🥊, Formula 1 🏎️, NFL 🏈, MLB ⚾, NHL 🏒, Tennis 🎾, and Cricket 🏏.
- **Live Match Hopper**: Hop directly between live sports fixtures without leaving the cinema player.

### ⛩️ Dedicated Anime Portal
- **AniList Sync**: Airing schedules, next episode counters, romaji/english titles, and seasonal rankings.
- **Dual Server Pipeline**: AniEmbed and MegaVid streaming servers.
- **Sub / Dub Toggle**: Instant switching between original Japanese audio with subtitles and English dubbing.

### 📺 Global Live TV Guide
- **Electronic Program Guide (EPG)**: Browse hundreds of regional and international IPTV channels.
- **Categorized Feeds**: News, Entertainment, Kids, Movies, Sports, and Music.
- **HLS Native Player**: Low-latency video playback using `hls.js`.

### 🔍 Spotlight Command Search (`Cmd + K` / `Ctrl + K`)
- Instant keyboard-accessible modal search across movies, TV series, anime, actors, and directors.
- Live debounced query matching with poster previews and keyboard arrow navigation.

### 🎨 Personalization & Cinema Ambiance
- **Dynamic Theming**: Choose between 5 theme accents (Purple, Red, Blue, Green, Orange).
- **OLED Dark & High-Contrast Light Modes**: Pure dark tones for late-night viewing and crisp light layouts.
- **Personal Watchlist**: Bookmark favorites across cinema, anime, and live sports matches.

---

## 💻 Tech Stack

- **Frontend**: [React 19](https://react.dev/) with functional components & custom hooks
- **Type Safety**: [TypeScript](https://www.typescriptlang.org/) strict mode
- **Build System**: [Vite 7](https://vitejs.dev/) with automated route code-splitting
- **Data Fetching & Cache**: [TanStack Query v5](https://tanstack.com/query) with optimistic stale-while-revalidate caching
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with native CSS variables for theme switching
- **Icons**: [Lucide React](https://lucide.dev/)
- **Streaming & Media**: [HLS.js](https://github.com/video-dev/hls.js/) for live broadcast playback
- **APIs**:
  - [The Movie Database (TMDB) API](https://www.themoviedb.org/documentation/api)
  - [AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs/)
  - Real-time sports fixture endpoints & IPTV feeds

---

## ⚡ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` or `pnpm`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anassar12jS/StreamHub.git
   cd StreamHub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Cmd</kbd> + <kbd>K</kbd> / <kbd>Ctrl</kbd> + <kbd>K</kbd> | Open Spotlight Command Search |
| <kbd>/</kbd> | Focus Search Bar |
| <kbd>Esc</kbd> | Close Modal / Search Drawer |
| <kbd>F</kbd> | Toggle Cinema Fullscreen (in Player) |
| <kbd>Space</kbd> | Play / Pause Stream |

---

## 📂 Project Structure

```text
StreamHub/
├── components/          # Reusable UI components (Navbar, Footer, Modals, Sliders)
├── pages/               # Routed views (Home, Details, VidyPlayer, Sports, LiveTV, Anime)
├── services/            # API clients, scrapers, and persistence layers (TMDB, AniList, Sports)
├── types/               # TypeScript interfaces and domain schemas
├── public/              # Static assets, SVG favicons, and manifest files
├── App.tsx              # Main routing hub with lazy-loaded Suspense code-splitting
├── index.html           # HTML5 entry with preconnect hints and SVG tab logo
├── index.tsx            # React root mount and QueryClient provider
└── vite.config.ts       # Optimized Vite build and server config
```

---

## 👤 Author

Developed and maintained by **Anas**:

- **GitHub**: [@anassar12jS](https://github.com/anassar12jS)
- **Instagram**: [@xainyx_](https://instagram.com/xainyx_)

---

## ⚖️ Legal Disclaimer

StreamHub is an open-source media discovery and indexation tool. It does not host, upload, or store any video files, media streams, or copyrighted material on its own servers. All streams and metadata are provided by third-party services and APIs. Please review local copyright laws before accessing third-party streaming resources.

---

<div align="center">
  <sub>Built with ❤️ for cinephiles and sports fans worldwide.</sub>
</div>

## Sports data setup

Football-Data credentials are server-only. For local development, put `FOOTBALL_DATA_TOKEN` in `.env.local`. In Vercel, add the same variable under Project Settings → Environment Variables, then redeploy. Do not use a `VITE_` prefix for this secret.

The Vercel function at `api/football-data/[...path].js` proxies the supported Football-Data endpoints and applies shared short-term caching. Match pages stop waiting after eight seconds if an upstream feed is slow. When every feed fails, the UI shows no sample fixtures as live data.

The bundled Botola standings and F1/event coverage still need a live data source; this change does not make those feeds live.