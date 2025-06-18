# Amplify **Phase 3** — Product Requirements Document (PRD)

---

## 1️⃣ Goal

Add a **chat thread pane** (tab-based) that talks directly to each running `amp` agent, while preserving today’s terminal. The thread UI should match the rich conversational experience of the Amp CLI mock-up, with auto-scrolling, markdown, code blocks, and role-based styling.

---

## 2️⃣ Scope

| Theme                        | Capability                                                                                                  | Status  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| Thread bootstrap             | `amp threads new` invoked once during **Create Session**; persist `<thread-id>` + `amp.log` path            | **IN**  |
| **Tabbed terminal / thread** | Session page shows WAI-ARIA-compliant tabs **Terminal**, **Thread** (room left for **Logs**, **CI**)        | **IN**  |
| Thread UI (rich chat)        | React ThreadView with MessageBubble, MarkdownRenderer, auto-scroll, keyboard shortcuts, connection status   | **IN**  |
| Log-tail streaming           | Node LogTailer watches JSONL `amp.log`; parses with AmpLogParser and pushes ThreadMessage events via WS/SSE | **IN**  |
| History replay               | On load/restart, parse existing log and hydrate thread transcript                                           | **IN**  |
| Multiple threads per session | — (single thread MVP)                                                                                       | **OUT** |

---

## 3️⃣ Architecture

```text
Browser SPA (React)
/term/{sessionId}
└─ SessionPage
     └─ <TaskTabs role="tablist">  (Thread · Logs · CI)
          ├─ TerminalTab  → TerminalView (xterm.js)
          └─ ThreadTab    → ThreadView
               ├─ MessageBubble · MarkdownRenderer
               └─ MessageInput (textarea + send)
                ▲
                │ WebSocket /sessions/{id}/chat  (shared via SessionContext)
                ▼
Node/TS Controller
├─ POST /sessions – clone repo, docker run, `amp threads new` ⇒ save thread.id + amp.log
├─ WS  /sessions/{id}/chat
│     • inbound: user text → exec in container
│     • outbound: broadcast parsed ThreadMessage DTOs
├─ GET /sessions/{id}/history – paginated ThreadMessage list
└─ LogTailer+AmpLogParser – fs.watch(readline) → dedupe → WS publish
Filesystem
└─ $DATA_DIR/{sessionId}/
      ├─ thread.id
      └─ amp.log         (append-only JSONL)
```

---

## 4️⃣ Implementation Roadmap (4 weeks)

| Sprint | Deliverable                    | Key Tasks                                                                                                    |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **1**  | Thread bootstrap & persistence | • Call `amp threads new` on session create<br>• Store `thread.id`, `amp.log`                                 |
| **2**  | Log tail + JSON parser service | • Implement LogTailer (debounced fs.watch)<br>• Integrate **AmpLogParser** from docs                         |
| **3**  | Tabs & **Thread UI**           | • Build `<TaskTabs>` navigation (Thread · Logs · CI)<br>• Create ThreadView, MessageBubble, MarkdownRenderer |
| **4**  | History replay & polish        | • `/history` endpoint + pagination<br>• Hydrate on load<br>• Keyboard shortcuts ⌘/Ctrl+1/2, virtual scroll   |

---

## 5️⃣ Log-Parsing Spec (MVP ⟶ production)

### 5.1 Log format

- **File**: `${DATA_DIR}/{sessionId}/amp.log`
- **Encoding**: UTF-8 JSONL (one object per line).

| Field        | Purpose                                          |
| ------------ | ------------------------------------------------ |
| `level`      | Log severity (ignored for chat)                  |
| `message`    | Quick type hint e.g. `"marked output"`           |
| `timestamp`  | ISO-8601 (canonical order)                       |
| `event`      | Structured agent events (thread-state, message…) |
| `pipedInput` | User prompt piped to `continue`                  |
| `out`        | Assistant text attached to `"marked output"`     |

Parser rules (AmpLogParser):

1. Route by `event.type` or shortcut fields (`pipedInput`, `out`).
2. Emit **ThreadMessage** objects (`assistant`, `user`, `tool`, `system`).
3. Deduplicate via stable SHA-256 of role|timestamp|content.
4. Broadcast new messages over WS and index for `/history`.

### 5.2 ThreadMessageDTO

```jsonc
{
  "id": "msg_ab12cd34",
  "type": "assistant" | "user" | "tool" | "system",
  "content": "string",
  "timestamp": "2025-06-17T21:55:26.123Z",
  "metadata": { "type": "thinking" | "tool_use", "...": "..." }
}
```

