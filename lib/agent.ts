/**
 * Decline Doctor — the diagnosis agent.
 *
 * Design principle (the part that matters): the LLM does *perception* —
 * reading a messy gateway response and classifying it. The deterministic
 * TAXONOMY does *decisioning* — whether a retry is safe, the strategy, the
 * backoff. The model can never talk the system into auto-retrying a hard/fraud
 * decline, because the action is looked up from the taxonomy by category, not
 * generated. A verification pass then cross-checks the LLM's classification
 * against independent signal matching (a lightweight three-signal check) and
 * emits a confidence + guardrail flags.
 *
 * It degrades gracefully: with no ANTHROPIC_API_KEY it runs a fully
 * deterministic diagnosis from the taxonomy + signal index — the core logic
 * stands on its own; the LLM adds nuance and the natural-language write-ups.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  TAXONOMY,
  RETRY_STRATEGY,
  MAX_RETRIES,
  SIGNAL_INDEX,
  classifyBySignals,
  needsCustomerMessage,
  type Category,
  type RetryStrategy,
} from "./taxonomy";

export interface DiagnoseInput {
  raw: string;
  amount?: number;
  currency?: string;
  method?: string;
  attemptNumber?: number;
}

export interface DiagnosisResult {
  category: Category;
  categoryLabel: string;
  owner: string;
  hardness: "soft" | "hard";
  retryable: boolean;
  retryStrategy: RetryStrategy;
  maxRetries: number;
  backoffHours: number | null;
  confidence: number; // 0..1
  rootCause: string;
  opsPlaybook: string;
  customerMessage: string | null;
  reasoning: string[]; // transparent decision trace
  guardrails: string[]; // safety flags surfaced by verification
  engine: "llm+taxonomy" | "taxonomy-only";
}

const MODEL = "claude-sonnet-5";

const OWNER_LABEL: Record<string, string> = {
  customer: "Customer",
  issuer_bank: "Issuer / Bank",
  merchant_config: "Merchant config",
  gateway: "Gateway / PSP",
  fraud_system: "Fraud system",
};

const STRATEGY_LABEL: Record<RetryStrategy, string> = {
  retry_now: "Retry now (transient)",
  retry_scheduled: "Retry on a schedule",
  retry_with_updater: "Refresh card via network updater, then retry",
  route_alternate: "Failover to an alternate acquirer",
  dunning: "Dunning — customer must act",
  do_not_retry: "Do NOT retry",
};

/** Assemble the final result from a chosen category + the deterministic taxonomy. */
function buildFromCategory(
  category: Category,
  confidence: number,
  rootCause: string,
  reasoning: string[],
  engine: DiagnosisResult["engine"],
  customerMessage: string | null,
): DiagnosisResult {
  const t = TAXONOMY[category];
  const strategy = RETRY_STRATEGY[category];
  const guardrails: string[] = [];

  // Verification: independent-signal corroboration + safety invariants.
  const signalCategory = classifyBySignals(rootCause) ?? null;
  if (signalCategory && signalCategory !== category) {
    guardrails.push(
      `Signal check suggests "${TAXONOMY[signalCategory].label}" — classification is ambiguous, review before automating.`,
    );
  }
  if (t.hardness === "hard" && strategy !== "do_not_retry" && strategy !== "retry_with_updater" && strategy !== "dunning") {
    guardrails.push("Hard decline routed to a retry path — blocked. Escalating to manual review.");
  }
  if (category === "risk_blocked") {
    guardrails.push("Fraud/risk block: never auto-retry; do not reveal the reason to the customer verbatim.");
  }
  if (category === "unknown") {
    guardrails.push("Low-confidence classification — captured for taxonomy learning; do not auto-action.");
  }

  return {
    category,
    categoryLabel: t.label,
    owner: OWNER_LABEL[t.owner],
    hardness: t.hardness,
    retryable: t.retryable,
    retryStrategy: strategy,
    maxRetries: MAX_RETRIES[strategy],
    backoffHours: t.backoffHours,
    confidence,
    rootCause,
    opsPlaybook: t.recovery,
    customerMessage,
    reasoning,
    guardrails,
    engine,
  };
}

