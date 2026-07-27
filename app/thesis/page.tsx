import type { Metadata } from "next";
import Link from "next/link";
import Nav from "../components/Nav";

export const metadata: Metadata = {
  title: "Thesis — Decline Doctor",
  description: "Why payment-failure diagnosis is the missing layer in revenue recovery.",
};

export default function Thesis() {
  return (
    <>
      <Nav active="thesis" />
      <article className="prose">
        <p className="kicker">Thesis</p>
        <h1>Failed payments are a decision problem, not a routing problem.</h1>
        <p className="lead">
          The industry has spent a decade making payments <em>retry</em> better. The un-won half of the problem is
          knowing <em>whether</em> to retry, <em>how</em>, and <em>when</em> — per decline, safely, at scale. That's a
          diagnosis problem, and it's where the money leaks.
        </p>

        <h2>1. The problem is enormous and mostly invisible</h2>
        <p>
          A meaningful share of card and recurring payments fail at authorization — for reasons that range from "the
          customer needs to tap approve in their bank app" to "this card is dead" to "your own config blocks it." Each
          one is either recoverable revenue or wasted effort, and the difference is entirely in the <em>reason</em>. Most
          merchants never see the reason clearly; they see "payment failed."
        </p>
        <div className="stat-row">
          <div className="stat">
            <div className="num">50–80%</div>
            <div className="cap">of failed payments are recoverable with a layered smart-retry + dunning + card-updater approach.</div>
          </div>
          <div className="stat">
            <div className="num">+3–5 pts</div>
            <div className="cap">of success rate added by automated retries alone — but only when they're the <em>right</em> retries.</div>
          </div>
          <div className="stat">
            <div className="num">~50%</div>
            <div className="cap">of recovery comes from customer communication, not retry timing. Both need the correct diagnosis first.</div>
          </div>
        </div>

        <h2>2. Retrying blindly is negative-sum</h2>
        <p>
          A wrong retry isn't neutral — it costs a transaction fee, burns issuer goodwill (banks throttle merchants who
          hammer declines), and on a fraud-flagged card it actively escalates risk. So the naïve "just retry everything a
          few times" strategy caps out fast and can make things worse. The value isn't in retrying; it's in{" "}
          <strong>knowing which declines to retry, how, and which to never touch.</strong>
        </p>

        <h2>3. This is exactly where an LLM helps — and exactly where it's dangerous</h2>
        <p>
          Gateway responses are unstructured, inconsistent across acquirers, and full of edge cases — perfect for a
          language model to read. But a model that also <em>decides the action</em> is a liability on money: one strange
          string or hallucination and it auto-retries a stolen card. The winning design uses the model for what it's good
          at (reading the mess) and refuses to let it touch the part that must be safe (the action).
        </p>
        <div className="callout">
          <p>
            <strong>Decline Doctor's bet:</strong> separate perception from decisioning. LLM classifies; a deterministic
            taxonomy decides. You get the model's flexibility on messy input <em>and</em> a hard guarantee that a
            hard/fraud decline can never reach a retry path. That's the only way an AI diagnosis layer earns the right to
            sit in front of real money.
          </p>
        </div>

        <h2>4. Where it sits in the stack</h2>
        <p>
          This isn't a competitor to a retry engine or a smart router — it's the <strong>decision layer above one</strong>.
          Razorpay's Optimizer and Intelligent Retry Engine already route to healthy acquirers and execute configurable
          retries. Decline Doctor is the piece that turns a raw decline into the structured instruction those engines
          should act on: <em>this class, this owner, this strategy, this backoff, or don't.</em>
        </p>
        <div className="flow">
{`decline ──▶ [ Decline Doctor: diagnose + decide ] ──▶ retry engine executes
                     │                                      (route / retry / dunning)
                     └─▶ customer message                 ──▶ comms
                     └─▶ guardrail / manual review        ──▶ risk`}
        </div>

        <h2>5. What I'd build with more time</h2>
        <ul>
          <li>
            <strong>A feedback loop.</strong> Log outcomes of each recommended action and let the taxonomy's confidence
            and backoff windows learn from real recovery rates — closing the loop from diagnosis to measured revenue.
          </li>
          <li>
            <strong>Batch + revenue view.</strong> Ingest a stream of declines and show ₹ recoverable, recovery-rate by
            class, and the highest-leverage config fixes (the ones failing <em>all</em> customers, not one).
          </li>
          <li>
            <strong>Acquirer-aware routing hints.</strong> Fold real-time acquirer health into the "route to alternate"
            decision.
          </li>
        </ul>

        <p style={{ marginTop: 28 }}>
          Built for the{" "}
          <a href="https://razorpay.com/ai-builders/" target="_blank" rel="noreferrer">
            Razorpay AI Builders
          </a>{" "}
          challenge by Pratik Rana ·{" "}
          <a href="https://github.com/pratikranaa/decline-doctor" target="_blank" rel="noreferrer">
            source
          </a>
          .
        </p>
        <Link href="/" className="cta">
          Try a live diagnosis →
        </Link>
      </article>
    </>
  );
}
