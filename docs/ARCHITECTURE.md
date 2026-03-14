# Architecture

This document describes the codebase structure, main features, and design decisions.

## Overview

The app is a single-page application (SPA) with:

- **Public routes** — Home, Login, Register
- **Protected routes** (optional) — Dashboard, Board (canvas)
- **Shared layout** — `AppLayout` wraps all routes; navigation is handled by React Router

Data flow:

- **Auth** — Zustand store (`auth.store`) + JWT in memory (and optional refresh cookie); API client interceptors attach the token and handle refresh.
- **Dashboard** — Fetches boards from `/api/boards`; create/delete via same API.
- **Canvas** — Local state only (Zustand + history store); no canvas sync with backend in the current implementation. The canvas state is suitable for future CRDT/collaboration (operation-based history with timestamps and tombstones).

## Directory Layout

```
src/
├── app/                    # Application shell and global config
│   ├── api/
│   │   ├── apiClient.ts    # Axios instance (baseURL, withCredentials)
│   │   └── interceptors.ts # Attach token, handle 401 refresh
│   ├── layouts/
│   │   └── AppLayout.tsx   # Layout wrapper for all routes
│   └── router/
│       ├── AppRouter.tsx   # Route definitions (createBrowserRouter)
│       ├── PublicRoute.tsx # Redirects authenticated users away from login/register
│       └── ProtectedRoute.tsx # Redirects unauthenticated users to login
│
├── components/ui/          # Reusable UI primitives (Button, Card, Dialog, etc.)
│
├── features/               # Feature-based modules
│   ├── auth/
│   │   ├── api/            # auth.api, auth.types
│   │   ├── components/     # LoginForm, RegisterForm
│   │   ├── hooks/          # useLogin, useRegister, useLogout, useAuthStatus
│   │   ├── store/          # auth.store (Zustand)
│   │   └── utils/          # parseJwt, TokenStorage
│   │
│   ├── canvas/
│   │   ├── components/     # Toolbar, Palette, Zoom, SelectionToolbar
│   │   ├── constants/      # cameraConstants, paletteColors, icons
│   │   ├── grid/           # Grid, useGrid
│   │   ├── hooks/
│   │   │   ├── modes/      # useDrawMode, useSelectMode, useGrabMode
│   │   │   ├── useCamera.tsx
│   │   │   ├── useCanvasStore.ts
│   │   │   ├── useHistoryStore.ts
│   │   │   └── useMouseHandlers.tsx
│   │   ├── types/          # types.ts (DrawObject, Point, HistoryOperation, etc.)
│   │   ├── utils/          # cameraUtils, cursorUtils, objectUtils
│   │   ├── Whiteboard.tsx  # Main canvas container
│   │   └── WebGLRenderer.ts
│   │
│   └── dashboard/
│       ├── api/            # dashboard.api, dashboard.types
│       ├── components/     # DashboardHeader, BoardsGrid, BoardList, CreateBoardDialog, etc.
│       ├── hooks/          # useDashboard, useCreateBoard / useBoardActions
│       └── utils/          # board.utils
│
├── lib/
│   └── utils.ts            # cn() and other helpers
│
└── pages/                  # One component per main route
    ├── HomePage.tsx
    ├── DashboardPage.tsx
    └── CanvasPage.tsx      # Renders Whiteboard full-screen
```

## Feature: Auth

- **Store** — `useAuthStore`: `user`, `isAuthenticated`, `setAuth`, `clearAuth`.
- **Token** — Access token is stored in memory (e.g. via `TokenStorage`); refresh is done via cookie. Interceptors add the access token to requests and call the refresh endpoint on 401.
- **Routes** — `PublicRoute` redirects logged-in users from `/login` and `/register` to `/dashboard`. `ProtectedRoute` (when enabled) redirects unauthenticated users to `/login`.

## Feature: Dashboard

- **Data** — `useDashboard` fetches boards from `GET /api/boards` and exposes `boards`, `loading`, `error`, `fetchBoards`.
- **Actions** — Create board (dialog + `POST /api/boards`), delete board (`DELETE /api/boards/:id`). Board model: `id`, `name` (see `dashboard.types`).
- **UI** — Grid vs list view (URL query `?view=grid|list`), search filter, empty state.

## Feature: Canvas (Whiteboard)

### Roles of main pieces

- **Whiteboard.tsx** — Composes canvas DOM, WebGL renderer, camera refs, mode state, and hooks. Subscribes to `useCanvasStore` and `useHistoryStore`; delegates mouse handling to `useMouseHandlers` and zoom to `useCamera`.
- **WebGLRenderer** — Initialized once per canvas; draws objects, current path, and overlays (selection box, selected bounding box) using WebGL. Receives camera (zoom, offset) and tool (color, size).
- **useCanvasStore** — Single source of truth for:
  - Refs: `rendererRef`, `cameraRef` (set from Whiteboard after init).
  - Render state: `objects`, `currentPath`, `color`, `size`, `selectionBox`, `selectedBoundingBox`.
  - Interaction flags: `selectedIds`, `isDrawing`, `isMoving`, `isGrabbing`.
  - All setters that affect what is drawn call `scheduleRender(get)` so that at most one `renderFrame()` runs per animation frame.
- **useMouseHandlers** — Map pointer events to the current mode (draw / select / grab). Draw mode uses `useDrawMode`; select uses `useSelectMode`; grab uses `useGrabMode`. Updates store (objects, currentPath, selection, camera offset).
- **useCamera** — Zoom in/out/reset with smooth animation; reads/writes `cameraRef` and triggers store `renderFrame()` when camera changes.
- **useHistoryStore** — Stack of operations (`add`, `remove`, `addMany`, `setPosition`, `batch`) with optional `opId` and `timestamp`. Supports undo/redo and is designed so operations can later be sent to a backend or CRDT (LWW, tombstones).

### Canvas types (summary)

- **DrawObject** — `id`, `type: 'path'`, `points`, `color`, `size`; optional `tombstone`, `positionTimestamp` for collaboration.
- **Point** — `{ x, y }`.
- **Camera** — `zoom`, `offsetX`, `offsetY`.
- **DrawModeEnum** — `Draw`, `Select`, `Grab`.
- **HistoryOperation** — `AddObjectOp`, `RemoveObjectsOp`, `AddObjectsOp`, `SetPositionOp`, `BatchOp` (see `types.ts`).

### Grid

- **Grid** — Visual grid overlay on the canvas.
- **useGrid** — Grid geometry/visibility logic if needed.

## UI Components

`components/ui/` holds shared primitives (e.g. Button, Card, Dialog, Input, Label, Badge, Dropdown, ScrollArea). They are built with Radix UI and Tailwind; styling uses `lib/utils.ts` (`cn`, class-variance-authority, tailwind-merge) where applicable.

## Build and Tooling

- **Vite** — Entry: `index.html` → `src/main.tsx`. React Router is provided at root; no global state provider beyond what each feature uses (Zustand).
- **TypeScript** — Strict; app code in `tsconfig.app.json`, config in `tsconfig.node.json`.
- **Tailwind** — v4 with `@tailwindcss/vite`; styles in `src/index.css`.
- **ESLint** — Flat config; React hooks and TypeScript.
- **Prettier** — Used for formatting; CI runs `format:check`.

## CI

See [.github/workflows/ci.yml](../.github/workflows/ci.yml). Jobs: checkout, setup Node 20, clean install, format check, build. Lint step exists but is commented out.
