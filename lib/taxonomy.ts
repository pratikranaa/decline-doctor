/**
 * Payment-failure taxonomy — the core knowledge base.
 *
 * Every declined payment maps to one of these categories. Each entry encodes
 * the decisions a revenue/ops team actually needs to make:
 *   - owner:      who can fix it (the customer, their bank, the merchant's
 *                 config, the gateway, or the fraud system)
 *   - retryable:  is an automatic retry safe, or would it waste money / trip
 *                 issuer velocity limits / re-trigger a fraud block?
 *   - backoff:    if retryable, how long to wait before retrying
 *   - recovery:   the concrete next action that recovers the revenue
 *
 * Codes are the common card-network / ISO-8583 decline reasons plus the
 * gateway-level failures every PSP (Razorpay, Stripe, Adyen, ...) surfaces.
 * This map is intentionally hand-curated: it is the deterministic ground
 * truth the LLM reasons *with*, and the guardrail the LLM is checked *against*.
 */

export type Owner =
  | "customer"
  | "issuer_bank"
  | "merchant_config"
  | "gateway"
  | "fraud_system";

export type Category =
  | "insufficient_funds"
  | "do_not_honor"
  | "card_expired"
  | "invalid_details"
  | "authentication_failed"
  | "risk_blocked"
  | "limit_exceeded"
  | "issuer_unavailable"
  | "technical_error"
  | "config_error"
  | "lost_or_stolen"
  | "unknown";

export interface TaxonomyEntry {
  category: Category;
  label: string;
  owner: Owner;
  /** true = a later retry can succeed on its own; false = state must change first. */
  retryable: boolean;
  /** Soft declines can be retried after a delay; hard declines never auto-retry. */
  hardness: "soft" | "hard";
  backoffHours: number | null;
  recovery: string;
  /** Human explanation of the failure mechanism. */
  meaning: string;
}

