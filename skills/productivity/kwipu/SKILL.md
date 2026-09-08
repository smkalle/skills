---
name: kwipu
description: Set up, run, and query Kwipu — a property-graph RAG index over a folder of Markdown/PDF/DOCX notes (Obsidian vaults included), via terminal CLI, read-only HTTP bridge, 3D web UI, or MCP server. Use when the user mentions Kwipu, geode_graph.py, or wants grounded, cited answers over their own notes/vault with a local or Ollama-backed graph RAG.
---

# Kwipu

Kwipu turns a document folder into a persisted property graph you can query with citations. One writer (the CLI), several read-only consumers (bridge, frontend, MCP).

```text
Documents (.md/.txt/.pdf/.docx)
  → structural extraction (wikilinks, frontmatter) + LLM relation extraction
  → persisted property graph + vectors (shared storage, revision manifest)
  → synonym* + vector + BM25 + temporal retrieval
  → grounded LLM answer with citations      (*off in --fast, MCP, bridge)
```

## Decide first: cloud or local

The default LLM `gpt-oss:20b-cloud` forwards chunks and questions to the model provider. **Ask the user before indexing anything sensitive.** Local-only means an installed local model (e.g. `qwen2.5:7b`) *and* a loopback Ollama endpoint. Embeddings (`nomic-embed-text`) are local either way.

## Set up

Prereqs: Git, Python 3.12+, Ollama, plus Node/npm only for the web UI.

```bash
git clone https://github.com/benmaster82/Kwipu.git && cd Kwipu
python3.12 -m venv .venv && source .venv/bin/activate
python -m pip install --upgrade pip==25.1.1
python -m pip install -r bridge/requirements.txt   # terminal-only: requirements.txt
npm --prefix frontend ci                            # web UI only
ollama pull nomic-embed-text && ollama pull gpt-oss:20b-cloud   # or qwen2.5:7b
```

Config is read from env vars **at process start**, so export the same block in every shell (indexer, bridge) and repeat it in the MCP `env` — CLI flags configure only `geode_graph.py`:

```bash
export KWIPU_ROOT_DIR="$PWD"
export KWIPU_KNOWLEDGE_DIR="knowledge_base"      # or an absolute vault path
export KWIPU_STORAGE_DIR="storage_graph"         # must not nest inside the source dir
export KWIPU_EMBED_MODEL="nomic-embed-text"
export KWIPU_LLM_MODEL="gpt-oss:20b-cloud"       # exactly one LLM
export KWIPU_OLLAMA_BASE_URL="http://localhost:11434"
```

On Windows PowerShell use `$env:NAME = "value"`, `py -3.12`, and `.\.venv\Scripts\Activate.ps1`.

## Run

Start in this order and leave each process running:

1. `ollama serve` — unless the desktop app already runs it.
2. `python geode_graph.py --fast` — builds/loads the graph, watches the folder, and **is a complete interface**: type questions at `>`, `exit` to quit. Wait for `Graph built and saved successfully.` (or `Graph loaded successfully.`). Drop `--fast` to add the per-query LLM synonym retriever.
3. `python -m bridge` — read-only API on `127.0.0.1:8765`. Check `GET /health` shows `status`, `property_graph.status`, and `ollama.status` all `ok`.
4. `npm --prefix frontend run dev` — 3D UI at `http://localhost:5173`.

Steps 3–4 are optional; stop after 2 for terminal-only use.

## Query well

Ask questions the graph can ground: entities, roles, decisions, and change over time — `Who works on Project Alpha, and what are their roles?`, `What decisions were made in the January 15 meeting?`, `How did Project Alpha change between the two meetings?`. Always surface the returned citations; an answer without them is unverified. Over MCP, prefer `query_graph_detailed(question)` (returns `{"answer", "citations"}`) over `query_graph(question)`.

## Rules that prevent data loss

- Run **one** CLI watcher per storage directory. The CLI is the only writer.
- Never touch `storage_graph`, `.storage_graph.staging`, `.storage_graph.backup`, or the sibling lock while a process is running.
- Keep source and generated storage in separate trees — Kwipu rejects overlapping layouts.
- Changing `KWIPU_EMBED_MODEL` invalidates the index: move storage aside and rebuild. Never delete the source documents.
- The bridge returns `503` until the CLI has published storage — start the CLI first.

See [REFERENCE.md](REFERENCE.md) for the full configuration tables, bridge/MCP contracts, rebuild triggers, and troubleshooting.
