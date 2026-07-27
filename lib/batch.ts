/**
 * Batch recovery pass — the agentic layer.
 *
 * Given a stream of declines, autonomously diagnose each, route it into a lane
 * (auto-retry / customer / manual), and roll the results up into the numbers a
 * revenue team actually cares about: how much money is at risk, how much is
 * realistically recoverable, and what the recovery engine can action without a
 * human. Uses the deterministic engine so a whole batch resolves instantly and
 * without burning LLM quota — the single-decline view is where the LLM adds nuance.
 */

import { diagnoseDeterministic, type DiagnoseInput, type DiagnosisResult } from "./agent";
import { RECOVERY_LIKELIHOOD, laneFor, type Lane, type Category } from "./taxonomy";

export interface BatchDecision extends DiagnosisResult {
  amount: number;
  currency: string;
  lane: Lane;
  recoverableAmount: number; // amount * recovery likelihood for its class
}

export interface BatchSummary {
  count: number;
  currency: string;
  atRisk: number; // total declined value
  recoverable: number; // expected recoverable value
  recoveryRatePct: number; // recoverable / atRisk
  lanes: Record<Lane, { count: number; amount: number }>;
  byCategory: Array<{ category: Category; label: string; count: number; amount: number; recoverable: number }>;
  decisions: BatchDecision[];
}

export function runBatch(inputs: DiagnoseInput[]): BatchSummary {
  const currency = inputs.find((i) => i.currency)?.currency || "INR";
  const lanes: Record<Lane, { count: number; amount: number }> = {
    auto: { count: 0, amount: 0 },
    customer: { count: 0, amount: 0 },
    manual: { count: 0, amount: 0 },
  };
  const catMap = new Map<Category, { label: string; count: number; amount: number; recoverable: number }>();

  const decisions: BatchDecision[] = inputs.map((input) => {
    const d = diagnoseDeterministic(input);
    const amount = Number(input.amount) || 0;
    const lane = laneFor(d.retryStrategy);
    const recoverableAmount = Math.round(amount * (RECOVERY_LIKELIHOOD[d.category as Category] ?? 0));

    lanes[lane].count += 1;
    lanes[lane].amount += amount;

    const c = catMap.get(d.category as Category) ?? { label: d.categoryLabel, count: 0, amount: 0, recoverable: 0 };
    c.count += 1;
    c.amount += amount;
    c.recoverable += recoverableAmount;
    catMap.set(d.category as Category, c);

    return { ...d, amount, currency: input.currency || currency, lane, recoverableAmount };
  });

  const atRisk = decisions.reduce((s, d) => s + d.amount, 0);
  const recoverable = decisions.reduce((s, d) => s + d.recoverableAmount, 0);

  const byCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.amount - a.amount);

  return {
    count: decisions.length,
    currency,
    atRisk,
    recoverable,
    recoveryRatePct: atRisk > 0 ? Math.round((recoverable / atRisk) * 100) : 0,
    lanes,
    byCategory,
    decisions,
  };
}
