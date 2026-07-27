# 🩺 Decline Doctor

**An AI agent that diagnoses failed payments — and decides how to recover the revenue, safely.**

Built for the Razorpay AI Builders challenge.

Every declined payment is lost revenue. Merchants see a cryptic gateway response and don't know: is it retryable? whose fault is it? what's the fix? Decline Doctor reads a raw failed-payment response and returns, in seconds:

- **Root cause** + **who owns the fix** (customer / bank / merchant config / gateway / fraud system)
- The **retry-safe action** — one of `retry now`, `retry scheduled`, `card-updater → retry`, `route to alternate acquirer`, `dunning`, or `do not retry` — with backoff + max attempts
- A drafted, non-technical **customer recovery message** (dunning) where that's what moves the needle
- A transparent **decision trace** and **verification guardrails**

It's the diagnosis + decisioning brain that sits in front of a retry engine (like Razorpay's Intelligent Retry Engine / Optimizer).

## The one idea that matters

**The LLM classifies. The taxonomy decides.**

The model does *perception* — reading a messy gateway response and mapping it to a failure class. A hand-curated, deterministic taxonomy does *decisioning* — whether a retry is safe, the strategy, the backoff. The model can **never** talk the system into auto-retrying a hard or fraud decline, because the action is *looked up by category*, not generated. A verification pass then cross-checks the classification against independent signal matching and raises guardrail flags on low confidence or unsafe routing.

This is why it's trustworthy enough to put in front of real money.

## Grounded in how the industry actually recovers payments

- Never auto-retry hard declines; cap soft retries (3–4) to preserve issuer goodwill.
- Payday-align `insufficient_funds`; short backoff + alternate routing on issuer/gateway downtime; network card-updater for expired cards.
- ~50% of recovery is retry *timing*, ~50% is customer *communication* — so Decline Doctor produces both.

Smart-retry + dunning + card-updater layers recover **50–80%** of failed payments industry-wide; automated retries alone add **3–5 points** of success rate.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for LLM classification
npm run dev                  # http://localhost:3000
```

Works with **or without** an API key — no key runs the deterministic engine, so the demo never breaks.

## Deploy (Vercel)

```bash
npm i -g vercel
vercel            # follow prompts
vercel --prod
```

Set `ANTHROPIC_API_KEY` in Vercel → Project → Settings → Environment Variables to enable the LLM path.

## Architecture

```
app/page.tsx           UI — paste a decline, one-click samples, results
app/api/diagnose       POST endpoint → runs the agent
lib/taxonomy.ts        the knowledge base: failure classes → owner, retry-safety, strategy, backoff
lib/agent.ts           the agent: LLM classify → taxonomy decide → verify → draft message
lib/samples.ts         realistic demo cases
```

## Tech

Next.js (App Router) · TypeScript · Anthropic SDK · deploys on Vercel.

---

Built by **Pratik Rana** for the [Razorpay AI Builders](https://razorpay.com/ai-builders/) challenge.