export const TAXONOMY: Record<Category, TaxonomyEntry> = {
  insufficient_funds: {
    category: "insufficient_funds",
    label: "Insufficient funds",
    owner: "customer",
    retryable: true,
    hardness: "soft",
    backoffHours: 24,
    recovery:
      "Soft decline. Nudge the customer to add funds or use another method, then retry after ~24h (or on next payday for subscriptions). Safe to place in a smart-retry queue.",
    meaning:
      "The account is valid but did not have the balance/credit limit to cover the amount at authorization time.",
  },
  do_not_honor: {
    category: "do_not_honor",
    label: "Do not honor (generic issuer decline)",
    owner: "issuer_bank",
    retryable: true,
    hardness: "soft",
    backoffHours: 2,
    recovery:
      "The bank declined without a specific reason — often risk heuristics, a temporary hold, or an international-transaction block. Ask the customer to approve the merchant with their bank / enable international usage, then retry after 2h. One controlled retry is usually worth it.",
    meaning:
      "A catch-all issuer decline (code 05). The card is real; the issuer chose not to authorize this specific attempt.",
  },
  card_expired: {
    category: "card_expired",
    label: "Card expired",
    owner: "customer",
    retryable: false,
    hardness: "hard",
    backoffHours: null,
    recovery:
      "Hard decline — do NOT auto-retry (it will keep failing and hurt your retry ratios). Prompt the customer for updated card details, or use a network account-updater / card-on-file refresh for subscriptions.",
    meaning: "The card's expiry date is in the past. The credential itself must change.",
  },
  invalid_details: {
    category: "invalid_details",
    label: "Invalid card details (number / CVV / expiry mismatch)",
    owner: "customer",
    retryable: false,
    hardness: "hard",
    backoffHours: null,
    recovery:
      "Hard decline. Re-collect the card number, expiry, and CVV — one field is wrong. Add inline validation (Luhn check, expiry format) at capture to prevent this class entirely.",
    meaning:
      "The submitted card data failed validation at the issuer (wrong CVV, bad number, or expiry mismatch).",
  },
  authentication_failed: {
    category: "authentication_failed",
    label: "3-D Secure / OTP authentication failed",
    owner: "customer",
    retryable: true,
    hardness: "soft",
    backoffHours: 0,
    recovery:
      "The customer abandoned or failed the 3DS/OTP challenge. Re-initiate the payment with a fresh authentication step immediately — do not retry silently without a new challenge (it will fail). Reduce drop-off by pre-warming 3DS and showing a clear 'check your bank app' prompt.",
    meaning:
      "Strong Customer Authentication was required and the OTP/3DS step was not completed successfully.",
  },
  risk_blocked: {
    category: "risk_blocked",
    label: "Blocked by fraud / risk system",
    owner: "fraud_system",
    retryable: false,
    hardness: "hard",
    backoffHours: null,
    recovery:
      "Do NOT auto-retry — repeated attempts on a flagged transaction escalate risk scores and can get the card/merchant flagged. Route to manual review; if a false positive, allow-list the customer and re-attempt through the review flow.",
    meaning:
      "The gateway's or merchant's fraud engine scored this transaction above threshold and blocked it before/at authorization.",
  },
  limit_exceeded: {
    category: "limit_exceeded",
    label: "Transaction / velocity limit exceeded",
    owner: "issuer_bank",
    retryable: true,
    hardness: "soft",
    backoffHours: 24,
    recovery:
      "The amount or frequency exceeded a per-transaction or daily limit (issuer or the customer's own card limit). Suggest splitting the amount or retrying the next day; for recurring, retry after the limit window resets.",
    meaning:
      "Authorization exceeded a configured cap — per-transaction ceiling, daily spend, or attempt velocity.",
  },
  issuer_unavailable: {
    category: "issuer_unavailable",
    label: "Issuer unreachable / bank downtime",
    owner: "issuer_bank",
    retryable: true,
    hardness: "soft",
    backoffHours: 1,
    recovery:
      "Transient — the issuing bank's authorization system timed out or was down. This is highly recoverable: retry after ~1h with exponential backoff. Consider routing the retry through an alternate acquirer if downtime persists.",
    meaning:
      "The issuer did not respond in time (network/switch timeout or scheduled bank downtime). No decision was reached.",
  },
  technical_error: {
    category: "technical_error",
    label: "Gateway / processor technical error",
    owner: "gateway",
    retryable: true,
    hardness: "soft",
    backoffHours: 1,
    recovery:
      "A transient processor-side failure (timeout, 5xx, malformed acquirer response). Retry after a short backoff. If it recurs across many transactions, it's an incident — check the PSP status page and consider failover routing.",
    meaning:
      "The failure happened inside the payment infrastructure, not at the bank. The transaction may not have reached the issuer.",
  },
  config_error: {
    category: "config_error",
    label: "Merchant configuration error",
    owner: "merchant_config",
    retryable: false,
    hardness: "hard",
    backoffHours: null,
    recovery:
      "This is on the merchant, not the customer — e.g. currency not enabled, payment method not activated, API key/mode mismatch, or MCC restriction. Retrying won't help until the dashboard config is fixed. Highest-leverage fix: it blocks ALL customers, not one.",
    meaning:
      "The payment was rejected because of how the merchant account or integration is set up, before customer factors even matter.",
  },
  lost_or_stolen: {
    category: "lost_or_stolen",
    label: "Card reported lost / stolen / pickup",
    owner: "issuer_bank",
    retryable: false,
    hardness: "hard",
    backoffHours: null,
    recovery:
      "Hard decline for security. Never retry. Ask the customer for a different payment method. Do not surface the reason to the customer verbatim (fraud-sensitive); show a generic 'please use another card'.",
    meaning:
      "The issuer flagged the card as lost, stolen, or a pickup card. The credential is dead.",
  },
  unknown: {
    category: "unknown",
    label: "Unclassified failure",
    owner: "gateway",
    retryable: false,
    hardness: "hard",
    backoffHours: null,
    recovery:
      "Could not confidently map this to a known failure class. Escalate for manual review and capture the raw gateway response for the taxonomy to learn from.",
    meaning: "The signals were insufficient or contradictory to classify with confidence.",
  },
};

/**
 * Lightweight signal index: maps common raw substrings (decline codes, gateway
 * messages, bank text) to a category. Used by the deterministic classifier and
 * as a hint set for the LLM. Order matters — first match wins on scan.
 */
