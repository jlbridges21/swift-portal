/**
 * Proposal approval → invoice rules: who gets an invoice on approval, how much, and why
 * approving again (double click, refresh, Pay Now retry, two tabs) never makes a second one.
 * Pure logic, no database or Stripe.
 * Run: npx tsx scripts/verify-approval-payment.ts
 */
import assert from "node:assert/strict";
import {
  blocksApprovalPayment,
  clientPayChoice,
  earlierCompetingPaymentRow,
  existingApprovalPaymentState,
  paidCentsForQuote,
  parseExplicitDepositTerms,
  quoteCollectsPaymentOnApproval,
  quoteOutstandingBalanceCents,
  quotePaymentTermsText,
  resolveDepositCharge,
  resolveQuoteDepositTerms,
  type DepositTerms,
} from "../src/lib/payment-quote";
import { signPayLinkToken, verifyPayLinkToken } from "../src/lib/pay-link";
import type { Payment, ProjectQuote } from "../src/lib/types";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`OK: ${name}`);
}

const business: DepositTerms = { depositMode: "percent", depositPercent: 50, depositAmountCents: 0 };
const on = { autoCreateOnApproval: true, business };

function quote(over: Partial<ProjectQuote> = {}): ProjectQuote {
  return {
    id: "q1",
    title: "Official Proposal",
    quote_kind: "official",
    status: "approved",
    total_cents: 40000,
    deposit_mode: null,
    deposit_percent: null,
    deposit_amount_cents: null,
    ...over,
  } as ProjectQuote;
}

function pay(id: string, status: Payment["status"], amount = 20000): Payment {
  return { id, status, amount, quote_id: "q1" } as Payment;
}

// ── Who is billed on approval ────────────────────────────────────────────────
check("full payment terms collect on approval", () => {
  assert.equal(quoteCollectsPaymentOnApproval(quote({ deposit_mode: "none" }), on), true);
});
check("deposit terms collect on approval", () => {
  assert.equal(quoteCollectsPaymentOnApproval(quote({ deposit_mode: "percent", deposit_percent: 25 }), on), true);
});
check("'invoice later' terms do not collect on approval", () => {
  assert.equal(quoteCollectsPaymentOnApproval(quote({ deposit_mode: "later" }), on), false);
});
check("$0 proposal does not collect", () => {
  assert.equal(quoteCollectsPaymentOnApproval(quote({ total_cents: 0 }), on), false);
});
check("preliminary estimates never collect", () => {
  assert.equal(quoteCollectsPaymentOnApproval(quote({ quote_kind: "preliminary" }), on), false);
  assert.equal(quoteCollectsPaymentOnApproval(quote({ title: "Preliminary Estimate – Photos" }), on), false);
});
check("business automation off → nothing collected on approval", () => {
  assert.equal(quoteCollectsPaymentOnApproval(quote({ deposit_mode: "none" }), { ...on, autoCreateOnApproval: false }), false);
});
check("legacy proposal (no terms) uses the business default", () => {
  const terms = resolveQuoteDepositTerms(quote(), business);
  assert.equal(terms.depositMode, "percent");
  assert.equal(quoteCollectsPaymentOnApproval(quote(), on), true);
});

// ── How much ────────────────────────────────────────────────────────────────
check("50% deposit of $400 charges $200 and leaves $200", () => {
  const charge = resolveDepositCharge(40000, resolveQuoteDepositTerms(quote({ deposit_mode: "percent", deposit_percent: 50 }), business));
  assert.deepEqual([charge.amountCents, charge.isDeposit], [20000, true]);
});
check("fixed $150 deposit", () => {
  const charge = resolveDepositCharge(40000, resolveQuoteDepositTerms(quote({ deposit_mode: "amount", deposit_amount_cents: 15000 }), business));
  assert.deepEqual([charge.amountCents, charge.isDeposit], [15000, true]);
});
check("full payment charges the total", () => {
  const charge = resolveDepositCharge(40000, resolveQuoteDepositTerms(quote({ deposit_mode: "none" }), business));
  assert.deepEqual([charge.amountCents, charge.isDeposit], [40000, false]);
});
check("'later' resolves to the full total for the eventual invoice", () => {
  const charge = resolveDepositCharge(40000, { depositMode: "later", depositPercent: 0, depositAmountCents: 0 });
  assert.deepEqual([charge.amountCents, charge.isDeposit], [40000, false]);
});
check("'later' is accepted from the editor and described to the client", () => {
  assert.equal(parseExplicitDepositTerms({ deposit_mode: "later" })?.depositMode, "later");
  assert.match(quotePaymentTermsText(40000, { depositMode: "later", depositPercent: 0, depositAmountCents: 0 }), /No payment is due on approval/);
});

