# Miro Clone

A collaborative whiteboard application inspired by [Miro](https://miro.com). Create boards, draw freehand paths, pan and zoom, and manage your work from a dashboard—built with React, TypeScript, and WebGL for smooth canvas rendering.

## Features

- **Authentication** — Login and registration with JWT (access + refresh cookie)
- **Dashboard** — Create, list, search, and delete boards; switch between grid and list views
- **Whiteboard** — Infinite canvas with:
  - **Draw mode** — Freehand drawing with configurable color and stroke size
  - **Select mode** — Select and move drawn objects
  - **Grab mode** — Pan the canvas
  - **Zoom** — In / out / reset with smooth animation
  - **Palette** — Color and brush size picker
  - **Undo / redo** — Operation-based history (CRDT-ready design)
- **WebGL rendering** — Hardware-accelerated drawing for many objects

## Tech Stack

| Area        | Stack                          |
|------------|---------------------------------|
| Framework  | React 19, TypeScript            |
| Build      | Vite 7                          |
| Styling    | Tailwind CSS 4                  |
| State      | Zustand                         |
| Routing    | React Router 7                  |
| HTTP       | Axios                           |
| UI         | Radix UI, Lucide icons          |

## Prerequisites

- **Node.js** 20+
- **npm** (or compatible package manager)

The app expects a backend API at `http://localhost:8080` for auth and boards. See [Backend / API](#backend--api) for configuration.

## Quick Start

```bash
# Clone the repository (if needed)
git clone <repo-url>
cd miro-clone

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). You can use the UI without a backend for the whiteboard; auth and dashboard require the API.

## Scripts

| Command           | Description                    |
|-------------------|--------------------------------|
| `npm run dev`     | Start Vite dev server (HMR)    |
| `npm run build`   | TypeScript check + production build |
| `npm run preview` | Serve the production build     |
| `npm run lint`    | Run ESLint                     |
| `npm run format`  | Format code with Prettier      |
| `npm run format:check` | Check formatting (CI)   |

## Project Structure

```
src/
├── app/                 # App shell, router, API client
│   ├── api/             # axios instance, interceptors
│   ├── layouts/         # AppLayout
│   └── router/          # routes, PublicRoute, ProtectedRoute
├── components/ui/       # Shared UI (Button, Card, Dialog, etc.)
├── features/
│   ├── auth/            # Login, register, JWT, auth store
│   ├── canvas/          # Whiteboard, WebGL, tools, palette, zoom, grid
│   └── dashboard/       # Boards list/grid, create/delete, search
├── lib/                 # Utilities (e.g. cn)
└── pages/               # Route-level pages (Home, Dashboard, Canvas)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deeper breakdown.

## Backend / API

The frontend uses an API client with `baseURL: 'http://localhost:8080'` and `withCredentials: true` for cookies.

To point at another host (e.g. in production), you can:

1. Introduce an env variable (e.g. `VITE_API_BASE_URL`) in the Vite config and use it in `src/app/api/apiClient.ts`, or  
2. Change the `baseURL` in `apiClient.ts` for your environment.

Expected API surface (for reference):

- **Auth** — Login and register endpoints that return JWT and set a refresh cookie; the client sends the access token (e.g. in `Authorization` or a cookie) and uses the refresh cookie for renewal (see `src/app/api/interceptors.ts`).
- **Dashboard** — Endpoints to list boards, create a board, and delete a board; boards have at least `id` and `name`.

## Route Protection

Dashboard and board routes can be protected so only logged-in users can access them. In `src/app/router/AppRouter.tsx`, uncomment the `ProtectedRoute` wrapper for the dashboard and board routes:

```tsx
{
  element: <ProtectedRoute />,  // uncomment this
  children: [
    { path: '/dashboard', element: <DashboardPage /> },
    { path: '/board/:id', element: <CanvasPage /> },
  ],
},
```

## CI

GitHub Actions runs on every push and pull request (see [.github/workflows/ci.yml](.github/workflows/ci.yml)):

- Node 20, clean `npm install`
- `npm run format:check`
- `npm run build`

Lint is present in the workflow but commented out; uncomment when you want it to block CI.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — Codebase structure, features, and key concepts
- [Contributing](docs/CONTRIBUTING.md) — Development workflow, formatting, and PR guidelines

## License

Private / unlicensed unless stated otherwise in the repository.
