import type { Metadata } from "next";
import Link from "next/link";
import Nav from "../components/Nav";

export const metadata: Metadata = {
  title: "How it works — Decline Doctor",
  description: "What Decline Doctor does, why it's built this way, and how the diagnosis loop works.",
};

export default function HowItWorks() {
  return (
    <>
      <Nav active="how" />
      <article className="prose">
        <p className="kicker">What · Why · How</p>
        <h1>The diagnosis layer that sits in front of a retry engine.</h1>
        <p className="lead">
          Payment retry engines are good at <em>doing</em> — routing, retrying, dunning. They are not good at{" "}
          <em>deciding</em>. Decline Doctor is the decision layer: it reads a raw decline, works out what actually
          happened, and outputs a retry-safe action a retry engine can execute.
        </p>

        <h2>What it does</h2>
        <p>
          You give it the messy thing a gateway actually returns — an error code, a bank message, a risk-engine verdict.
          In one step it returns:
        </p>
        <ul>
          <li>
            <strong>Root cause</strong> and <strong>who owns the fix</strong> — customer, issuer bank, merchant config,
            gateway, or fraud system.
          </li>
          <li>
            <strong>The retry-safe action</strong> — one of <em>retry now</em>, <em>retry scheduled</em>,{" "}
            <em>card-updater → retry</em>, <em>route to alternate acquirer</em>, <em>dunning</em>, or{" "}
            <em>do not retry</em> — with a backoff and a max-attempts cap.
          </li>
          <li>
            A drafted, non-technical <strong>customer recovery message</strong> where the customer is the one who has to
            act (≈half of all recovery is communication, not timing).
          </li>
          <li>
            A transparent <strong>decision trace</strong> and <strong>verification guardrails</strong>.
          </li>
        </ul>

        <h2>Why it's built this way</h2>
        <p>
          The obvious version of this is "ask an LLM what to do with a failed payment." That version is dangerous. An LLM
          that both diagnoses <em>and</em> decides can be talked — by a weird gateway string, a prompt-injected merchant
          note, or its own hallucination — into auto-retrying a stolen card or a fraud block. On real money, that's lost
          money and escalated risk.
        </p>
        <div className="callout">
          <p>
            <strong>The one idea:</strong> the LLM classifies, the taxonomy decides. Perception is fuzzy and belongs to
            the model. The <em>action</em> — is a retry safe? how long to wait? — is looked up from a hand-curated,
            deterministic taxonomy keyed by failure class. A hard or fraud decline is <em>structurally</em> incapable of
            reaching a retry path, no matter what the model says.
          </p>
        </div>

        <h2>How the loop runs</h2>
        <div className="flow">
{`raw decline
   │
   ├─▶ signal index      (independent regex pass — cheap, deterministic)
   │
   ├─▶ LLM classify      (Claude reads the mess → one failure class + root cause)
   │
   ▼
taxonomy DECIDES         (owner · retryable? · strategy · backoff · max attempts)
   │
   ├─▶ verify            (LLM class vs signal class; block hard→retry routing;
   │                      flag low confidence → guardrails)
   │
   ├─▶ draft message     (only if the customer must act)
   │
   ▼
diagnosis + trace`}
        </div>
        <p>
          The verification pass is a lightweight three-signal check — the model's classification, an independent
          signal-match, and the taxonomy's own invariants must agree, or a guardrail is raised for a human. It's the
          same idea behind never trusting a single source for a claim.
        </p>

        <h2>Degrades without an LLM</h2>
        <p>
          Pull the API key and it still works: the signal index + taxonomy produce a full diagnosis on their own. The
          LLM adds nuance and the natural-language write-ups; it isn't load-bearing for safety. The core logic stands
          alone — which is the point.
        </p>

        <Link href="/" className="cta">
          Try a live diagnosis →
        </Link>
      </article>
    </>
  );
}
