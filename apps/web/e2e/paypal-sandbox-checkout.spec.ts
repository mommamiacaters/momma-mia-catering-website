/**
 * PayPal SANDBOX end-to-end checkout (guest card). Creates a REAL row in the
 * live production DB (play money only), so it is skipped unless opted in:
 *
 *   cd apps/web && PAYPAL_SANDBOX_E2E=1 npx playwright test e2e/paypal-sandbox-checkout.spec.ts
 *
 * Requires apps/web/.env with VITE_PAYPAL_ENV=sandbox, a sandbox
 * VITE_PAYPAL_CLIENT_ID and VITE_PAYPAL_SANDBOX_KEY (local dev server only).
 * Uses a PayPal sandbox test card; never log into a PayPal account.
 * A COMPLETED sandbox payment is archived, labelled [SANDBOX] and never emailed
 * (migration 20261113000300). An abandoned/rejected attempt leaves an unpaid
 * `awaiting_payment` row — archive those by the test email afterwards.
 *
 * Status 2026-11-13: reaches PayPal's guest card form, but PayPal rejected the
 * published test Visas (4032039317984658, 4012000077777777). Use a card from the
 * developer dashboard's Credit Card Generator (country: Philippines) via
 * PAYPAL_SANDBOX_CARD, or pay manually with a sandbox buyer account.
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";

const EMAIL = process.env.PAYPAL_SANDBOX_EMAIL ?? "kitdaniellim+mm-sandbox-test@gmail.com";
const CARD = process.env.PAYPAL_SANDBOX_CARD ?? "4012000077777777"; // Visa from PayPal card-testing docs (4032039317984658 is rejected for guest checkout)

function isoDaysAhead(n: number): string {
  // Asia/Manila calendar date, n days from now.
  const d = new Date(Date.now() + n * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
}

async function fillCard(scope: Page | FrameLocator): Promise<void> {
  const fill = async (sel: string, v: string) => {
    const el = scope.locator(sel).first();
    if (!(await el.isVisible().catch(() => false))) return;
    const tag = await el.evaluate((n) => n.tagName);
    if (tag === "SELECT") {
      // Billing state/province is a dropdown: pick the first real option.
      const opts = await el.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      if (opts.length) await el.selectOption(opts.includes(v) ? v : opts[0]);
    } else await el.fill(v);
  };
  await scope.locator("#cardNumber, input[name='cardnumber'], input[autocomplete='cc-number']").first().fill(CARD);
  await scope.locator("#cardExpiry, input[autocomplete='cc-exp'], input[name='expiry']").first().fill("12/2030");
  await scope.locator("#cardCvv, input[autocomplete='cc-csc'], input[name='cvv']").first().fill("123");
  await fill("#firstName, input[name='firstName']", "Sandbox");
  await fill("#lastName, input[name='lastName']", "Test");
  await fill("#billingLine1, input[name='billingLine1']", "TEST 1 Rizal St");
  await fill("#billingCity, input[name='billingCity']", "Makati");
  await fill("#billingState, input[name='billingState']", "Metro Manila");
  await fill("#billingPostalCode, input[name='billingPostalCode']", "1200");
  await fill("#phone, input[name='phone']", "09170000000");
  await fill("#email, input[name='email']", EMAIL);
}

test.describe("PayPal sandbox checkout", () => {
  test.skip(!process.env.PAYPAL_SANDBOX_E2E, "Set PAYPAL_SANDBOX_E2E=1 to create a real sandbox-paid order");
  test.setTimeout(180_000);

  test("guest card payment completes and shows an order ref", async ({ page, context }, testInfo) => {
    // Cheapest cart: Party Trays, 5 x 1-dish box (minimum 5).
    await page.goto("/services/party-trays");
    await page.getByRole("button", { name: /Select This Plan/i }).first().click();
    await page.locator("button", { hasText: /^Add$/ }).first().click(); // adds the dish to all 5 boxes
    await page.locator("button", { hasText: /^Your Order/ }).first().click();
    await page.getByRole("button", { name: /Proceed to Checkout/ }).click();
    await page.waitForURL(/checkout/);

    // Delivery step
    await page.locator("input[name=firstName]").fill("Sandbox");
    await page.locator("input[name=lastName]").fill("Test");
    await page.locator("#ck-email").fill(EMAIL);
    await page.locator("#ck-phone").fill("09170000000");
    await page.locator("#ck-date").fill(isoDaysAhead(7));
    await page.locator("#ck-time").fill("12:00");
    await page.locator("#ck-address").fill("TEST ORDER - do not fulfil");
    await page.locator("#ck-requests").fill("SANDBOX TEST - do not fulfil");
    await page.getByRole("button", { name: /Continue to Payment/ }).click();

    // Payment step -> PayPal
    await page.locator("[role=radiogroup] >> text=PayPal or card").click();
    const ppFrame = page.frameLocator("iframe[title*='PayPal' i], iframe[name^='__zoid__paypal_buttons']").first();
    const cardBtn = ppFrame.locator("[data-funding-source='card']").first();
    await expect(cardBtn).toBeVisible({ timeout: 60_000 });

    // The SDK button occasionally swallows the first click while it hydrates:
    // retry (createOrder reuses the pending order, so this can't double-create).
    let popup: Page | null = null;
    for (let i = 0; i < 4 && !popup; i++) {
      await page.waitForTimeout(1500);
      const popupPromise = page.waitForEvent("popup", { timeout: 20_000 }).catch(() => null);
      await cardBtn.click();
      popup = await popupPromise;
    }

    if (popup) {
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup.locator("#cardNumber, input[autocomplete='cc-number']").first()).toBeVisible({ timeout: 90_000 });
      await fillCard(popup);
      await popup.screenshot({ path: testInfo.outputPath("paypal-card-form.png") });
      // Guest form insists on an answer to "create a PayPal account?" — decline.
      const noAccount = popup.getByText(/No, I don't want an account now/i).first();
      if (await noAccount.isVisible().catch(() => false)) await noAccount.click();
      await popup.locator("button:has-text('Pay Now'), button:has-text('Pay'), button[type=submit]").first().click();
    } else {
      // Inline card form (iframe) variant.
      const inline = page.frameLocator("iframe[name*='card' i], iframe[title*='card' i]").first();
      await fillCard(inline);
      await inline.locator("button[type=submit], button:has-text('Pay')").first().click();
    }
    void context;

    await expect(page.getByRole("heading", { name: /Thank you for your order/i })).toBeVisible({ timeout: 120_000 });
    const ref = (await page.locator("text=Order Reference:").locator("span").first().textContent())?.trim() ?? "";
    console.log(`ORDER_REF=${ref} EMAIL=${EMAIL} URL=${page.url()}`);
    await testInfo.attach("order-ref", { body: `${ref}\n${page.url()}`, contentType: "text/plain" });
    await page.screenshot({ path: testInfo.outputPath("confirmation.png"), fullPage: true });
    expect(ref).toMatch(/^MM-/);
  });
});
