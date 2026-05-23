import { test, expect } from "@playwright/test";

test.describe("Service Page Carousel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/services/check-a-lunch");
    await page.waitForSelector("[aria-roledescription='carousel']");
  });

  test("renders carousel with images and dot indicators", async ({ page }) => {
    const carousel = page.locator("[aria-roledescription='carousel']");
    await expect(carousel).toBeVisible();

    // Should have multiple slides
    const slides = carousel.locator("> div");
    const count = await slides.count();
    expect(count).toBeGreaterThan(1);

    // Should have matching dot indicators
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

  test("previous button is disabled on first slide", async ({ page }) => {
    const prevBtn = page.locator("button[aria-label='Previous image']");
    await expect(prevBtn).toBeDisabled();
  });

  test("image preview modal opens on keyboard Enter and closes on ESC", async ({ page }) => {
    // Focus the first slide and press Enter (avoids drag detection issues)
    const firstSlide = page.locator("div[role='button'][aria-label^='Preview']").first();
    await firstSlide.focus();
    await page.keyboard.press("Enter");

    // Modal should open
    const modal = page.locator("div[role='dialog']");
    await expect(modal).toBeVisible();

    // Press ESC to close
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("active dot has larger size than inactive dots", async ({ page }) => {
    const dots = page.locator("button[aria-label^='Go to image']");

    // Active dot (first) should have w-3 h-3 class
    await expect(dots.nth(0)).toHaveClass(/w-3/);
    // Inactive dot should have w-2 h-2 class
    await expect(dots.nth(1)).toHaveClass(/w-2/);
  });
});
