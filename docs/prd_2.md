# Amplify Phase 2 — Product Requirements Document (PRD)

## 1️⃣ Goal

Deliver a **web-first launcher for controlled AI-agent coding sessions**:

1. User opens `http://localhost:3000` (no CLI).
2. Signs in with GitHub.
3. Fills **Initial Prompt + Repository + Branch** form and clicks **Create**.
4. Amplify clones the repo (full history) into a fresh Docker container, injects the prompt via `echo "<prompt>" | amp`, and streams a terminal to the browser.
5. User can resume, view diffs, and terminate sessions from a dashboard.

---

## 2️⃣ Scope

| Theme                                            | Capability                                                           | Status  |
| ------------------------------------------------ | -------------------------------------------------------------------- | ------- |
| GitHub OAuth login                               | Minimal scopes: `repo`, `read:org`; token stored in HTTP-only cookie | **IN**  |
| Repo & branch picker                             | Auto-complete from GitHub API                                        | **IN**  |
| Initial prompt box                               | Inject prompt into `amp` at session start                            | **IN**  |
| Session dashboard                                | List / resume / delete running sessions; idle expiry                 | **IN**  |
| Writable Git workflow                            | OverlayFS workspace; full-history clone; commit/push enabled         | **IN**  |
| Diff viewer                                      | Monaco side-by-side view; commit & push from UI                      | **IN**  |
| VS Code Remote, metrics, deep security hardening | —                                                                    | **OUT** |

---

## 3️⃣ Architecture

```
Browser SPA (React)
 ├─ /login      → GitHub OAuth
 ├─ /create     → Prompt + Repo + Branch form
 ├─ /term/{id}  → xterm.js via WS
 ├─ /diff/{id}  → Monaco diff viewer
 └─ /sessions   → Dashboard
       ▲  REST / WS
       │
Node/TS Controller (local service)
 ├─ POST /sessions  – clone, docker run, echo prompt
 ├─ GET  /sessions  – list
 ├─ WS   /sessions/{id}/term – terminal bridge
 ├─ GET  /repos, /branches   – GitHub API proxy
 └─ TTL cleanup job
Docker Engine
 └─ amplify-base container (Ubuntu 24.04 + amp)
      • /workspace ← full-history clone (writable)
      • amp CLI
```

_Assumptions_: Docker and Node are pre-installed on the host.

---

## 4️⃣ Implementation Roadmap (6 weeks)

| Sprint | Deliverable                      | Key Tasks                                                                |
| ------ | -------------------------------- | ------------------------------------------------------------------------ |
| **1**  | GitHub OAuth & Repo API          | `/auth/github`, token storage; `/repos`, `/branches`; React login flow   |
| **2**  | Session API & Container Launcher | `/sessions` POST; full clone; overlayfs; prompt injection; TTL sweeper   |
| **3**  | Create Form & Terminal View      | React form, validation, terminal WS hookup, loading states               |
| **4**  | Session Dashboard                | List/resume/delete UI; backend filters by user; idle timer               |
| **5**  | Diff Viewer & Commit             | Monaco diff, approve → `git add/commit/push`; PR link generation         |
| **6**  | Polish & Docs                    | Error boundaries, UX tweaks, README & quick-start, light security checks |

---

## 5️⃣ Definition of Done

| #   | Acceptance Criterion                                                                               |
| --- | -------------------------------------------------------------------------------------------------- |
| 1   | Visiting root URL shows GitHub login; OAuth sets HTTP-only cookie                                  |
| 2   | “Create Session” blocks **Create** until prompt, repo, and branch are filled                       |
| 3   | **Create** → terminal appears in < 5 s; first output is agent response to injected prompt          |
| 4   | Edits persist; `git log` inside container shows commits                                            |
| 5   | **Diff** view accurately displays changes and allows commit/push                                   |
| 6   | **Sessions** page lists active sessions with idle countdown; user can resume or delete any session |
