# Kwipu reference

Companion to [SKILL.md](SKILL.md). Every setting is read when a process starts — restart the affected process after changing one.

## Core configuration

| Variable | Default | Meaning |
|---|---|---|
| `KWIPU_ROOT_DIR` | repository directory | Base for default and relative data paths. |
| `KWIPU_LIVE_DIR` | — | Compatibility alias for `KWIPU_ROOT_DIR`; `KWIPU_ROOT_DIR` wins. |
| `KWIPU_KNOWLEDGE_DIR` | `knowledge_base` under root | Source document directory (read, never rewritten). |
| `KWIPU_STORAGE_DIR` | `storage_graph` under root | Generated index directory. |
| `KWIPU_LLM_MODEL` | `gpt-oss:20b-cloud` | Extraction + answer model. The default can execute in the cloud. |
| `KWIPU_MODEL_NAME` | — | Compatibility alias for `KWIPU_LLM_MODEL`; the latter wins. |
| `KWIPU_EMBED_MODEL` | `nomic-embed-text` | Embedding model for stored vectors. |
| `KWIPU_OLLAMA_BASE_URL` | `http://localhost:11434` | Absolute HTTP(S) Ollama endpoint. |
| `KWIPU_OLLAMA_TIMEOUT` | `300` s | Model-request timeout. |
| `KWIPU_STORAGE_LOCK_TIMEOUT` | `30` s | Wait limit for the shared storage lock. |
| `KWIPU_QUERY_MAX_LENGTH` | `4000` chars | Maximum normalized question length. |
| `KWIPU_MAX_SOURCE_BYTES` | `10485760` | Maximum source size for bridge expansion. |
| `KWIPU_ALLOW_INSECURE_REMOTE_OLLAMA` | disabled | Allows plaintext HTTP to a non-loopback host (`1`/`true`/`yes`/`on`). |

Non-loopback Ollama endpoints require HTTPS unless insecure HTTP is explicitly enabled for a trusted network. A remote endpoint sends data to that host.

Changing only the LLM keeps existing vectors loadable, though a later full rebuild can extract different relations. Changing the embedding model requires a new index.

## Bridge configuration

| Variable | Default | Meaning |
|---|---|---|
| `BRIDGE_HOST` | `127.0.0.1` | Bind address for `python -m bridge`. |
| `BRIDGE_PORT` | `8765` | Port, 1–65535. |
| `BRIDGE_CORS_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Browser origins; wildcards rejected. |
| `BRIDGE_ALLOWED_HOSTS` | `localhost,127.0.0.1,testserver` | Accepted `Host` values; wildcards rejected. |
| `BRIDGE_HEALTH_OLLAMA_TIMEOUT` | `2` s | Ollama timeout used by `/health`. |

The bridge also consumes every core setting. When invoking Uvicorn directly, pass host and port as CLI values:

```bash
uvicorn bridge.app:app --reload --host "$BRIDGE_HOST" --port "$BRIDGE_PORT"
```

## Frontend configuration

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE` | `/api` | Browser API base; relative values use the Vite proxy. |
| `VITE_BRIDGE_TARGET` | `http://127.0.0.1:8765` | Development proxy target. |

A production static deployment needs an equivalent reverse proxy or an absolute `VITE_API_BASE`, and direct browser access must match `BRIDGE_CORS_ORIGINS`.

## Bridge API

| Endpoint | Purpose |
|---|---|
| `GET /health` | Storage, configured models, and Ollama connectivity. |
| `GET /graph/snapshot` | Graph used by the 3D interface. |
| `POST /query` | Question → answer plus citations. |
| `GET /expand?node_id=<opaque-id>` | Read the cited source behind a graph node. |

Source expansion reads UTF-8 Markdown/text directly and extracts PDF/DOCX text without an LLM. Oversized input → `413`; unsupported format → `415`; invalid UTF-8 or failed extraction → `422`; transient source I/O → `503`.

## MCP server

Use absolute interpreter and script paths, and configure models through `env` — CLI flags do not reach the MCP server.

```json
{
  "mcpServers": {
    "kwipu": {
      "command": "/path/to/Kwipu/.venv/bin/python",
      "args": ["/path/to/Kwipu/kwipu_mcp_server.py"],
      "env": {
        "KWIPU_KNOWLEDGE_DIR": "/path/to/vault",
        "KWIPU_LLM_MODEL": "qwen2.5:7b",
        "KWIPU_EMBED_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

Tools: `query_graph(question)` → answer text; `query_graph_detailed(question)` → `{"answer": "...", "citations": [...]}` deduplicated by node ID. The server runs in fast retrieval mode, starts no watcher, and can build storage when it is absent.

## Index update behavior

| Filesystem change | Index action |
|---|---|
| Startup without storage | Full build |
| Only newly created files | Incremental insertion |
| Any modified file | One full rebuild for the batch |
| Any deleted file | One full rebuild for the batch |
| Event without a content-hash change | Ignored |

An editor's atomic save can look like delete + create and trigger a full rebuild. Persist operations stage a sibling generation, keep the previous one as a temporary backup, and publish atomically; consumers compare `storage_revision` and reload new generations on their own.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `python` / `ollama` / `node` / `npm` not recognized | Install it, open a new terminal, re-run its `--version`. |
| `Activate.ps1` is blocked | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then activate again. |
| `Ollama is not running` | Start the app or `ollama serve`; verify `http://localhost:11434/api/tags`. |
| `Missing model(s)` | Run the exact `ollama pull` commands Kwipu prints; indexer and bridge must name the same models. |
| `No files found. Waiting for documents...` | Put supported files under `KWIPU_KNOWLEDGE_DIR`; confirm the path in the CLI header. |
| Health `degraded` | Inspect `property_graph.detail`, `ollama.detail`, and the `models` list in `/health`. |
| Query `503` | Start the CLI first and wait for a successful build/load; check storage path, lock, embedding compatibility. |
| Query `502` | Bridge logs and Ollama availability — the query engine or model request failed. Do not paper over it with retries. |
| Query `400 Question is too long` | `KWIPU_QUERY_MAX_LENGTH` was overridden; set it before starting the bridge and restart. |
| Port `8765` / `5173` in use | Stop the other process or change bridge/Vite settings consistently. |
| Embedding-model mismatch | Stop all processes; restore the model that built storage, or move storage aside and let the CLI rebuild. Never remove the source directory. |

## Developer setup

```bash
python -m pip install --require-hashes -r requirements-dev.lock   # -windows.lock on Windows
python -m unittest discover -s tests -p "test_*.py" -v
npm --prefix frontend run typecheck && npm --prefix frontend run build
```

Regenerate dependency locks only from `requirements-dev.txt` via the workflow in the project's `CONTRIBUTING.md`, then review the whole diff.
