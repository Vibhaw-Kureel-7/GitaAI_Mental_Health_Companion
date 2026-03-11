# Gita Companion — Tauri Desktop App

A private, offline mental health companion powered by Bhagavad Gita wisdom
and LoRA-finetuned Llama 3.2 models.

---

## Prerequisites

| Tool        | Version   | Install                          |
|-------------|-----------|----------------------------------|
| Node.js     | >= 18     | https://nodejs.org               |
| Rust        | stable    | https://rustup.rs                |
| Tauri CLI   | 2.x       | included in devDependencies      |
| WebView2    | Windows   | bundled with Win11; download for Win10 |

---

## Icons — REQUIRED before first build

You need to supply two icon files, then run one command.

1. Place your SVG at:
   ```
   gita-companion/app-icon.svg
   ```

2. Place your ICO at:
   ```
   gita-companion/src-tauri/icons/icon.ico
   ```

3. Run:
   ```bash
   npx tauri icon app-icon.svg
   ```
   This auto-generates all required sizes:
   - src-tauri/icons/32x32.png
   - src-tauri/icons/128x128.png
   - src-tauri/icons/128x128@2x.png
   - src-tauri/icons/icon.ico  (overwritten)
   - src-tauri/icons/icon.icns

---

## Final folder layout (production)

All files must be in the SAME directory:

```
gita_companion.exe          <- output of tauri build
gita_ai.exe                 <- Python CLI backend
router_embeddings.pkl
lora_adapters_LLM1/
lora_adapters_LLM2/
lora_adapters_LLM3/
lora_adapters_LLM6/
```

---

## Development

```bash
cd gita-companion
npm install
npm run tauri dev
```

First `dev` run: Cargo downloads + compiles (~5 min). Subsequent runs are fast.

---

## Production build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`

Copy the `.exe` to the directory alongside `gita_ai.exe` and adapter folders.

---

## Project structure

```
gita-companion/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
│
├── src/                            Frontend (React + TypeScript)
│   ├── main.tsx                    Entry point
│   ├── App.tsx                     Root layout + boot gate
│   ├── index.css                   Full design system (neobrutualist)
│   │
│   ├── types/
│   │   └── index.ts                All shared TypeScript types
│   │
│   ├── store/
│   │   └── chatStore.ts            Zustand global state
│   │
│   ├── hooks/
│   │   ├── useSystemCheck.ts       Boot sequence hook
│   │   └── useChat.ts              Send message + event subscriptions
│   │
│   └── components/
│       ├── Sidebar.tsx             Conversation history
│       ├── ChatWindow.tsx          Message list + empty state
│       ├── MessageBubble.tsx       Single message card
│       ├── RoutingPanel.tsx        Animated routing score bars
│       ├── InputBar.tsx            Auto-expanding textarea + send
│       ├── StatusBar.tsx           Bottom chrome bar
│       └── SystemCheck.tsx         Startup / loading screen
│
└── src-tauri/                      Rust backend (Tauri 2)
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json
    └── src/
        ├── main.rs                 App entry point + window event handler
        ├── state.rs                AppState + ProcessHandle structs
        └── commands/
            ├── mod.rs              Re-exports
            ├── system.rs           check_system command
            └── ai.rs               init_process, ask_question, kill_process

```

---

## How it works

1. On startup, `check_system` verifies all required files exist on disk.
2. `init_process` spawns `gita_ai.exe --interactive` as a persistent child
   process, capturing its stdin and stdout.
3. A background Rust thread reads stdout line-by-line into a tokio mpsc channel.
4. The app waits for the "System ready!" line before marking itself ready.
5. Each user question:
   - Writes `{question}\n` to the child's stdin.
   - Reads lines from the channel until the response-end separator.
   - Parses routing scores, selected key, confidence from the table lines.
   - Returns a structured `AskResponse` to the React frontend.
6. The frontend renders animated routing bars and the response text.
7. On window close, the child process is killed cleanly.

---

## Design system

Neobrutualist editorial aesthetic:
- Palette:     Deep ink (#0D0D0B), warm parchment (#F4EDD8), saffron fire (#C85A0A)
- Typography:  Cormorant Garamond (display) + IBM Plex Mono (system/mono) + DM Sans (body)
- Borders:     2px hard borders, no border-radius anywhere
- Shadows:     Flat offset box-shadows (3px 3px 0px) — no blur
- Accents:     Vishada = deep red, Sankhya = deep blue, Karma = forest green, Dhyana = violet
