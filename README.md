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
- `src/App.jsx` — main UI and flow
- `src/api.js` — API calls (single `API_BASE` constant)
- `src/components/*` — small UI components (shadcn-style)
- `src/index.css` — Tailwind + CSS variables
- `vite.config.js` — includes `base` for GitHub Pages

## Deployment (GitHub Pages)
This repo is configured for Pages under the path `/drews-movie-dashboard/`.
- If your repo name or Pages path differs, change `base` in `vite.config.js`.

Two common approaches:

1) gh-pages branch
- `npm run build`
- Push `dist/` to a `gh-pages` branch and configure Pages to serve from that branch.

2) docs folder (main branch)
- Either move `dist/` to `docs/`, or change build output to `docs/` and enable Pages from `/docs` in repo settings.

## Error Handling
- Network errors are shown in the UI and logged to the console.
- A restart button lets users reset the flow quickly.

## Notes
- Versions require that a search was performed first (server caches groups); the UI enforces this order.
- You can clear the saved token via the “Clear Token” button.

