# Amplify POC — One-pager

## 1 Goal (this milestone)

> **Create an _ephemeral_ Docker container that mounts the current repo read-only, already has the `amp` CLI installed, and exposes a browser terminal that forwards commands to `amp` running inside the container.**

_Out of scope_: Git branch workflow, diff viewer, VS Code Remote, screenshots/OCR, metrics, multi-session orchestration.

---

## 2 Architecture

```
local shell           Amplify CLI (Node)           Container
┌──────────┐  build   ┌────────────────────┐ run   ┌──────────────┐
│  user    │ ───────▶ │  amplify (orch.)   │ ────▶ │ amplify-base │
└──────────┘          │  • builds image    │       │ • amp CLI    │
                      │  • runs container  │  WS   │ • /workspace │
┌─────────────────────┴────────────────────┴───────┴──────────────┐
│ Browser http://localhost:3000 ←→ WebSocket ←→ docker exec -it   │
│            (xterm.js)                                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3 Docker strategy

### 3.1 Static base image (`amplify-base`)

```Dockerfile
# Dockerfile.base
FROM ubuntu:24.04

# Minimal deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates curl git openssh-client \
        nodejs npm \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# --- AMP CLI ---
ENV AMP_VERSION=v0.5.2
RUN curl -sSfL https://raw.githubusercontent.com/sourcegraph/amp/main/install.sh \
    | bash -s -- --version "$AMP_VERSION" --skip-auth
ENV PATH="/root/.amp/bin:${PATH}"

# Optional Go toolchain for agent helpers
# RUN curl -sSfL https://go.dev/dl/go1.24.3.linux-amd64.tar.gz | tar -xz -C /usr/local

# Safety
RUN useradd -ms /bin/bash amplify
USER amplify
WORKDIR /workspace
```

Build once:

```bash
docker build -t amplify-base -f Dockerfile.base .
```

### 3.2 Per-session container

```bash
docker run --rm -it \
  --name amplify-$SESSION_ID \
  -e AMP_API_KEY="$AMP_API_KEY" \
  -v "$PWD":/workspace:ro \
  -p 0:22 -p 0:80 \
  amplify-base bash
```

- Bind-mount keeps host files safe.
- Amplify CLI uses `docker exec -it amplify-$SESSION_ID amp <cmd>` (or keeps an interactive bash PTY).

---

## 4 Amplify CLI responsibilities

| Task                  | Details                                                     |
| --------------------- | ----------------------------------------------------------- |
| **Image check**       | `docker image inspect amplify-base`; build/pull if missing. |
| **Run container**     | Command above; store container ID.                          |
| **Static web server** | Serve `/web` on `localhost:3000`; upgrade WS at `/term`.    |
| **WS bridge**         | Browser stdin → `docker exec`; stream stdout/stderr back.   |
| **Browser launch**    | Auto-open default browser.                                  |
| **Cleanup**           | On exit: `docker kill && docker rm`.                        |

---

## 5 Web UI (thin)

- Static HTML + **xterm.js** terminal.
- WS protocol:

  ```jsonc
  { "type": "stdin",  "data": "amp whoami\n" }
  { "type": "stdout", "data": "You are …" }
  { "type": "stderr", "data": "error text" }
  ```

- Resize: `{ "type": "resize", "cols": N, "rows": M }`.

---

## 6 Timeline

| Week | Deliverable                 | Key tasks                                        |
| ---- | --------------------------- | ------------------------------------------------ |
| 1    | **Dockerfile.base + image** | Write file, build, `amp whoami` smoke test.      |
| 2    | **Amplify CLI skeleton**    | Scaffold project, image check, container launch. |
| 3    | **WS terminal bridge**      | Add xterm.js page & WebSocket proxy.             |
| 4    | **Polish & docs**           | Ctrl-C cleanup, helpful errors, README.          |

---

## 7 Definition of Done

1. Run `npx amplify` from any git repo.
2. Browser appears in < 3 s.
3. `echo "create python script that adds two numbers" | amp` builds valid python script in docker container
4. Exiting CLI removes container (`docker ps` is clean).
5. Host repo never modified (mounted `:ro`).
