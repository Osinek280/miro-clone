# Contributing

Thanks for your interest in contributing. This document covers the development workflow, code style, and how to get your changes merged.

## Development Setup

1. **Prerequisites** — Node.js 20+ and npm.
2. **Clone and install**
   ```bash
   git clone <repo-url>
   cd miro-clone
   npm install
   ```
3. **Run the app**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173). The whiteboard works without a backend; auth and dashboard need an API at `http://localhost:8080` (see [README - Backend / API](../README.md#backend--api)).

## Code Style

- **Formatting** — Use Prettier. Run `npm run format` before committing. CI runs `npm run format:check`.
- **Linting** — ESLint is configured; run `npm run lint` locally. The lint step in CI is currently commented out; you can enable it in [.github/workflows/ci.yml](../.github/workflows/ci.yml) when ready.
- **TypeScript** — Keep strict mode; avoid `any` unless necessary and document why.
- **Naming** — Use clear, consistent names; feature code lives under `src/features/<feature>/`.

## Project Conventions

- **Features** — Keep auth, canvas, and dashboard logic in their `src/features/*` folders (api, components, hooks, store, utils as needed).
- **Shared UI** — Put reusable UI in `src/components/ui/`. Use existing Radix + Tailwind patterns and `lib/utils.ts` (e.g. `cn`) for class names.
- **Routing** — Add or change routes in `src/app/router/AppRouter.tsx`. Use `PublicRoute` for login/register and `ProtectedRoute` for dashboard/board when protection is enabled.
- **API** — Use the shared `apiClient` from `src/app/api/apiClient.ts`; keep endpoint and type definitions in the feature’s `api` folder.

## Before Submitting

1. Run `npm run format` and fix any formatting issues.
2. Run `npm run build` to ensure the project builds.
3. Optionally run `npm run lint` and fix reported issues.
4. Manually test the flows you changed (auth, dashboard, canvas).

## Pull Requests

- Use a short, descriptive branch name and PR title.
- Describe what changed and why; link any related issues.
- Keep PRs focused; split large changes into smaller ones when possible.
- Ensure CI passes (format check and build; lint if you’ve re-enabled it).

## Questions

If something is unclear, open an issue or ask the maintainers. For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).
