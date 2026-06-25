import React, { useState, useRef } from "react";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import { render, Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { runAgent } from "./agent/agent";
import type { NeutralMessage } from "./providers/types";
import { approve, deny } from "./agent/approval";
import { load_config, save_config } from "./config/config";
import catalog from "./model.json";

type Line = { kind: "user" | "tool_call" | "tool_result" | "tool_error" | "text" | "done" | "system"; text: string };

function hasKey(): boolean {
  if (process.env.GEMINI_API_KEY || process.env.HARNESS_API_KEY) return true;
  try {
    const cfg: any = load_config();
    const p = cfg?.defaultProvider;
    return !!(p && cfg?.providers?.[p]?.apiKey);
  } catch {
    return false;
  }
}

const ART = [
  "██╗  ██╗ █████╗ ██████╗ ███╗   ██╗███████╗███████╗███████╗",
  "██║  ██║██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔════╝██╔════╝",
  "███████║███████║██████╔╝██╔██╗ ██║█████╗  ███████╗███████╗",
  "██╔══██║██╔══██║██╔══██╗██║╚██╗██║██╔══╝  ╚════██║╚════██║",
  "██║  ██║██║  ██║██║  ██║██║ ╚████║███████╗███████║███████║",
  "╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝╚══════╝",
].join("\n");

function Banner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Gradient name="vice">{ART}</Gradient>

      <Box marginTop={1}>
        <Gradient colors={["#06B6D4", "#3B82F6", "#9D35DE"]}>
          <Text bold>Your AI engineer in the terminal.</Text>
        </Gradient>
      </Box>
    </Box>
  );
}

