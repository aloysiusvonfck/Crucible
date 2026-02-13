# NexusIDE

## Overview

NexusIDE is a mobile-first AI-powered code editor built as an Expo React Native application with an Express backend. It provides a chat interface for interacting with an AI assistant (via NVIDIA NIM API), a code editor with syntax highlighting for Kotlin/Jetpack Compose, a build/code generation system, and API key management — all within a tab-based mobile UI. The app targets iOS, Android, and web platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture (`newArchEnabled: true`) and React Compiler experiment.
- **Routing**: File-based routing via `expo-router` v6 with typed routes. The app uses a tab-based layout defined in `app/(tabs)/_layout.tsx` with four tabs: Chat, IDE, Build, and Keys.
- **State Management**: A custom `AppProvider` context (`lib/app-context.tsx`) manages all app state including files, chat messages, build logs, API keys, and editor state. No Redux or other state library is used.
- **Data Fetching**: TanStack React Query (`@tanstack/react-query`) with a custom query client (`lib/query-client.ts`) that constructs API URLs from `EXPO_PUBLIC_DOMAIN` environment variable. Streaming responses are handled via Server-Sent Events in `lib/streaming.ts`.
- **Storage**: `expo-secure-store` for sensitive data (API keys), `@react-native-async-storage/async-storage` for general persistence (files, chat history).
- **Fonts**: Inter (UI text) and JetBrains Mono (code editor) loaded via `@expo-google-fonts`.
- **UI**: Dark theme only (defined in `constants/colors.ts` with a GitHub-dark-inspired palette). Uses `react-native-reanimated` for animations, `react-native-gesture-handler` for gestures, `react-native-keyboard-controller` for keyboard handling, and `expo-haptics` for tactile feedback.
- **Error Handling**: Class-based `ErrorBoundary` component wraps the app with a fallback UI that can restart the app.

### Backend (Express)

- **Runtime**: Express 5 running as a Node.js server (`server/index.ts`), compiled with `esbuild` for production or run with `tsx` for development.
- **API Proxy**: The primary route (`POST /api/chat` in `server/routes.ts`) proxies streaming chat requests to NVIDIA NIM API (`integrate.api.nvidia.com`), using the `nvidia/nemotron-4-340b-instruct` model. It accepts an API key from the request body or falls back to `NVIDIA_NIM_API_KEY` environment variable.
- **CORS**: Dynamic CORS configuration based on Replit environment variables (`REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS`) plus localhost origins for development.
- **Static Serving**: In production, serves a static landing page from `server/templates/landing-page.html`. The build process (`scripts/build.js`) handles Expo web static export.
- **Storage Layer**: `server/storage.ts` defines an `IStorage` interface with an in-memory implementation (`MemStorage`) for user data. This is a placeholder — currently not connected to Postgres despite Drizzle being configured.

### Database Schema

- **ORM**: Drizzle ORM with PostgreSQL dialect, configured via `drizzle.config.ts` pointing to `DATABASE_URL` environment variable.
- **Schema**: Defined in `shared/schema.ts` with a single `users` table (id, username, password). Uses `drizzle-zod` for schema validation.
- **Current State**: The database schema exists but the app uses in-memory storage (`MemStorage`). The Drizzle setup is ready for when Postgres is provisioned — run `npm run db:push` to sync schema.

### Build & Deploy

- **Development**: Two processes run concurrently — Expo dev server (`npm run expo:dev`) and Express server (`npm run server:dev`).
- **Production Build**: `scripts/build.js` starts Metro bundler, fetches the static web bundle, and saves it. The Express server is bundled with esbuild (`npm run server:build`) and served with `npm run server:prod`.
- **Port**: The Express server runs on port 5000.

### Tab Screens

1. **Chat** (`chat.tsx`): AI chat interface with streaming responses, message bubbles, typing indicator.
2. **IDE** (`ide.tsx`): Code editor with Kotlin/Compose syntax highlighting, file management (create, open, delete, save).
3. **Build** (`build.tsx`): Code generation and modification via AI, with build logs and the ability to apply generated code to the editor.
4. **Keys** (`keys.tsx`): NVIDIA NIM API key management with secure storage.

## External Dependencies

### APIs & Services
- **NVIDIA NIM API** (`integrate.api.nvidia.com`): Powers AI chat and code generation using the `nvidia/nemotron-4-340b-instruct` model. Requires an API key stored either client-side (via Secure Store) or server-side (`NVIDIA_NIM_API_KEY` env var).

### Database
- **PostgreSQL**: Configured via Drizzle ORM but not yet actively used. Connection via `DATABASE_URL` environment variable. Schema migrations output to `./migrations` directory.

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required for Drizzle)
- `NVIDIA_NIM_API_KEY` — Server-side fallback API key for NVIDIA NIM
- `EXPO_PUBLIC_DOMAIN` — Domain for API requests from the frontend
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` — Used for CORS and Expo configuration on Replit

### Key NPM Packages
- `expo` ~54.0.27, `react-native` 0.81.5, `react` 19.1.0
- `expo-router` ~6.0.17 (file-based routing)
- `express` ^5.0.1 (backend server)
- `drizzle-orm` ^0.39.3 + `drizzle-kit` (database ORM)
- `@tanstack/react-query` ^5.83.0 (data fetching)
- `expo-secure-store` (API key storage)
- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-keyboard-controller` (native UI)
- `pg` ^8.16.3 (PostgreSQL client)