/**
 * Outcome feedback loop.
 *
 * Every recommended action can be marked recovered / failed. We treat each
 * failure class as a Beta-Bernoulli process: the taxonomy's RECOVERY_LIKELIHOOD
 * is the prior, observed outcomes are the evidence, and the posterior mean is
 * the estimate the system actually uses — so recoverable forecasts get sharper
 * as real outcomes accumulate, and confidence in each class grows with sample size.
 *
 * Outcomes persist in localStorage for this demo (per browser). In production
 * this ledger would be a shared datastore (Vercel KV / Postgres) so learning is
 * global, not per-user — the math below is identical either way.
 */

import { RECOVERY_LIKELIHOOD, TAXONOMY, type Category } from "./taxonomy";

export interface Outcome {
  category: Category;
  recovered: boolean;
  ts: number;
}

const KEY = "dd_outcomes_v1";
/** Prior strength in pseudo-observations — how much the taxonomy prior is worth before real data. */
const PRIOR_STRENGTH = 6;

export function loadOutcomes(): Outcome[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(outcomes: Outcome[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(outcomes.slice(-5000)));
}

export function recordOutcome(category: Category, recovered: boolean) {
  const all = loadOutcomes();
  all.push({ category, recovered, ts: Date.now() });
  save(all);
}

export function resetOutcomes() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

export interface ClassStat {
  category: Category;
  label: string;
  prior: number; // taxonomy prior likelihood
  recovered: number; // observed successes
  total: number; // observed trials
  posterior: number; // Beta posterior mean — the estimate now in use
  shift: number; // posterior - prior (how much learning moved it)
  credibility: number; // 0..1, grows with sample size
}

/** Beta posterior mean for one class, blending prior (as pseudo-counts) with observed outcomes. */
export function posterior(category: Category, outcomes: Outcome[]): ClassStat {
  const prior = RECOVERY_LIKELIHOOD[category] ?? 0.1;
  const a0 = prior * PRIOR_STRENGTH;
  const b0 = (1 - prior) * PRIOR_STRENGTH;
  const obs = outcomes.filter((o) => o.category === category);
  const recovered = obs.filter((o) => o.recovered).length;
  const total = obs.length;
  const post = (a0 + recovered) / (a0 + b0 + total);
  return {
    category,
    label: TAXONOMY[category].label,
    prior,
    recovered,
    total,
    posterior: post,
    shift: post - prior,
    credibility: total / (total + PRIOR_STRENGTH),
  };
}

/** Posterior for every class, most-observed first. */
export function allStats(outcomes: Outcome[]): ClassStat[] {
  return (Object.keys(RECOVERY_LIKELIHOOD) as Category[])
    .map((c) => posterior(c, outcomes))
    .sort((a, b) => b.total - a.total || b.posterior - a.posterior);
}

/** Map of category → posterior likelihood, for the Console to use in place of the static prior. */
export function learnedLikelihoods(outcomes: Outcome[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of allStats(outcomes)) out[s.category] = s.posterior;
  return out;
}

/**
 * Seed realistic outcomes so the loop is demonstrable without hand-clicking dozens
 * of times. Draws from a plausible "true" recovery rate per class (near the prior,
 * with noise) so posteriors converge somewhere believable.
 */
export function seedOutcomes(perClass = 12) {
  const all = loadOutcomes();
  const trueRate: Partial<Record<Category, number>> = {
    insufficient_funds: 0.55,
    do_not_honor: 0.3,
    card_expired: 0.65,
    invalid_details: 0.45,
    authentication_failed: 0.72,
    risk_blocked: 0.03,
    limit_exceeded: 0.4,
    issuer_unavailable: 0.9,
    technical_error: 0.85,
    config_error: 0.8,
    lost_or_stolen: 0.0,
    unknown: 0.12,
  };
  for (const c of Object.keys(trueRate) as Category[]) {
    const p = trueRate[c]!;
    for (let i = 0; i < perClass; i++) {
      all.push({ category: c, recovered: Math.random() < p, ts: Date.now() - Math.floor(Math.random() * 6e8) });
    }
  }
  save(all);
}
