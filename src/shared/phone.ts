// Single shared identity key for a mobile number, used everywhere a phone
// number is compared for identity: OTP request/verify, customer_account
// lookups, staff-entered membership mobiles, and Gym membership auto-link /
// duplicate detection. Strips all formatting (spaces, dashes, "+91", a
// leading "0") down to the last 10 digits, so "9999999999",
// "+91 9999999999", "+919999999999" and "099999 99999" all resolve to the
// same canonical key. Returns "" for anything that doesn't carry at least
// one digit.
export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.slice(-10);
}
