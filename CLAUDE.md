# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HYROX Race Simulation leaderboard system for CrossFit Alkmaar (event: 30 mei 2026). Manages 150-200 participants in heats of 3, with live race control and a TV-ready leaderboard.

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## Architecture

Next.js 16 App Router, all pages are client components (`"use client"`) talking directly to Supabase — no API routes.

### Pages
- `/` — Navigation hub
- `/admin` — Participant CRUD, bulk import, heat generation, settings
- `/race` — Start heats, register finishes with live timers
- `/leaderboard` — TV-stream display with real-time rankings, category filters, auto-rotate

### Data Flow
All three pages read/write to Supabase via `app/lib/store.ts`. The race and leaderboard pages subscribe to Supabase realtime channels (`postgres_changes`) for instant updates across devices.

### Key Lib Files
- **`app/lib/types.ts`** — Shared types (`Participant`, `Heat`, `Division`, `Category`), label maps, `formatTime()` helper
- **`app/lib/store.ts`** — All Supabase CRUD operations. Maps snake_case DB columns ↔ camelCase TypeScript. Functions: `getParticipants`, `addParticipant`, `saveHeats`, `startHeat`, `finishParticipant`, etc.
- **`app/lib/heat-scheduler.ts`** — `generateHeats()`: groups by division+category, sorts fastest-first to prevent overtaking, clusters by weight class to minimize equipment changes
- **`app/lib/supabase.ts`** — Supabase client singleton

### Database (Supabase)
Tables: `hyrox_participants`, `hyrox_heats`, `hyrox_settings`. Schema in `supabase-setup.sql`. Realtime enabled on participants and heats tables. RLS enabled with permissive policies (public event tool).

### Divisions & Categories
- Divisions: `pro`, `open`
- Categories: `single_men`, `single_women`, `duo_mm`, `duo_ww`, `duo_mw`
- Weight classes derived from category: men, women, mixed

## Styling

CrossFit Alkmaar branding. Dark theme with CSS custom properties defined in `globals.css` via Tailwind v4 `@theme inline`. Key colors: `--cfa-navy` (#1a1a2e), `--cfa-blue` (#1e3a8a), `--cfa-yellow` (#f59e0b), `--cfa-green` (#10b981). Font: Inter. Custom animations for leaderboard (`slideIn`, `pulse-glow`).

## Environment Variables

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Both are public/client-safe keys.

## Important: Next.js 16

This uses Next.js 16 which may differ from training data. Read guides in `node_modules/next/dist/docs/` before writing new route handlers or using new APIs.

## Language

All UI text is in Dutch. Keep it that way.