### 5.3 API surface

| Path / channel               | Direction | Purpose                                  |
| ---------------------------- | --------- | ---------------------------------------- |
| `GET /sessions/{id}/history` | S→C       | Paginated past messages                  |
| `WS /sessions/{id}/chat`     | C↔S       | Push new ThreadMessage · send user input |

---

## 6️⃣ Thread Tab Implementation Guide

### 6.1 Component tree

```
TaskDetail (page)
├── TaskTabs  (Thread · Logs · CI)
└── ThreadView
    ├── MessageBubble  (role-themed)
    └── MarkdownRenderer
```

### 6.2 Core components

| Component            | File                                     | Highlights                                                                                                                         |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **TaskTabs**         | `src/components/task/TaskTabs.tsx`       | Tab array → `<a>` list with icons (`MessageSquare`, `Terminal`, `Zap`); border-bottom on active; responsive hover                  |
| **ThreadView**       | `src/components/task/ThreadView.tsx`     | Auto-scroll to anchor on new msg; connection banner (pulse dot); loading & empty states; fixed input bar; `Cmd/Ctrl+Enter` to send |
| **MessageBubble**    | `src/components/task/MessageBubble.tsx`  | Role map → icon, label, colors; relative timestamps (“2m ago”); metadata badges (exit code, files changed, error); avatar circle   |
| **MarkdownRenderer** | `src/components/ui/MarkdownRenderer.tsx` | `react-markdown` + `react-syntax-highlighter`; copy-on-hover for code blocks; VS Code Dark Plus theme; responsive tables           |

### 6.3 Role-based styles

| Role   | Bubble                       | Accent             | Icon       |
| ------ | ---------------------------- | ------------------ | ---------- |
| user   | `bg-blue-50` / dark `900/20` | `text-blue-600`    | `User`     |
| amp    | `bg-emerald-50` / `900/20`   | `text-emerald-600` | `Bot`      |
| system | `bg-gray-50` / `800/20`      | `text-gray-600`    | `Settings` |

### 6.4 ThreadMessage interface

```typescript
interface ThreadMessage {
  id: string;
  role: "user" | "amp" | "system" | "tool";
  content: string;
  ts: string; // ISO date
  metadata?: {
    type?: "thinking" | "tool_use" | "error" | "file_change";
    files?: string[];
    exitCode?: number;
    tool_name?: string;
  };
}
```

### 6.5 UX details

- **Auto-scroll**: `useEffect` scrolls `messagesEndRef` into view on append.
- **Keyboard**: `Cmd/Ctrl+Enter` sends; textarea auto-focus on mount.
- **Connection toast**: yellow bar with pulsing dot until WS `open`.
- **Virtual scroll**: planned for >500 messages (use `react-virtual`).
- **Accessibility**: ARIA labels on tabs, buttons; role-announcements for new msgs.
- **Dark mode**: Tailwind `dark:` variants on all colors.

### 6.6 Dependencies

```json
"react-markdown": "^8",
"react-syntax-highlighter": "^15.5",
"lucide-react": "^0.200",
"@tanstack/react-query": "^5"   // optional for data fetching
```

---

## 7️⃣ Definition of Done

| #   | Acceptance Criterion                                                                                |
| --- | --------------------------------------------------------------------------------------------------- |
| 1   | Creating a session stores `thread.id` and initialises **empty** `amp.log`.                          |
| 2   | Session page shows tabs; **Terminal** default, **Thread** loads on click (≤ 50 ms).                 |
| 3   | Sending text in Thread tab triggers `amp threads continue …`; user message also echoes in Terminal. |
| 4   | Assistant reply streams token-by-token into Thread within ≤ 200 ms.                                 |
| 5   | Refresh or container restart reloads full thread from `amp.log`; no duplicates.                     |
| 6   | Auto-scroll works, but user scroll-lock disables it until bottom reached.                           |
| 7   | Keyboard shortcuts: ⌘/Ctrl+Enter to send, ⌘/Ctrl+1/2 to switch tabs.                                |
| 8   | Errors surface as toast notifications; no uncaught exceptions in server logs.                       |

---

## 8️⃣ Notes & Open Questions

1. **Storage** – JSONL good for now; evaluate SQLite index for faster “search chat”.
2. **Large logs** – server trims oldest messages and exposes _Load Earlier_.
3. **Security** – redact tokens / secrets in `amp.log`; inherit session ACL.
4. **Extensible tabs** – design TaskTabs so **Logs** & **CI** integrate with same patterns.

---

_End of Phase 3 PRD_ 🚀