/** Deterministic fallback — full diagnosis with zero LLM calls. */
function diagnoseDeterministic(input: DiagnoseInput): DiagnosisResult {
  const category = classifyBySignals(input.raw) ?? "unknown";
  const t = TAXONOMY[category];
  const reasoning = [
    `Scanned the raw response against the signal index.`,
    category === "unknown"
      ? `No known decline pattern matched with confidence.`
      : `Matched failure class "${t.label}" (owner: ${OWNER_LABEL[t.owner]}).`,
    `Taxonomy decision: ${STRATEGY_LABEL[RETRY_STRATEGY[category]]}${t.backoffHours ? `, backoff ~${t.backoffHours}h` : ""}.`,
  ];
  const rootCause = t.meaning;
  const customerMessage = needsCustomerMessage(category)
    ? defaultCustomerMessage(category)
    : null;
  return buildFromCategory(
    category,
    category === "unknown" ? 0.35 : 0.7,
    rootCause,
    reasoning,
    "taxonomy-only",
    customerMessage,
  );
}

function defaultCustomerMessage(category: Category): string {
  switch (category) {
    case "insufficient_funds":
      return "We couldn't complete your payment — it looks like the card had insufficient funds. Please top up or use another card, and we'll try again automatically.";
    case "card_expired":
      return "Your saved card has expired. Please update your card details to keep your service active — it takes less than a minute.";
    case "invalid_details":
      return "Some of the card details didn't match. Please re-enter your card number, expiry, and CVV and try again.";
    case "authentication_failed":
      return "Your bank asked to verify this payment and it wasn't completed. Please retry and approve the verification (OTP / bank-app prompt) to finish.";
    default:
      return "We couldn't process your payment. Please try again or use a different payment method.";
  }
}

const SYSTEM_PROMPT = `You are Decline Doctor, a payment-failure diagnosis engine for a PSP (like Razorpay).
Given a raw failed-payment response, classify it into EXACTLY ONE category from this closed set:
${Object.values(TAXONOMY)
  .map((t) => `- ${t.category}: ${t.label} — ${t.meaning}`)
  .join("\n")}

Rules:
- Choose the single best category. If genuinely unclassifiable, use "unknown".
- Do NOT invent recovery actions — the system decides the retry action from the category. Your job is accurate classification + a crisp root cause.
- rootCause: one or two sentences on what actually happened, grounded in the raw text.
- confidence: 0..1, honest.
- reasoning: 2-4 short bullet strings showing how you read the signals.
Respond with ONLY a JSON object: {"category": "...", "confidence": 0.0, "rootCause": "...", "reasoning": ["...", "..."]}`;

export async function diagnose(input: DiagnoseInput): Promise<DiagnosisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return diagnoseDeterministic(input);

  try {
    const client = new Anthropic({ apiKey });
    const ctx = [
      `Raw response: ${input.raw}`,
      input.amount != null ? `Amount: ${input.amount} ${input.currency ?? ""}`.trim() : null,
      input.method ? `Method: ${input.method}` : null,
      input.attemptNumber != null ? `Attempt #: ${input.attemptNumber}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: ctx }],
    });

    const text = msg.content.find((b) => b.type === "text");
    const parsed = extractJson(text && "text" in text ? text.text : "");
    if (!parsed || !(parsed.category in TAXONOMY)) return diagnoseDeterministic(input);

    const category = parsed.category as Category;
    const confidence = clamp(Number(parsed.confidence) || 0.6, 0, 1);
    const rootCause = String(parsed.rootCause || TAXONOMY[category].meaning);
    const reasoning = Array.isArray(parsed.reasoning)
      ? parsed.reasoning.map(String).slice(0, 4)
      : [`Classified as ${TAXONOMY[category].label}.`];
    reasoning.push(`Taxonomy decision: ${STRATEGY_LABEL[RETRY_STRATEGY[category]]}.`);

    let customerMessage: string | null = null;
    if (needsCustomerMessage(category)) {
      customerMessage = await generateCustomerMessage(client, input, category).catch(
        () => defaultCustomerMessage(category),
      );
    }

    return buildFromCategory(category, confidence, rootCause, reasoning, "llm+taxonomy", customerMessage);
  } catch {
    // Any LLM/transport failure → deterministic engine still delivers a full answer.
    return diagnoseDeterministic(input);
  }
}

async function generateCustomerMessage(
  client: Anthropic,
  input: DiagnoseInput,
  category: Category,
): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system:
      "Write a single short, warm, non-technical recovery message to a customer whose payment failed. " +
      "One or two sentences. No blame, no jargon, no reason codes. Give the one action that fixes it. " +
      "For fraud/security reasons, never state that a card was lost/stolen/blocked — just ask for another method. " +
      "Output only the message text.",
    messages: [
      {
        role: "user",
        content: `Failure class: ${TAXONOMY[category].label}. Context: ${input.raw}`,
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text");
  const out = text && "text" in text ? text.text.trim() : "";
  return out || defaultCustomerMessage(category);
}

function extractJson(s: string): any | null {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
