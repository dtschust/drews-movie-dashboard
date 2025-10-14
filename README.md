# Drew's Movie Dashboard

A static React app (Vite + Tailwind) that searches movies and starts downloads through helper API endpoints. Designed to deploy on GitHub Pages.

## Features

- Token-gated access using `localStorage.token`
- Movie search with posters, title, and year
- Version list in API order with emojis and details
- Download trigger with success confirmation
- Loading spinner and friendly error messages

## Tech Stack

- React + Vite
- Tailwind CSS (utility-first styling)
- shadcn-style UI primitives (Button, Input, Card, etc.)

## API

- Base: `https://drews-little-helpers.herokuapp.com/movies`
- Auth: query/body param `token` sourced from `localStorage.token`
- Endpoints used:
  - `GET /movies/search?q=<query>&token=<token>` → `{ movies: [...] }`
  - `GET /movies/getVersions?id=<groupId>&token=<token>` → `{ versions: [...] }`
  - `POST /movies/downloadMovie` with JSON `{ torrentId, movieTitle, token }` → `{ ok: true, started: true }`

## Getting Started

- Prerequisites: Node 18+
- Install: `npm install`
- Dev: `npm run dev` and open the printed URL
- Build: `npm run build` (outputs to `dist/`)
- Preview: `npm run preview`

On first load, you’ll be prompted for a token. It is saved to `localStorage.token`.

## Project Structure

- `src/App.tsx` — main UI and flow
- `src/api.ts` — API calls (single `API_BASE` constant)
- `src/components/*` — small UI components (shadcn-style)
- `src/index.css` — Tailwind + CSS variables
- `vite.config.ts` — includes `base` for GitHub Pages

## Deployment (GitHub Pages)

This repo is configured for Pages under the path `/drews-movie-dashboard/`.

- If your repo name or Pages path differs, change `base` in `vite.config.ts`.

### Deploy using gh-pages branch (recommended)

We include a `gh-pages` deploy script that builds and publishes `dist/` to the `gh-pages` branch.

Prerequisites:

- A remote `origin` pointing to the GitHub repo with write access.
- Ensure `base` in `vite.config.js` matches the repo name path.

Steps:

- `npm run deploy`

What it does:

- Runs `npm run build`
- Publishes `dist/` to the `gh-pages` branch via `gh-pages` package
- In GitHub → Settings → Pages, choose Source: `Deploy from a branch`, Branch: `gh-pages` → `/ (root)`

### Alternative: docs folder (main branch)

- Either move `dist/` contents to a `docs/` folder, or configure Vite to build to `docs/`.
- In GitHub → Settings → Pages, choose Source: `Deploy from a branch`, Branch: `main` → `/docs`.

## Error Handling

- Network errors are shown in the UI and logged to the console.
- A restart button lets users reset the flow quickly.

## Notes

- Versions require that a search was performed first (server caches groups); the UI enforces this order.
- You can clear the saved token via the “Clear Token” button.
