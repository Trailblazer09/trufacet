// Pluggable LLM client.
//
// Default provider is Groq (free, no credit card: https://console.groq.com).
// Anthropic is supported as an optional, paid alternative — it is never
// required and is off unless LLM_PROVIDER=anthropic is set.
//
// Both providers expose the same `chat()` signature so the rest of the
// app doesn't know or care which one is active.

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface LlmResult {
  text: string;
  model: string;
}

export interface LlmClient {
  name: string;
  available: boolean;
  chat(messages: ChatMessage[], opts?: { json?: boolean }): Promise<LlmResult>;
}

export function getClient(): LlmClient {
  const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();
  if (provider === "anthropic") return anthropicClient();
  return groqClient();
}

// ── Groq (default, free) ────────────────────────────────────────
function groqClient(): LlmClient {
  const key = process.env.GROQ_API_KEY || "";
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  return {
    name: `groq:${model}`,
    available: Boolean(key),
    async chat(messages, opts) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 600,
          ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Groq request failed (${res.status}): ${detail.slice(0, 300)}`);
      }
      const data = await res.json();
      return { text: data.choices?.[0]?.message?.content ?? "", model };
    },
  };
}

// ── Anthropic (optional, paid) ──────────────────────────────────
function anthropicClient(): LlmClient {
  const key = process.env.ANTHROPIC_API_KEY || "";
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  return {
    name: `anthropic:${model}`,
    available: Boolean(key),
    async chat(messages, opts) {
      const system = messages.find((m) => m.role === "system")?.content;
      const user = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n\n");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 600,
          ...(system ? { system } : {}),
          messages: [
            {
              role: "user",
              content: opts?.json ? `${user}\n\nRespond with a single JSON object only.` : user,
            },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Anthropic request failed (${res.status}): ${detail.slice(0, 300)}`);
      }
      const data = await res.json();
      return { text: data.content?.[0]?.text ?? "", model };
    },
  };
}
