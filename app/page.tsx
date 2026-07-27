"use client";

import { useState } from "react";
import { SAMPLES } from "../lib/samples";
import Nav from "./components/Nav";

interface DiagnosisResult {
  category: string;
  categoryLabel: string;
  owner: string;
  hardness: "soft" | "hard";
  retryable: boolean;
  retryStrategy: string;
  maxRetries: number;
  backoffHours: number | null;
  confidence: number;
  rootCause: string;
  opsPlaybook: string;
  customerMessage: string | null;
  reasoning: string[];
  guardrails: string[];
  engine: string;
  perceptionSource: "llm" | "signal";
  decisionPolicy: string;
  safetyEnforced: boolean;
}

const STRATEGY_LABEL: Record<string, string> = {
  retry_now: "Retry now",
  retry_scheduled: "Retry scheduled",
  retry_with_updater: "Card updater → retry",
  route_alternate: "Route to alternate acquirer",
  dunning: "Dunning (customer acts)",
  do_not_retry: "Do not retry",
};

export default function Home() {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(input?: { raw: string; amount?: number; currency?: string; method?: string; attemptNumber?: number }) {
    const payload = input ?? { raw };
    if (!payload.raw.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Nav active="home" />
      <div className="wrap">
      <div className="brand">
        <div className="logo">🩺</div>
        <div>
          <p className="eyebrow">Payment Revenue Recovery</p>
          <h1>Decline Doctor</h1>
        </div>
      </div>
      <p className="tagline">
        Every failed payment is lost revenue — but the fix depends entirely on <em>why</em> it failed. Paste a raw
        gateway decline. Decline Doctor finds the <strong>root cause</strong>, decides the{" "}
        <strong>retry-safe action</strong>, and drafts the <strong>customer message</strong> — the diagnosis layer that
        sits in front of a retry engine.
      </p>

      <div className="card">
        <textarea
          placeholder={`Paste a failed-payment response, e.g.\nerror_code: "BAD_REQUEST_PAYMENT_FAILED", bank_code: "05", description: "Do not honor"`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="samples">
          {SAMPLES.map((s) => (
            <span
              key={s.title}
              className="chip"
              onClick={() => {
                setRaw(s.raw);
                run(s);
              }}
            >
              {s.title}
            </span>
          ))}
        </div>
        <div className="row">
          <button onClick={() => run()} disabled={loading || !raw.trim()}>
            {loading ? "Diagnosing…" : "Diagnose ✦"}
          </button>
          <span className="meta">Tip: click a sample to run it instantly.</span>
        </div>
        {error && <div className="error">⚠ {error}</div>}
      </div>

      {!result && (
        <div className="steps">
          <div className="step">
            <div className="s-n">1</div>
            <div className="s-t">
              Read the decline<span className="who ai">AI</span>
            </div>
            <div className="s-d">A language model reads the messy gateway response and classifies the failure.</div>
          </div>
          <div className="step">
            <div className="s-n">2</div>
            <div className="s-t">
              Decide the action<span className="who det">rules</span>
            </div>
            <div className="s-d">
              A deterministic taxonomy — not the model — decides whether a retry is safe. Fraud/hard declines are barred
              from any retry path.
            </div>
          </div>
          <div className="step">
            <div className="s-n">3</div>
            <div className="s-t">Recover</div>
            <div className="s-d">Retry-safe action, backoff, and a customer message — ready for a retry engine to execute.</div>
          </div>
        </div>
      )}

      {result && (
        <div className="result">
          <div className="card">
            <p className="section-title">How this decision was made</p>
            <div className="pipeline">
              <div className="stage ai">
                <div className="st-h">① Perception · {result.perceptionSource === "llm" ? "AI model" : "signal match"}</div>
                <div className="st-main">{result.categoryLabel}</div>
                <div className="st-sub">
                  confidence {Math.round(result.confidence * 100)}% · {result.engine}
                </div>
              </div>
              <div className="arrow">→</div>
              <div className={`stage decision ${result.safetyEnforced ? "locked" : ""}`}>
                <div className="st-h">
                  ② Decision · deterministic {result.safetyEnforced ? "🔒" : ""}
                </div>
                <div className="st-main">{STRATEGY_LABEL[result.retryStrategy] ?? result.retryStrategy}</div>
                <div className="st-note">{result.decisionPolicy}</div>
              </div>
            </div>
            <div className={`override-banner ${result.safetyEnforced ? "" : "safe"}`}>
              {result.safetyEnforced
                ? "🔒 Safety override: the model classified the failure, but the action is enforced by rules — it cannot be talked into an unsafe retry."
                : "✓ Model classified the failure; the taxonomy set a safe, automatable action."}
            </div>
          </div>

          <div className="card">
            <div className="verdict">
              <span className="category">{result.categoryLabel}</span>
              <span className={`pill ${result.hardness}`}>{result.hardness} decline</span>
              <span className="pill strategy">{STRATEGY_LABEL[result.retryStrategy] ?? result.retryStrategy}</span>
              <span className="badge-engine">{result.engine}</span>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <span className="meta">Confidence</span>
              <div className="confbar">
                <div className="conffill" style={{ width: `${Math.round(result.confidence * 100)}%` }} />
              </div>
              <span className="meta">{Math.round(result.confidence * 100)}%</span>
            </div>
            <p className="meta" style={{ marginTop: 12 }}>
              <strong>Owner:</strong> {result.owner} &nbsp;·&nbsp;
              <strong> Retryable:</strong> {result.retryable ? "yes" : "no"} &nbsp;·&nbsp;
              {result.maxRetries > 0 ? (
                <>
                  <strong> Max retries:</strong> {result.maxRetries}
                </>
              ) : (
                <strong> No auto-retry</strong>
              )}
              {result.backoffHours != null && (
                <>
                  {" "}
                  &nbsp;·&nbsp; <strong>Backoff:</strong> ~{result.backoffHours}h
                </>
              )}
            </p>
          </div>

          {result.guardrails.length > 0 && (
            <div className="card">
              <p className="section-title">🛡 Verification guardrails</p>
              {result.guardrails.map((g, i) => (
                <div key={i} className="guardrail" style={{ marginBottom: 8 }}>
                  {g}
                </div>
              ))}
            </div>
          )}

          <div className="grid2">
            <div className="card">
              <p className="section-title">Root cause</p>
              <p className="playbook">{result.rootCause}</p>
            </div>
            <div className="card">
              <p className="section-title">Ops recovery playbook</p>
              <p className="playbook">{result.opsPlaybook}</p>
            </div>
          </div>

          {result.customerMessage && (
            <div className="card">
              <p className="section-title">✉ Suggested customer message</p>
              <div className="msg">{result.customerMessage}</div>
            </div>
          )}

          <div className="card">
            <p className="section-title">Decision trace</p>
            <ul className="trace">
              {result.reasoning.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="footer">
        Decline Doctor classifies with an LLM but <strong>decides the retry action from a deterministic taxonomy</strong>,
        so a hard/fraud decline can never be talked into an unsafe auto-retry. Runs with or without an{" "}
        <code>ANTHROPIC_API_KEY</code> (deterministic engine as fallback). Built for the Razorpay AI Builders challenge.
      </div>
      </div>
    </>
  );
}
