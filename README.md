# harnessCLI

> Harness a language model into a coding agent that lives in your terminal.

**harnessCLI** wraps an LLM in a small agent loop and a handful of safe tools (read, edit, create files, run allowlisted commands), so it can explore a codebase and make changes — all from the command line. It has both a one-shot CLI mode and an interactive TUI.

![harnessCLI demo](demo.gif)

The name says it: this is the *harness* around the model — intentionally small and hackable, a project you can read end to end, not a black box.

---

## Features

- **Agent loop** — the model thinks, calls tools, reads results, and keeps going until the task is done (with a step limit).
- **Interactive TUI** — type a task, watch tool calls and results stream live, with conversation memory and slash commands (`/clear`, `/help`, `/exit`).
- **Provider-agnostic core** — the agent talks a neutral message format; each provider is a small adapter. Gemini is supported today; OpenAI / Anthropic are a single adapter file away.
- **File tools** — `read_file`, `list_file`, `file_exists`, `edit_file`, `write_file`.
- **Sandboxed command execution** — `run_command` runs only allowlisted commands, with no shell, a timeout, and output caps.
- **Simple config** — log in once; your provider, key, and model persist in your home directory and work from any project.

---

## Requirements

- [Bun](https://bun.sh) (v1.0+)
- An API key for a supported provider (e.g. a Google Gemini key from Google AI Studio)

---

## Install

```bash
git clone https://github.com/vaishnavisapkale/harness-cli.git
cd harnessCLI
bun install
```

Build a standalone binary named `harness` and put it on your PATH:

```bash
bun build ./src/cli.ts --compile --outfile harness
mv harness /usr/local/bin/harness
```

(During development you can skip the build and run with `bun src/cli.ts <command>`)

---

## Quick start

```bash
# 1. Log in to a provider (run in your shell, not the TUI)
harness providers login -p gemini -a YOUR_GEMINI_KEY

# 2. (optional) pick a model
harness models

# 3a. One-shot mode
harness agent -p "read package.json and list the dependencies"

# 3b. Interactive TUI
harness
```

---

## Commands

### `providers`
```bash
providers login  -p <name> -a <api-key>   # store key, set as default
providers logout -p <name>                # remove a provider's key
providers list                            # show logged-in providers
```

### `models`
```bash
models                  # list models for the active provider
models use <model>      # set the model for the active provider
```

### `agent`
```bash
agent -p "<prompt>"     # one-shot task
```

### TUI
```bash
harness                 # launch the interactive agent
```
Inside the TUI, plain text is a task for the agent; `/`-prefixed input is a command (`/clear`, `/help`, `/exit`).

---

## How it works

1. `cli.ts` routes your command (or launches the TUI).
2. `resolveSession()` reads your saved config and the model catalog (`model.json`) and produces a clean `{ provider, model, apiKey }`.
3. `runAgent()` runs a loop in a neutral message format, emitting events. Each turn it asks the provider adapter to generate; the adapter translates to/from the provider's SDK.
4. When the model requests tools, `runTool()` executes them behind guardrails and feeds the results back. The loop continues until the model gives a final answer or hits the step limit.

So `model.json` says *what's allowed*, your config says *what you picked*, and the agent only ever sees the resolved result.

---

## Project structure

```
src/
  cli.ts              # entry — registers commands, launches TUI
  tui.tsx             # interactive terminal UI (Ink)
  types.ts            # config types (AppConfig, ProviderConfig)
  tools.ts            # tool definitions + runTool (with guardrails)
  model.json          # the catalog: provider -> [models]
  config/config.ts    # load/save config in the home directory
  commands/           # CLI command definitions
  providers/          # LLM adapters (neutral <-> SDK) + registry
  agent/              # runAgent loop + resolveSession
```

---

## Safety

Every tool that touches the real world runs behind a guardrail, checked before the action:

- File operations are restricted to the current project directory.
- `write_file` refuses to overwrite an existing file (use `edit_file` instead).
- `run_command` rejects shell metacharacters, allows only an allowlist of verification commands, runs with no shell, and enforces a timeout.

If a check fails, the tool returns an error instead of acting — the agent reads it and adjusts.

---

## Adding a provider

1. Create `src/providers/<name>.ts` implementing the `Provider` interface.
2. Register it in `src/providers/index.ts`.
3. Add its models to `model.json`.

`runAgent`, `resolveSession`, and the CLI stay unchanged.

---

## Roadmap

- [ ] OpenAI and Anthropic adapters
- [ ] Streaming token output in the TUI
- [ ] Per-command confirmation for `run_command`
- [ ] More slash commands (`/model`, `/login`)

---

## License

MIT — see [LICENSE](./LICENSE).
