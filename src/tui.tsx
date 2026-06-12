import React, { useState, useRef } from "react";
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

function App() {
  const { exit } = useApp();
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const history = useRef<NeutralMessage[]>([]);
  const [approvalCommand, setApprovalCommand] = useState<string | null>(null);
  const [selectingModel, setSelectingModel] = useState(false);  // model picker state 
  const [modelItems, setModelItems] = useState<{ label: string; value: string }[]>([]);

  const add = (line: Line) => setLines((p) => [...p, line]);

  useInput((input) => {
    if (!approvalCommand) return;
    if (input.toLowerCase() === "y") { approve(); setApprovalCommand(null); }
    if (input.toLowerCase() === "n") { deny(); setApprovalCommand(null); }
  });

  // user picked a model from the list
  const onModelSelect = (item: { label: string; value: string }) => {
    const cfg = load_config();
    const provider = cfg.defaultProvider;
    if (provider && cfg.providers[provider]) {
      cfg.providers[provider].model = item.value;
      save_config(cfg);
      add({ kind: "system", text: `Model set to ${item.value}` });
    }
    setSelectingModel(false);
  };

  const handleSubmit = async (value: string) => {
    const prompt = value.trim();
    if (!prompt || running) return;
    setQuery("");

    // slash commands (not sent to the agent)
    if (prompt.startsWith("/")) {
      const cmd = prompt.slice(1).split(" ")[0];
      if (cmd === "clear") { setLines([]); history.current = []; }
      else if (cmd === "exit" || cmd === "quit") exit();
      else if (cmd === "help") add({ kind: "system", text: "/model  /clear  /help  /exit  —  baaki kuch bhi = agent ka task" });
      else if (cmd === "model") {
        // open the radio picker for the current provider's models
        const cfg = load_config();
        const provider = cfg.defaultProvider;
        if (!provider) { add({ kind: "system", text: "Please Login First: `harness providers login`" }); return; }
        const models: string[] = (catalog as any)[provider] ?? [];
        if (!models.length) { add({ kind: "system", text: `No models listed for ${provider} in model.json` }); return; }
        const current = cfg.providers[provider]?.model;
        setModelItems(models.map((m) => ({ label: m === current ? `${m}  (current)` : m, value: m })));
        setSelectingModel(true);
      }
      else add({ kind: "system", text: `Unknown command: ${prompt}` });
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
      add({ kind: "done", text: `Error: ${err.message}` });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      {approvalCommand && (
        <Box borderStyle="round" flexDirection="column" padding={1} marginBottom={1}>
          <Text color="yellow">⚠ Approval Required</Text>
          <Text>{approvalCommand}</Text>
          <Text>Press Y to approve · N to deny</Text>
        </Box>
      )}

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
          <Text color="cyan">Select a model (↑↓ then Enter):</Text>
          <SelectInput items={modelItems} onSelect={onModelSelect} />
        </Box>
      ) : approvalCommand ? null : running ? (
        <Text color="gray"><Spinner type="dots" /> thinking…</Text>
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
