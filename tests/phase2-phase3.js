import {
  buildActivationPassword,
  buildLoginKey,
  buildPinPassword,
  formatDirectorNumber,
  normalizeActivationCode,
  normalizeFullName,
  validatePin
} from "../js/identity.js";
import { PERMISSIONS, permissionsForTemplate } from "../js/permissions.js";
import { summarizeBoardDirectory } from "../js/board-data.js";

const results = document.querySelector("#results");
const summary = document.querySelector("#summary");
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function equal(actual, expected) {
  if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function assert(value, message) {
  if (!value) throw new Error(message || "Assertion failed");
}

test("Full names normalize case and whitespace", () => {
  equal(normalizeFullName("  Christopher   Shelley  "), "christopher shelley");
});

test("Login keys are deterministic for normalized names", async () => {
  const first = await buildLoginKey("Christopher Shelley");
  const second = await buildLoginKey("  christopher   shelley ");
  equal(first, second);
  equal(first.length, 64);
});

test("Activation codes normalize and create the expected backing format", () => {
  equal(normalizeActivationCode("abcd-efgh-jk23"), "ABCDEFGHJK23");
  equal(buildActivationPassword("ABCD-EFGH-JK23"), "TPP-ACT-ABCDEFGHJK23");
});

test("PIN validation accepts exactly four digits", () => {
  assert(validatePin("0427"));
  assert(!validatePin("427"));
  assert(!validatePin("04278"));
  assert(!validatePin("04a7"));
});

test("PIN backing passwords are account-specific", () => {
  const first = buildPinPassword("1234", "dir-one@tpp-directors.invalid");
  const second = buildPinPassword("1234", "dir-two@tpp-directors.invalid");
  assert(first !== second);
  assert(first.includes("1234"));
});

test("Director numbers are zero-padded", () => {
  equal(formatDirectorNumber(1), "DIR-000001");
  equal(formatDirectorNumber(42), "DIR-000042");
});

test("Standard Director permissions include directory and voting access", () => {
  const permissions = permissionsForTemplate("standard_director");
  assert(permissions.includes(PERMISSIONS.DIRECTORS_VIEW));
  assert(permissions.includes(PERMISSIONS.VOTES_CAST));
});

test("Board directory summaries count current statuses client-side", () => {
  const summary = summarizeBoardDirectory([
    { boardStatus: "interim", votingStatus: "eligible" },
    { boardStatus: "confirmed", votingStatus: "eligible" },
    { boardStatus: "confirmed", votingStatus: "ineligible" },
    { boardStatus: "former", votingStatus: "eligible" }
  ]);
  equal(summary.total, 3);
  equal(summary.interim, 1);
  equal(summary.confirmed, 2);
  equal(summary.votingEligible, 2);
});

let passed = 0;
for (const entry of tests) {
  const row = document.createElement("li");
  try {
    await entry.fn();
    passed += 1;
    row.className = "pass";
    row.textContent = `PASS — ${entry.name}`;
  } catch (error) {
    row.className = "fail";
    row.textContent = `FAIL — ${entry.name}: ${error.message}`;
  }
  results.append(row);
}

summary.textContent = `${passed} of ${tests.length} tests passed.`;
summary.className = `summary ${passed === tests.length ? "pass" : "fail"}`;
