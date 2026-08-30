import { test, expect, type Locator, type Page } from "@playwright/test";

const DOTS = "button[aria-label^='Go to image']";

/** A 1x1 PNG — the smallest thing a browser will decode successfully. */
const STUB_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Serve every carousel photo as a tiny PNG instead of fetching the real file.
 *
 * This is what makes the suite deterministic. useCarouselImages publishes the
 * rows immediately, then ~800ms later decodes each photo off-screen and PRUNES
 * any that won't paint. Two of Check-a-Lunch's four photos are .heic, which
 * Chromium cannot decode, so they are ALWAYS pruned — the carousel drops from
 * four dots to two at an unpredictable moment. A prune also changes
 * ServicePage's `key={carouselImages.join("|")}`, remounting the carousel, so a
 * count read a moment earlier goes stale and `dots.nth(count - 1)` resolves to
 * nothing. That timing, not any carousel logic, is what made these tests flaky.
 *
 * Stubbing removes image delivery from the picture entirely: every slide
 * decodes, nothing is pruned, and the strip is stable from first paint. These
 * tests are about navigating the strip, not about how photos are served.
 */
async function stubCarouselPhotos(page: Page): Promise<{ count: () => number }> {
  let intercepted = 0;
  // Scoped to Supabase storage but agnostic about the path SHAPE, so a signed
  // (/object/sign/) or transform (/render/image/public/) URL is caught just as
  // an unsigned one is. It must stay scoped: matching every *.png would also
  // swallow Vite's dev module URLs (/src/assets/logo.png?import), which have to
  // be served as JS — fulfilling those as binary blanks the whole app.
  await page.route(/supabase\.co\/storage\/v1\/.*\.(jpe?g|png|webp|heic|heif|avif)/i, (route) => {
    intercepted += 1;
    return route.fulfill({ status: 200, contentType: "image/png", body: STUB_PNG });
  });
  return { count: () => intercepted };
}

/**
 * The dot count, once it has stopped changing.
 *
 * With photos stubbed nothing is ever pruned, so this only has to wait for the
 * dots to render — it is NOT a guard against the prune sweep, which starts
 * later than this returns. The stub, and the assertion that it fired, are what
 * rule the sweep out.
 */
async function settledSlideCount(page: Page): Promise<number> {
  const dots = page.locator(DOTS);
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const n = await dots.count();
    if (n === last && n > 1) return n;
    last = n;
    await page.waitForTimeout(100);
  }
  // Two genuinely different failures — say which one happened, so nobody goes
  // hunting through fixture data when the real problem is a churning count.
  throw new Error(
    last <= 1
      ? `Carousel rendered ${last} dot(s); these tests need a service page with at least 2 photos.`
      : `Carousel dot count never stopped changing (last: ${last}) — a prune sweep is still running.`,
  );
}

/**
 * Wait for the strip to be still, without requiring it to have moved.
 *
 * Used for the setup pin, where landing on slide one may be a no-op because
 * the strip is already there — so demanding movement would hang.
 */
async function waitForStripStill(page: Page): Promise<void> {
  await page.evaluate(() => {
    delete (window as unknown as Record<string, unknown>).__still;
  });
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLElement>("[aria-roledescription='carousel']");
      if (!el) return false;
      const w = window as unknown as { __still?: { left: number; since: number } };
      const now = performance.now();
      if (!w.__still || w.__still.left !== el.scrollLeft) {
        w.__still = { left: el.scrollLeft, since: now };
        return false;
      }
      return now - w.__still.since > 250;
    },
    undefined,
    { timeout: 10_000, polling: 50 },
  );
}

async function scrollLeftOf(page: Page): Promise<number> {
  const left = await page.evaluate(
    () =>
      document.querySelector<HTMLElement>("[aria-roledescription='carousel']")?.scrollLeft ?? null,
  );
  // A sentinel here would be worse than useless: it can never equal a real
  // scrollLeft, which would silently disable the "did it actually move?" guard.
  if (left === null) throw new Error("Carousel track not found when reading scroll position.");
  return left;
}