// ── Remaining balance after a deposit ───────────────────────────────────────
check("deposit paid → $200 paid, $200 balance", () => {
  const rows = [pay("p1", "paid", 20000)];
  assert.equal(paidCentsForQuote(rows, "q1"), 20000);
  assert.equal(quoteOutstandingBalanceCents(quote(), rows), 20000);
});
check("bank deposit processing counts toward the balance", () => {
  assert.equal(quoteOutstandingBalanceCents(quote(), [pay("p1", "processing", 20000)]), 20000);
});
check("deposit invoice offers pay-in-full when allowed", () => {
  const terms = resolveQuoteDepositTerms(quote({ deposit_mode: "percent", deposit_percent: 50 }), business);
  const choice = clientPayChoice({ terms, allowClientPayInFull: true, payment: pay("p1", "sent"), quoteTotalCents: 40000, paidCents: 0 });
  assert.equal(choice?.offerPayInFull, true);
  assert.equal(choice?.depositCents, 20000);
});

// ── Approving again reuses the invoice ──────────────────────────────────────
check("no invoice yet → one may be created", () => {
  assert.equal(existingApprovalPaymentState([]), null);
});
check("open invoice (abandoned checkout) is returned, not recreated", () => {
  const state = existingApprovalPaymentState([pay("p1", "sent")]);
  assert.equal(state?.status, "ready");
  assert.equal(state && "payment" in state ? state.payment.id : null, "p1");
});
check("pending invoice still being created is returned", () => {
  assert.equal(existingApprovalPaymentState([pay("p1", "pending")])?.status, "ready");
});
check("paid deposit → covered, no new invoice on retry", () => {
  assert.equal(existingApprovalPaymentState([pay("p1", "paid")])?.status, "covered");
});
check("paid deposit + open balance invoice → the balance is payable", () => {
  const state = existingApprovalPaymentState([pay("p1", "paid"), pay("p2", "sent")]);
  assert.equal(state && "payment" in state ? state.payment.id : null, "p2");
});
check("business draft invoice → left to the business", () => {
  assert.equal(existingApprovalPaymentState([pay("p1", "draft")])?.status, "not_required");
});
check("cancelled / failed / expired rows don't block a fresh invoice", () => {
  for (const s of ["cancelled", "failed", "expired"] as const) assert.equal(blocksApprovalPayment(s), false);
  assert.equal(existingApprovalPaymentState([pay("p1", "cancelled"), pay("p2", "expired")]), null);
});

// ── Concurrent approvals (double click, two tabs) ───────────────────────────
check("two concurrent approval inserts: the later one yields to the earliest", () => {
  const rows = [pay("first", "pending"), pay("second", "pending")];
  assert.equal(earlierCompetingPaymentRow(rows, "second", "approval")?.id, "first");
  assert.equal(earlierCompetingPaymentRow(rows, "first", "approval"), null);
});
check("approval after a paid row yields to it (no second charge)", () => {
  assert.equal(earlierCompetingPaymentRow([pay("old", "paid"), pay("new", "pending")], "new", "approval")?.id, "old");
});
check("approval ignores an earlier cancelled row", () => {
  assert.equal(earlierCompetingPaymentRow([pay("old", "cancelled"), pay("new", "pending")], "new", "approval"), null);
});
check("manual balance invoice after a paid deposit is allowed", () => {
  assert.equal(earlierCompetingPaymentRow([pay("dep", "paid"), pay("bal", "pending")], "bal", "manual"), null);
});
check("manual invoice yields to an open approval invoice", () => {
  assert.equal(earlierCompetingPaymentRow([pay("auto", "sent"), pay("man", "pending")], "man", "manual")?.id, "auto");
});

// ── Invoice links (View Invoice / Copy Invoice Link) ────────────────────────
check("invoice link signed by a Preview (no PAY_LINK_SECRET) opens on Production", () => {
  const pid = "22222222-2222-4222-8222-222222222222";
  const bid = "44444444-4444-4444-8444-444444444444";
  const saved = { pay: process.env.PAY_LINK_SECRET, plat: process.env.PLATFORM_SESSION_SECRET, cron: process.env.CRON_SECRET };
  try {
    delete process.env.CRON_SECRET;
    delete process.env.PAY_LINK_SECRET;
    process.env.PLATFORM_SESSION_SECRET = "shared-session-secret";
    const previewToken = signPayLinkToken(pid, bid);
    process.env.PAY_LINK_SECRET = "production-pay-secret";
    assert.equal(verifyPayLinkToken(previewToken, bid), true);
    assert.equal(verifyPayLinkToken(signPayLinkToken(pid, bid), bid), true);
    assert.equal(verifyPayLinkToken(previewToken, "55555555-5555-4555-8555-555555555555"), false, "bound to its business");
    process.env.PLATFORM_SESSION_SECRET = "rotated";
    assert.equal(verifyPayLinkToken(previewToken, bid), false, "unknown secret is rejected");
  } finally {
    for (const [k, v] of [["PAY_LINK_SECRET", saved.pay], ["PLATFORM_SESSION_SECRET", saved.plat], ["CRON_SECRET", saved.cron]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

console.log(`\nAll ${passed} approval payment checks passed.`);
