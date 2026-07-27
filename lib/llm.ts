/**
 * LLM provider layer — pick whatever free/available key is configured.
 *
 * Priority: Gemini (generous free tier) → NVIDIA NIM (free tier, OpenAI-compatible)
 * → OpenAI-compatible → Anthropic. If none is set, the caller falls back to the
 * deterministic engine. All calls are plain fetch — no SDK, small bundle, runs
 * anywhere (Vercel Node runtime).
 *
 * Set exactly one of these in your environment:
 *   GEMINI_API_KEY      (aistudio.google.com/apikey — free)
 *   NVIDIA_API_KEY      (build.nvidia.com — free tier)
 *   OPENAI_API_KEY      (+ optional OPENAI_BASE_URL for any compatible endpoint)
 *   ANTHROPIC_API_KEY
 */

export type Provider = "gemini" | "nvidia" | "openai" | "anthropic";

export function activeProvider(): Provider | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.NVIDIA_API_KEY) return "nvidia";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

interface CallOpts {
  system: string;
  user: string;
  maxTokens?: number;
  /** Ask the provider for strict JSON output where supported. */
  json?: boolean;
}

/** Run a completion on the active provider. Returns raw text (JSON string if json:true). */
export async function llmComplete(opts: CallOpts): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new Error("no LLM provider configured");
  switch (provider) {
    case "gemini":
      return callGemini(opts);
    case "nvidia":
      return callOpenAICompatible(opts, process.env.NVIDIA_API_KEY!, "https://integrate.api.nvidia.com/v1", process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct");
    case "openai":
      return callOpenAICompatible(opts, process.env.OPENAI_API_KEY!, process.env.OPENAI_BASE_URL || "https://api.openai.com/v1", process.env.OPENAI_MODEL || "gpt-4o-mini");
    case "anthropic":
      return callAnthropic(opts);
  }
}

async function callGemini({ system, user, maxTokens = 700, json }: CallOpts): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.2,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data: any = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
}

async function callOpenAICompatible(
  { system, user, maxTokens = 700, json }: CallOpts,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai-compatible ${res.status}`);
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic({ system, user, maxTokens = 700 }: CallOpts): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data: any = await res.json();
  return data?.content?.find((b: any) => b.type === "text")?.text ?? "";
}