/**
 * Click something that moves the strip, then wait for it to come to rest.
 *
 * Taking the position BEFORE the click matters: without it, "the strip has not
 * started moving yet" is indistinguishable from "the strip has stopped", and
 * the helper could return with the carousel still sitting where it began — the
 * exact false pass it exists to prevent. So we require the position to change
 * first, then to hold still for longer than the component's 90ms settle
 * debounce, which is when the index gets re-synced from the real scroll offset
 * and any clone re-anchor happens.
 */
async function clickAndSettle(page: Page, target: Locator): Promise<void> {
  const before = await scrollLeftOf(page);
  await target.click();

  await page.waitForFunction(
    (start: number) => {
      const el = document.querySelector<HTMLElement>("[aria-roledescription='carousel']");
      if (!el) return false;
      const w = window as unknown as { __probe?: { left: number; since: number } };
      const now = performance.now();
      // Still parked where it started — the scroll has not begun.
      if (el.scrollLeft === start) {
        w.__probe = undefined;
        return false;
      }
      if (!w.__probe || w.__probe.left !== el.scrollLeft) {
        w.__probe = { left: el.scrollLeft, since: now };
        return false;
      }
      return now - w.__probe.since > 200;
    },
    before,
    { timeout: 10_000, polling: 50 },
  );
}

