import { test, expect } from "@playwright/test";

test.describe("Service Page Carousel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/services/check-a-lunch");
    await page.waitForSelector("[aria-roledescription='carousel']");
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

    // Click next
    await nextBtn.click();

    // Wait for scroll to settle (snap)
    await page.waitForTimeout(400);

    // Second dot should now be active
    const secondDot = dots.nth(1);
    await expect(secondDot).toHaveClass(/bg-brand-primary/);

    // First dot should be inactive
    const firstDot = dots.nth(0);
    await expect(firstDot).toHaveClass(/bg-brand-divider/);
  });

  test("dot indicator updates on dot click navigation", async ({ page }) => {
    const dots = page.locator("button[aria-label^='Go to image']");
    const count = await dots.count();
    if (count < 3) return; // Need at least 3 slides

    // Click third dot
    await dots.nth(2).click();
    await page.waitForTimeout(400);

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

    // Navigate forward twice
    await nextBtn.click();
    await page.waitForTimeout(400);
    await nextBtn.click();
    await page.waitForTimeout(400);

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

    await prevBtn.click();
    // Smooth scroll + settle debounce + re-anchor need a moment
    await page.waitForTimeout(900);

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
