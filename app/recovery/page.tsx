"use client";

import { useState } from "react";
import Nav from "../components/Nav";
import { SAMPLE_BATCH } from "../../lib/batch-samples";
import { loadOutcomes, learnedLikelihoods } from "../../lib/learning";

interface Decision {
  category: string;
  categoryLabel: string;
  retryStrategy: string;
  lane: "auto" | "customer" | "manual";
  amount: number;
  currency: string;
  recoverableAmount: number;
  rootCause: string;
}
interface Summary {
  count: number;
  currency: string;
  atRisk: number;
  recoverable: number;
  recoveryRatePct: number;
  lanes: Record<string, { count: number; amount: number }>;
  byCategory: Array<{ label: string; count: number; amount: number; recoverable: number }>;
  decisions: Decision[];
}

const STRATEGY_LABEL: Record<string, string> = {
  retry_now: "Retry now",
  retry_scheduled: "Retry scheduled",
  retry_with_updater: "Card updater",
  route_alternate: "Route alternate",
  dunning: "Dunning",
  do_not_retry: "Stop",
};
const LANE_LABEL: Record<string, string> = { auto: "Auto-retry", customer: "Customer action", manual: "Manual / stop" };

function money(n: number, cur: string) {
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : cur + " ";
  return sym + Math.round(n).toLocaleString("en-IN");
}

export default function Recovery() {
  const [text, setText] = useState(JSON.stringify(SAMPLE_BATCH, null, 0));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [learnedApplied, setLearnedApplied] = useState(0);

  async function run(declines: any[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declines }),
      });
      const data: Summary = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Batch failed.");

      // Close the loop: re-estimate recoverable using learned posteriors where we have outcomes.
      const outcomes = loadOutcomes();
      if (outcomes.length > 0) {
        const learned = learnedLikelihoods(outcomes);
        let recoverable = 0;
        data.decisions = data.decisions.map((d) => {
          const rate = learned[d.category];
          const rec = rate != null ? Math.round(d.amount * rate) : d.recoverableAmount;
          recoverable += rec;
          return { ...d, recoverableAmount: rec };
        });
        data.recoverable = recoverable;
        data.recoveryRatePct = data.atRisk > 0 ? Math.round((recoverable / data.atRisk) * 100) : 0;
        setLearnedApplied(outcomes.length);
      } else {
        setLearnedApplied(0);
      }
      setSummary(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function runSample() {
    setText(JSON.stringify(SAMPLE_BATCH, null, 0));
    run(SAMPLE_BATCH);
  }
  function runPasted() {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of declines.");
      run(parsed);
    } catch (e: any) {
      setError("Couldn't parse JSON: " + e.message);
    }
  }

  return (
    <>
      <Nav active="recovery" />
      <div className="wrap">
        <div className="brand">
          <div className="logo">📊</div>
          <div>
            <p className="eyebrow">Agentic recovery pass</p>
            <h1>Recovery Console</h1>
          </div>
        </div>
        <p className="tagline">
          Feed a stream of failed payments. Decline Doctor diagnoses each one, routes it into a lane —{" "}
          <strong>auto-retry</strong>, <strong>customer action</strong>, or <strong>manual/stop</strong> — and shows how
          much declined revenue is realistically recoverable. This is the layer a retry engine executes against.
        </p>

        <div className="card">
          <p className="label">Decline stream (JSON array — edit or use the sample)</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 96 }} />
          <div className="row">
            <button onClick={runSample} disabled={loading}>
              {loading ? "Running…" : "Run sample stream ▸"}
            </button>
            <button
              onClick={runPasted}
              disabled={loading}
              style={{ background: "var(--panel-2)", color: "var(--text-2)", border: "1px solid var(--border-strong)" }}
            >
              Run pasted JSON
            </button>
            <span className="meta">{SAMPLE_BATCH.length} declines in the sample.</span>
          </div>
          {error && <div className="error">⚠ {error}</div>}
        </div>

        {summary && (
          <>
            <div className="kpis">
              <div className="kpi risk">
                <div className="k-label">Revenue at risk</div>
                <div className="k-num">{money(summary.atRisk, summary.currency)}</div>
                <div className="k-sub">{summary.count} declined payments</div>
              </div>
              <div className="kpi good">
                <div className="k-label">Recoverable</div>
                <div className="k-num">{money(summary.recoverable, summary.currency)}</div>
                <div className="k-sub">
                  {learnedApplied > 0 ? `learned from ${learnedApplied} outcomes` : "with the right action per decline"}
                </div>
              </div>
              <div className="kpi accent">
                <div className="k-label">Recovery rate</div>
                <div className="k-num">{summary.recoveryRatePct}%</div>
                <div className="k-sub">of at-risk value</div>
              </div>
              <div className="kpi">
                <div className="k-label">Auto-actionable</div>
                <div className="k-num">{summary.lanes.auto.count}</div>
                <div className="k-sub">no human needed</div>
              </div>
            </div>

            <div className="lanes">
              {(["auto", "customer", "manual"] as const).map((l) => (
                <div key={l} className={`lane ${l}`}>
                  <div className="l-top">
                    <span className="dot" />
                    {LANE_LABEL[l]}
                  </div>
                  <div className="l-count">{summary.lanes[l].count}</div>
                  <div className="l-sub">{money(summary.lanes[l].amount, summary.currency)} in this lane</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <p className="section-title">Every decision</p>
              <div className="tbl-wrap">
                <table className="dec">
                  <thead>
                    <tr>
                      <th>Failure class</th>
                      <th>Action</th>
                      <th>Lane</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th style={{ textAlign: "right" }}>Recoverable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.decisions.map((d, i) => (
                      <tr key={i}>
                        <td>{d.categoryLabel}</td>
                        <td>{STRATEGY_LABEL[d.retryStrategy] ?? d.retryStrategy}</td>
                        <td>
                          <span className={`tag ${d.lane}`}>{LANE_LABEL[d.lane]}</span>
                        </td>
                        <td className="amt" style={{ textAlign: "right" }}>
                          {money(d.amount, d.currency)}
                        </td>
                        <td className="amt" style={{ textAlign: "right", color: d.recoverableAmount > 0 ? "var(--green)" : "var(--muted)" }}>
                          {money(d.recoverableAmount, d.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="footer">
          Batch triage runs on the deterministic engine for instant, quota-free resolution across the whole stream; the
          single-decline view adds the LLM for messy inputs and customer-message drafting. Recoverable estimates use
          per-class recovery likelihoods — illustrative, not a guarantee.
        </div>
      </div>
    </>
  );
}
