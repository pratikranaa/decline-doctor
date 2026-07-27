/** One-click demo cases — messy, realistic gateway responses across the taxonomy. */
export interface Sample {
  title: string;
  raw: string;
  amount?: number;
  currency?: string;
  method?: string;
  attemptNumber?: number;
}

export const SAMPLES: Sample[] = [
  {
    title: "Do-not-honor (05)",
    raw: 'error_code: "BAD_REQUEST_PAYMENT_FAILED", reason: "GATEWAY_ERROR", bank_code: "05", description: "Do not honor. Payment failed. Contact your bank."',
    amount: 4999,
    currency: "INR",
    method: "card",
    attemptNumber: 1,
  },
  {
    title: "Insufficient funds",
    raw: 'code=insufficient_funds; message="Your card has insufficient funds."; network_decline_code=51',
    amount: 129900,
    currency: "INR",
    method: "card",
    attemptNumber: 2,
  },
  {
    title: "3DS / OTP dropped",
    raw: 'status: failed, reason: "3DS authentication failed - customer did not complete OTP", step: "authentication"',
    amount: 2599,
    currency: "INR",
    method: "card",
  },
  {
    title: "Expired card (subscription)",
    raw: 'decline_code: "expired_card", message: "The card has expired.", recurring: true',
    amount: 799,
    currency: "INR",
    method: "card",
  },
  {
    title: "Fraud block",
    raw: 'RISK_ENGINE: transaction blocked, score=0.94, rule="velocity+geo mismatch", action=DENY',
    amount: 89999,
    currency: "INR",
    method: "card",
  },
  {
    title: "Issuer downtime",
    raw: 'gateway_response: "Issuer bank unavailable - request timed out", code: "91", acquirer: "HDFC"',
    amount: 15000,
    currency: "INR",
    method: "upi",
  },
  {
    title: "Merchant misconfig",
    raw: 'error: "International cards are not enabled for this merchant account", mode: "live", currency: "USD"',
    amount: 4900,
    currency: "USD",
    method: "card",
  },
];
