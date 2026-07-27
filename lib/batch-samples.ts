import type { DiagnoseInput } from "./agent";

/** A realistic mixed stream of failed payments (amounts in INR paise-free rupees). */
export const SAMPLE_BATCH: DiagnoseInput[] = [
  { raw: 'bank_code "05" Do not honor', amount: 4999, currency: "INR", method: "card" },
  { raw: "insufficient_funds - card has insufficient balance", amount: 129900, currency: "INR", method: "card" },
  { raw: "3DS authentication failed - OTP not completed", amount: 2599, currency: "INR", method: "card" },
  { raw: "expired_card - the card has expired, recurring subscription", amount: 799, currency: "INR", method: "card" },
  { raw: "RISK_ENGINE blocked score=0.94 velocity+geo mismatch DENY", amount: 89999, currency: "INR", method: "card" },
  { raw: 'Issuer bank unavailable request timed out code "91"', amount: 15000, currency: "INR", method: "upi" },
  { raw: "International cards not enabled for this merchant account", amount: 4900, currency: "INR", method: "card" },
  { raw: "insufficient funds nsf", amount: 349, currency: "INR", method: "card" },
  { raw: "gateway internal error 502 processor timeout", amount: 24999, currency: "INR", method: "card" },
  { raw: "invalid cvv - card verification failed", amount: 1299, currency: "INR", method: "card" },
  { raw: "do not honor declined by issuer", amount: 6499, currency: "INR", method: "card" },
  { raw: "card reported lost restricted card pickup", amount: 39999, currency: "INR", method: "card" },
  { raw: "3-d secure OTP abandoned by customer", amount: 899, currency: "INR", method: "card" },
  { raw: "per-transaction limit exceeded daily limit", amount: 250000, currency: "INR", method: "card" },
  { raw: "expired_card update required", amount: 1499, currency: "INR", method: "card" },
  { raw: "issuer down HDFC acquirer timeout", amount: 7999, currency: "INR", method: "upi" },
  { raw: "insufficient balance on card", amount: 3499, currency: "INR", method: "card" },
  { raw: "some weird unmapped gateway string xyz-999", amount: 5000, currency: "INR", method: "card" },
];
