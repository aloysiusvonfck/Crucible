# NexusIDE

A mobile-first AI-powered code editor for Kotlin/Jetpack Compose. Built with Expo React Native and Express.

## Features

- **AI Chat** — Streaming conversations with NVIDIA NIM API (nemotron-4-340b-instruct)
- **Code Editor** — Kotlin/Jetpack Compose syntax highlighting with line numbers
- **Build System** — AI-powered code generation and self-modification
- **Local Storage** — Files and API keys stored locally on device
- **Cross-Platform** — iOS, Android, and Web

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Expo SDK 54, React Native 0.81, React 19 |
| Backend | Express 5, TypeScript |
| AI | NVIDIA NIM API |
| Storage | expo-secure-store (keys), async-storage (files/chat) |
| Styling | Tailwind-inspired dark theme |

## Development

```bash
# Install dependencies
npm install

# Start Expo dev server
npm run expo:dev

# Start backend server (separate terminal)
npm run server:dev
```

## Environment Variables

Create `.env` in project root:

```env
NVIDIA_NIM_API_KEY=your_key_here
EXPO_PUBLIC_DOMAIN=http://localhost:5000
```

## Build

```bash
# Build web bundle
npm run expo:static:build

# Build for EAS (requires Expo account)
eas build --platform android --profile preview
```

## Project Structure

```
app/(tabs)/         # Tab screens (Chat, IDE, Build, Keys)
server/             # Express backend
  ├── index.ts      # Server setup
  └── routes.ts     # API routes (chat, generate, modify)
lib/                # Shared utilities
  ├── app-context.tsx   # Global state
  └── streaming.ts      # SSE streaming
components/         # UI components
constants/          # Theme/colors
```

## API Endpoints

- `POST /api/chat` — Streaming chat proxy to NVIDIA NIM
- `POST /api/generate-module` — AI generates Compose modules
- `POST /api/self-modify` — AI modifies existing code

## License

MIT
