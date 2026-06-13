# harnessCLI

> Your AI engineer in the terminal.

**harness** is an AI coding agent that reads, writes and edits your files and runs commands to finish real tasks — right where you work. No browser tabs, no copy-paste. Just tell it what you want.

<p align="left">
  <a href="https://www.npmjs.com/package/harness-terminal"><img alt="npm" src="https://img.shields.io/npm/v/harness-terminal?color=b65cff&label=npm"></a>
  <a href="https://github.com/vaishnavisapkale/harness-cli/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-5cc8ff"></a>
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-5fe39b">
</p>

🌐 **[Live site](https://vaishnavisapkale.github.io/harness-cli/)** · 📦 **[npm](https://www.npmjs.com/package/harness-terminal)**

---

## Install

```bash
npm i -g harness-terminal
```

Then just run:

```bash
harness
```

Or try it once without installing:

```bash
npx harness-terminal
```

---

## Quickstart

1. **Install** it globally (above).
2. **Add your key** — run `harness` and paste your Gemini API key when asked. Grab a free one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). It's stored locally on your machine.
3. **Just ask** — type a task in plain English and let it work:

```
❯ add a /health route to server.ts that returns { ok: true }
```

harness explores your project, edits the files, runs your tests, and reports back.

---

## What it does

- **Works in your repo** — reads, writes and edits files and runs shell commands across your project to actually finish the task, not just suggest snippets.
- **Asks before risky moves** — destructive commands like `rm` pause for your `Y / N` approval. Nothing dangerous runs behind your back.
- **Switch models live** — pick your model from inside the agent with `/model`. Starts on Gemini `2.5-flash` (fast and cheap).
- **Bring your own key** — your Gemini key, stored locally. You pay your own usage, no middleman.
- **Chat or one-shot** — work interactively in the TUI, or fire a single headless task from any script.
- **Resilient** — automatic retries with backoff when the model is busy, plus conversation trimming so long sessions don't blow the context window.

---

## Usage

### Interactive (TUI)

```bash
harness
```

Inside the session you can use these commands:

| Command | What it does |
|---------|--------------|
| `/login` | Set or update your API key |
| `/logout` | Remove your stored API key |
| `/model` | Switch between available models |
| `/clear` | Clear the screen |
| `/help` | Show available commands |
| `/exit` | Quit |

Anything else you type is treated as a task for the agent.

### Headless (one-shot)

Run a single task without the UI — handy for scripts:

```bash
harness agent -p "add tests for utils.ts"
```

---

## How it works

harness runs an **agent loop**: it sends your task to the model along with a set of tools, the model decides which tool to call, harness runs it and feeds the result back, and the loop continues until the task is done.

**Tools available to the agent:**

| Tool | Purpose |
|------|---------|
| `read_file` | Read a file's contents |
| `list_file` | List files in a directory |
| `file_exists` | Check whether a path exists |
| `edit_file` | Make a precise, unique-match edit |
| `write_file` | Create or overwrite a file |
| `bash` | Run a shell command |

**Safety:** every potentially destructive shell command (`rm`, `git reset --hard`, `chmod -R`, and more) is caught and held at an approval gate — it only runs after you press `Y`. Deny it and the agent moves on without retrying.

---

## Configuration

Your key and model preference are saved to a config file in your home directory. You never need to edit it by hand — `/login`, `/logout` and `/model` manage it for you.

You can also point harness at a key via environment variable:

```bash
export GEMINI_API_KEY="your-key-here"
```

**Models:** `gemini-2.5-flash` (default) and `gemini-2.5-pro`.

---

## Development

harness is built with **TypeScript** and runs on **[Bun](https://bun.sh)**.

```bash
# clone
git clone https://github.com/vaishnavisapkale/harness-cli.git
cd harness-cli

# install deps
bun install

# run from source
bun src/cli.ts

# build the distributable
bun run build
```

---

## Built with

- **TypeScript** + **Bun** — runtime and tooling
- **[Ink](https://github.com/vadimdemedes/ink)** — React for the terminal UI
- **Gemini** (`@google/genai`) — the model behind the agent
- **commander** — CLI argument parsing

> Benchmarked on **Terminal-Bench 2.0** via a custom Python/Harbor adapter.

---

## License

MIT © [Vaishnavi Sapkale](https://github.com/vaishnavisapkale)