function App() {
  const { exit } = useApp();
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const history = useRef<NeutralMessage[]>([]);
  const [approvalCommand, setApprovalCommand] = useState<string | null>(null);

  const [needsKey, setNeedsKey] = useState(!hasKey());
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");

  const [selectingModel, setSelectingModel] = useState(false);
  const [modelItems, setModelItems] = useState<{ label: string; value: string }[]>([]);

  const add = (line: Line) => setLines((p) => [...p, line]);

  useInput((input) => {
    if (!approvalCommand) return;
    if (input.toLowerCase() === "y") { approve(); setApprovalCommand(null); }
    if (input.toLowerCase() === "n") { deny(); setApprovalCommand(null); }
  });

  const saveKey = (value: string) => {
    const key = value.trim();
    if (!key) return;
    if (key.length < 10 || /\s/.test(key)) {
      setKeyError("That doesn't look like a valid API key. Please try again.");
      setKeyInput("");
      return;
    }
    setKeyError("");
    const cfg: any = (() => { try { return load_config() ?? {}; } catch { return {}; } })();
    cfg.providers = cfg.providers ?? {};
    cfg.defaultProvider = "gemini";
    cfg.providers.gemini = {
      apiKey: key,
      model: cfg.providers.gemini?.model ?? "gemini-2.5-flash",
    };
    save_config(cfg);
    setNeedsKey(false);
    add({ kind: "system", text: "API key saved. You're all set — enter a task to begin." });
  };

  const onModelSelect = (item: { label: string; value: string }) => {
    const cfg: any = load_config();
    const provider = cfg.defaultProvider;
    if (provider && cfg.providers[provider]) {
      cfg.providers[provider].model = item.value;
      save_config(cfg);
      add({ kind: "system", text: `Model set to ${item.value}.` });
    }
    setSelectingModel(false);
  };

  const handleSubmit = async (value: string) => {
    const prompt = value.trim();
    if (!prompt || running) return;
    setQuery("");

    if (prompt.startsWith("/")) {
      const cmd = prompt.slice(1).split(" ")[0];
      if (cmd === "clear") { setLines([]); history.current = []; }
      else if (cmd === "exit" || cmd === "quit") exit();
      else if (cmd === "help") add({ kind: "system", text: "/login  set API key   ·   /logout  remove key   ·   /model  switch model   ·   /clear  clear screen   ·   /exit  quit. Anything else = a task for the agent." });
      else if (cmd === "login") { setNeedsKey(true); setKeyInput(""); setKeyError(""); }
      else if (cmd === "logout") {
        try {
          const cfg: any = load_config() ?? {};
          const p = cfg.defaultProvider;
          if (p && cfg.providers?.[p]) { delete cfg.providers[p].apiKey; save_config(cfg); }
        } catch { /* ignore */ }
        history.current = [];
        setLines([]);
        setKeyInput("");
        setNeedsKey(false); 
        add({ kind: "system", text: "Logged out. API key removed. Run /login to add one again." });
      }
      else if (cmd === "model") {
        const cfg: any = load_config();
        const provider = cfg.defaultProvider;
        if (!provider) { add({ kind: "system", text: "No API key set. Run /login first." }); return; }
        const models: string[] = (catalog as any)[provider] ?? [];
        if (!models.length) { add({ kind: "system", text: `No models configured for ${provider}.` }); return; }
        const current = cfg.providers[provider]?.model;
        setModelItems(models.map((m) => ({ label: m === current ? `${m}  (current)` : m, value: m })));
        setSelectingModel(true);
      }
      else add({ kind: "system", text: `Unknown command: ${prompt}  (try /help)` });
      return;
    }

    add({ kind: "user", text: prompt });
    setRunning(true);
    try {
      await runAgent(prompt, (e) => {
        if (e.type === "approval_request") setApprovalCommand(e.command);
        if (e.type === "tool_call") add({ kind: "tool_call", text: e.name });
        if (e.type === "tool_result") {
          const failed = typeof e.result === "string" && e.result.startsWith("Error");
          add({ kind: failed ? "tool_error" : "tool_result", text: e.name });
        }
        if (e.type === "text") add({ kind: "text", text: e.text });
        if (e.type === "done") add({ kind: "done", text: e.text });
      }, history.current);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (/401|403|unauthenticated|API_KEY_INVALID|permission.?denied|api[_. ]?key/i.test(msg)) {
        add({ kind: "tool_error", text: "Your API key looks invalid or missing. Run /login to update it." });
      } else {
        add({ kind: "done", text: `Error: ${msg}` });
      }
    } finally {
      setRunning(false);
    }
  };

  // --- onboarding screen (no key yet) ---
  if (needsKey) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Banner />
        <Box marginTop={1}><Text>Welcome! Enter your Gemini API key to get started.</Text></Box>
        <Text dimColor>Get a free key at https://aistudio.google.com/apikey</Text>
        <Box marginTop={1}>
          <Text color="cyan">API key ❯ </Text>
          <TextInput value={keyInput} onChange={setKeyInput} onSubmit={saveKey} mask="*" />
        </Box>
        {keyError ? <Box marginTop={1}><Text color="red">✗ {keyError}</Text></Box> : null}
        <Box marginTop={1}><Text dimColor>Your key is stored locally. You can remove it anytime with /logout.</Text></Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Banner />
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>Type a task to begin.  Commands: </Text>
        <Text color="cyan">/login  /logout  /model  /clear  /help  /exit</Text>
      </Box>

      {lines.map((l, i) => {
        if (l.kind === "user") return <Text key={i} color="cyan">❯ {l.text}</Text>;
        if (l.kind === "tool_call") return <Text key={i} color="yellow">→ {l.text}</Text>;
        if (l.kind === "tool_result") return <Text key={i} color="green">✓ {l.text}</Text>;
        if (l.kind === "text") return <Text key={i} dimColor>{l.text}</Text>;
        if (l.kind === "done") return <Text key={i}>● {l.text}</Text>;
        if (l.kind === "system") return <Text key={i} color="magenta">{l.text}</Text>;
        if (l.kind === "tool_error") return <Text key={i} color="red">✗ {l.text}</Text>;
        return null;
      })}

      {selectingModel ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">Select a model (use ↑↓ and Enter):</Text>
          <SelectInput items={modelItems} onSelect={onModelSelect} />
        </Box>
      ) : approvalCommand ? (
        <Box borderStyle="round" borderColor="yellow" flexDirection="column" padding={1} marginTop={1}>
          <Text color="yellow" bold>Approval required</Text>
          <Text>{approvalCommand}</Text>
          <Text dimColor>Press Y to approve, N to deny.</Text>
        </Box>
      ) : running ? (
        <Box flexDirection="column">
          <Text color="gray"><Spinner type="dots" /> Thinking…</Text>
          <Text dimColor>(type /exit anytime to quit)</Text>
        </Box>
      ) : (
        <Box>
          <Text color="cyan">❯ </Text>
          <TextInput value={query} onChange={setQuery} onSubmit={handleSubmit} />
        </Box>
      )}
    </Box>
  );
}

render(<App />);
