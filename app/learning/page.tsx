"use client";

import { useEffect, useState } from "react";
import Nav from "../components/Nav";
import { allStats, loadOutcomes, resetOutcomes, seedOutcomes, type ClassStat } from "../../lib/learning";

export default function Learning() {
  const [stats, setStats] = useState<ClassStat[]>([]);
  const [total, setTotal] = useState(0);

  function refresh() {
    const outcomes = loadOutcomes();
    setStats(allStats(outcomes));
    setTotal(outcomes.length);
  }

  useEffect(refresh, []);

  return (
    <>
      <Nav active="learning" />
      <div className="wrap">
        <div className="brand">
          <div className="logo">📈</div>
          <div>
            <p className="eyebrow">Outcome feedback loop</p>
            <h1>Learning</h1>
          </div>
        </div>
        <p className="tagline">
          Every recommended action can be marked <strong>recovered</strong> or <strong>failed</strong>. Each failure
          class is a Beta-Bernoulli process: the taxonomy&apos;s recovery likelihood is the <strong>prior</strong>, real
          outcomes are the <strong>evidence</strong>, and the <strong>posterior</strong> is the estimate the recoverable
          forecast actually uses — sharpening as outcomes accumulate.
        </p>

        <div className="card">
          <div className="row" style={{ marginTop: 0 }}>
            <button
              onClick={() => {
                seedOutcomes(14);
                refresh();
              }}
            >
              Simulate 14 outcomes / class ▸
            </button>
            <button
              onClick={() => {
                resetOutcomes();
                refresh();
              }}
              style={{ background: "var(--panel-2)", color: "var(--text-2)", border: "1px solid var(--border-strong)" }}
            >
              Reset
            </button>
            <span className="meta">{total} outcomes recorded (this browser).</span>
          </div>
          <p className="meta" style={{ marginTop: 12 }}>
            Or log real outcomes from the <a href="/">Try it</a> page and watch the matching row move here.
          </p>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="legend">
            <span>
              <span className="sw prior" /> taxonomy prior
            </span>
            <span>
              <span className="sw post" /> learned posterior
            </span>
          </div>
          {stats.map((s) => {
            const dir = Math.abs(s.shift) < 0.005 ? "flat" : s.shift > 0 ? "up" : "down";
            return (
              <div className="learn-row" key={s.category}>
                <div>
                  <div className="lr-label">{s.label}</div>
                  <div className="lr-obs">
                    {s.total > 0 ? `${s.recovered}/${s.total} recovered · ${Math.round(s.credibility * 100)}% data-weighted` : "no outcomes yet"}
                  </div>
                </div>
                <div className="track">
                  <div className="post-fill" style={{ width: `${Math.round(s.posterior * 100)}%` }} />
                  <div className="prior-tick" style={{ left: `${Math.round(s.prior * 100)}%` }} title={`prior ${Math.round(s.prior * 100)}%`} />
                </div>
                <div className="lr-num">
                  <div className="post">{Math.round(s.posterior * 100)}%</div>
                  <div className={`delta ${dir}`}>
                    {dir === "flat" ? "—" : `${s.shift > 0 ? "▲" : "▼"} ${Math.abs(Math.round(s.shift * 100))} pt`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="footer">
          The posterior mean feeds the Recovery Console&apos;s ₹-recoverable estimate, so the whole system gets more
          accurate with use. Outcomes persist in your browser for this demo; in production the ledger is a shared
          datastore so learning is global. The Bayesian update is in <code>lib/learning.ts</code>.
        </div>
      </div>
    </>
  );
}
