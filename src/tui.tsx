import React, { useState, useRef } from "react";
import { render, Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import { runAgent } from "./agent/agent";
import type { NeutralMessage } from "./providers/types";

type Line = { kind: "user" | "tool_call" | "tool_result" | "tool_error" | "text" | "done" | "system"; text: string };

function App() {
  const { exit } = useApp();
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const history = useRef<NeutralMessage[]>([]);

  const add = (line: Line) => setLines((p) => [...p, line]);

  const handleSubmit = async (value: string) => {
    const prompt = value.trim();
    if (!prompt || running) return;
    setQuery("");

    // slash commands which we do not sending to agent
    if (prompt.startsWith("/")) {
      const cmd = prompt.slice(1).split(" ")[0];
      if (cmd === "clear") { setLines([]); history.current = []; }
      else if (cmd === "exit" || cmd === "quit") exit();
      else if (cmd === "help") add({ kind: "system", text: "/clear  /help  /exit  —  baaki kuch bhi = agent ka task" });
      else add({ kind: "system", text: `Unknown command: ${prompt}` });
      return;
    }

    add({ kind: "user", text: prompt });
    setRunning(true);
    try {
      await runAgent(prompt, (e) => {
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
      {running ? (
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