export const SIGNAL_INDEX: Array<{ match: RegExp; category: Category }> = [
  { match: /insufficient|not enough (balance|funds)|low balance|nsf/i, category: "insufficient_funds" },
  { match: /expired|expiry|exp[_\s-]?date/i, category: "card_expired" },
  { match: /lost|stolen|pickup|pick[\s-]?up card|restricted card/i, category: "lost_or_stolen" },
  { match: /cvv|cvc|invalid card|incorrect number|invalid (number|account)|card_declined_invalid/i, category: "invalid_details" },
  { match: /3ds|3-?d\s?secure|otp|authentication|auth[_\s-]?fail|sca|password/i, category: "authentication_failed" },
  { match: /fraud|risk|blocked|suspected|blacklist|deny\s?list|velocity block/i, category: "risk_blocked" },
  { match: /limit|exceed|ceiling|per[_\s-]?transaction|daily limit/i, category: "limit_exceeded" },
  { match: /do not honou?r|dnh|\b05\b|generic decline|declined by (bank|issuer)/i, category: "do_not_honor" },
  { match: /issuer (down|unavailable|timeout)|bank (down|timeout)|91|acquirer timeout/i, category: "issuer_unavailable" },
  { match: /gateway|processor|5\d\d|internal error|timeout|server error|technical/i, category: "technical_error" },
  { match: /currency not|method not (enabled|activated)|not configured|invalid api key|test mode|mcc|international.*not enabled/i, category: "config_error" },
];

export function classifyBySignals(raw: string): Category | null {
  for (const { match, category } of SIGNAL_INDEX) {
    if (match.test(raw)) return category;
  }
  return null;
}

/**
 * Retry-strategy buckets — how modern PSPs (Stripe Smart Retries, Checkout.com
 * Smart Dunning, Razorpay's Intelligent Retry Engine) actually action a decline.
 * The industry maps decline *classes* to these buckets rather than handling raw
 * codes one by one. This is the decision Decline Doctor exists to make safely.
 */
export type RetryStrategy =
  | "retry_now" //         transient infra — retry immediately (optionally via alternate acquirer)
  | "retry_scheduled" //   soft decline — retry after a backoff / payday-aligned
  | "retry_with_updater" //credential dead — refresh via network card-updater, then retry
  | "dunning" //           needs the customer to act — send a recovery message + one-click update
  | "route_alternate" //   issuer/gateway down — failover to a healthy acquirer
  | "do_not_retry"; //     hard/fraud — retrying wastes money or escalates risk

export const RETRY_STRATEGY: Record<Category, RetryStrategy> = {
  insufficient_funds: "retry_scheduled",
  do_not_honor: "retry_scheduled",
  card_expired: "retry_with_updater",
  invalid_details: "dunning",
  authentication_failed: "dunning",
  risk_blocked: "do_not_retry",
  limit_exceeded: "retry_scheduled",
  issuer_unavailable: "route_alternate",
  technical_error: "retry_now",
  config_error: "do_not_retry", // merchant must fix config first; retrying is pointless
  lost_or_stolen: "do_not_retry",
  unknown: "do_not_retry",
};

/** Max automatic attempts before handing off to dunning — never burn issuer goodwill. */
export const MAX_RETRIES: Record<RetryStrategy, number> = {
  retry_now: 3,
  retry_scheduled: 4,
  retry_with_updater: 2,
  route_alternate: 3,
  dunning: 0,
  do_not_retry: 0,
};

/** Whether a customer-facing dunning/recovery message helps for this failure. */
export function needsCustomerMessage(category: Category): boolean {
  const owner = TAXONOMY[category].owner;
  return owner === "customer"; // customer must change something; a message drives ~50% of recovery
}

/**
 * Expected recovery probability *given the correct action is taken*, per class.
 * Illustrative but grounded: transient infra recovers almost always; fraud/stolen
 * almost never; customer-action classes land in between. Used to estimate how
 * much declined revenue is realistically recoverable across a batch.
 */
export const RECOVERY_LIKELIHOOD: Record<Category, number> = {
  insufficient_funds: 0.5,
  do_not_honor: 0.35,
  card_expired: 0.6,
  invalid_details: 0.4,
  authentication_failed: 0.7,
  risk_blocked: 0.05,
  limit_exceeded: 0.45,
  issuer_unavailable: 0.85,
  technical_error: 0.8,
  config_error: 0.9,
  lost_or_stolen: 0.0,
  unknown: 0.1,
};

/** How a decision is dispatched — the three lanes a recovery pass routes into. */
export type Lane = "auto" | "customer" | "manual";

export function laneFor(strategy: RetryStrategy): Lane {
  switch (strategy) {
    case "retry_now":
    case "retry_scheduled":
    case "retry_with_updater":
    case "route_alternate":
      return "auto"; // the retry engine can action this without a human
    case "dunning":
      return "customer"; // needs the customer to act (send a message)
    case "do_not_retry":
      return "manual"; // stop / manual review
  }
}