test.describe("Service Page Carousel", () => {
  test.beforeEach(async ({ page }) => {
    const photos = await stubCarouselPhotos(page);
    await page.goto("/services/check-a-lunch");
    await page.waitForSelector("[aria-roledescription='carousel']");
    await settledSlideCount(page);

    // If the stub ever stops matching the real URLs, the flake comes back with
    // no signal at all. Fail here instead, where the cause is obvious.
    expect(
      photos.count(),
      "No carousel photo requests were intercepted — the stub pattern no longer matches image_url",
    ).toBeGreaterThan(0);

    // Every test below counts from the FIRST slide, so pin it. The dot handler
    // calls startAutoPlay(), which restarts the 5s clock.
    await page.locator("button[aria-label='Go to image 1']").click();
    await waitForStripStill(page);

    // Park the pointer over the track. The component pauses auto-play while
    // hovered, which protects the one test that never clicks — without it a
    // 5s tick can advance the strip mid-assertion. Tests that DO click move
    // the pointer away, but each of their clicks restarts the clock anyway.
    await page.locator("[aria-roledescription='carousel']").hover();
  });

  test("renders carousel with images and dot indicators", async ({ page }) => {
    const carousel = page.locator("[aria-roledescription='carousel']");
    await expect(carousel).toBeVisible();

    // Real slides carry aria-roledescription='slide'; the loop's edge clones
    // are aria-hidden and unlabeled, so they are excluded here.
    const slides = carousel.locator("[aria-roledescription='slide']");
    const count = await slides.count();
    expect(count).toBeGreaterThan(1);

    // The strip is real slides plus CLONE_PAD copies on each side.
    const allChildren = carousel.locator("> div");
    await expect(allChildren).toHaveCount(count + 4);

    // Dots match REAL images only, never the clones
    const dots = page.locator("button[aria-label^='Go to image']");
    await expect(dots).toHaveCount(count);

    // First dot should be active (larger size = active indicator)
    const firstDot = dots.nth(0);
    await expect(firstDot).toHaveClass(/bg-brand-primary/);
  });

  test("dot indicator updates instantly on next button click", async ({ page }) => {
    const nextBtn = page.locator("button[aria-label='Next image']");
    const dots = page.locator("button[aria-label^='Go to image']");

    // "Instantly" is the point: goTo sets the index synchronously, so the dot
    // must flip before the smooth scroll has finished. Check that first...
    const before = await scrollLeftOf(page);
    await nextBtn.click();
    const secondDot = dots.nth(1);
    const firstDot = dots.nth(0);
    await expect(secondDot).toHaveClass(/bg-brand-primary/);
    await expect(firstDot).toHaveClass(/bg-brand-divider/);

    // ...then that the strip really travelled and the settle handler agrees,
    // so a broken scroll cannot pass on the optimistic index alone.
    await waitForStripStill(page);
    expect(await scrollLeftOf(page)).not.toBe(before);
    await expect(secondDot).toHaveClass(/bg-brand-primary/);
  });

  test("dot indicator updates on dot click navigation", async ({ page }) => {
    const dots = page.locator("button[aria-label^='Go to image']");
    const count = await dots.count();
    if (count < 3) return; // Need at least 3 slides

    // Click third dot
    await clickAndSettle(page, dots.nth(2));

    // Third dot should be active
    await expect(dots.nth(2)).toHaveClass(/bg-brand-primary/);
    // First dot should be inactive
    await expect(dots.nth(0)).toHaveClass(/bg-brand-divider/);
  });

  test("dot indicator updates after navigating multiple slides", async ({ page }) => {
    const nextBtn = page.locator("button[aria-label='Next image']");
    const dots = page.locator("button[aria-label^='Go to image']");
    const count = await dots.count();
    if (count < 3) return;

    // Navigate forward twice, letting the strip come to rest between hops.
    // The old fixed 400ms was the flake: on a slow run the scroll had not
    // finished, so the settle handler re-synced the index from a position
    // partway back and the strip never reached slide three.
    await clickAndSettle(page, nextBtn);
    await expect(dots.nth(1)).toHaveClass(/bg-brand-primary/);
    await clickAndSettle(page, nextBtn);

    // Third dot should be active
    await expect(dots.nth(2)).toHaveClass(/bg-brand-primary/);
    // First two should be inactive
    await expect(dots.nth(0)).toHaveClass(/bg-brand-divider/);
    await expect(dots.nth(1)).toHaveClass(/bg-brand-divider/);
  });

  test("previous button wraps to the last image (infinite loop)", async ({ page }) => {
    // The strip loops, so prev is never disabled — from the first image it
    // slides onto the preceding clone and re-anchors on the LAST real image.
    const prevBtn = page.locator("button[aria-label='Previous image']");
    await expect(prevBtn).toBeEnabled();

    const dots = page.locator("button[aria-label^='Go to image']");
    const count = await dots.count();

    // Smooth scroll, settle debounce and the clone re-anchor all have to
    // finish; waiting on scrollLeft covers all three without guessing.
    await clickAndSettle(page, prevBtn);

    await expect(dots.nth(count - 1)).toHaveClass(/bg-brand-primary/);
    await expect(dots.nth(0)).toHaveClass(/bg-brand-divider/);
  });

  test("image preview modal opens on keyboard Enter and closes on ESC", async ({ page }) => {
    // Focus the first slide and press Enter (avoids drag detection issues).
    // The slide's aria-label is "View <title> image N fullscreen" — it used to
    // start with "Preview", which is why this selector had gone stale.
    const firstSlide = page.locator("div[role='button'][aria-label^='View']").first();
    await firstSlide.focus();
    await page.keyboard.press("Enter");

    // Modal should open
    const modal = page.locator("div[role='dialog']");
    await expect(modal).toBeVisible();

    // Press ESC to close
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("active dot is visually distinct from inactive dots", async ({ page }) => {
    const dots = page.locator("button[aria-label^='Go to image']");

    // The active indicator is a WIDE PILL (w-6 h-2) in brand colour; inactive
    // ones are small round dots (w-2 h-2). This assertion used to look for
    // w-3 vs w-2, from when the active dot was a bigger circle.
    await expect(dots.nth(0)).toHaveClass(/w-6/);
    await expect(dots.nth(0)).toHaveClass(/bg-brand-primary/);
    await expect(dots.nth(1)).toHaveClass(/w-2/);
    await expect(dots.nth(1)).not.toHaveClass(/w-6/);
  });
});
