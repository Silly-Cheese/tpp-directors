const textEncoder = new TextEncoder();
const ACTIVATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeFullName(value = "") {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

export async function buildLoginKey(fullName) {
  const normalizedName = normalizeFullName(fullName);
  if (!normalizedName) throw new Error("A full name is required.");

  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(normalizedName));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateAuthEmail() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `dir-${token}@tpp-directors.invalid`;
}

export function generateActivationCode() {
  const values = new Uint8Array(12);
  crypto.getRandomValues(values);
  const code = Array.from(values, (value) => ACTIVATION_ALPHABET[value % ACTIVATION_ALPHABET.length]).join("");
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export function normalizeActivationCode(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildActivationPassword(activationCode) {
  const code = normalizeActivationCode(activationCode);
  if (code.length !== 12) throw new Error("Enter the complete activation code.");
  return `TPP-ACT-${code}`;
}

export function validatePin(pin) {
  return /^\d{4}$/.test(String(pin ?? ""));
}

export function buildPinPassword(pin, authEmail) {
  const pinValue = String(pin ?? "");
  if (!validatePin(pinValue)) throw new Error("PIN must contain exactly four digits.");
  if (!authEmail) throw new Error("The Board account could not be identified.");

  // Directors see and remember only their four-digit PIN. Firebase Authentication
  // receives a longer account-specific backing password so the visible PIN flow can
  // coexist with Firebase's password credential requirements. The PIN itself is never
  // written to Firestore.
  return `TPP|PIN|${pinValue}|${String(authEmail).toLowerCase()}`;
}

export function formatDirectorNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error("Invalid director number.");
  return `DIR-${String(number).padStart(6, "0")}`;
}
