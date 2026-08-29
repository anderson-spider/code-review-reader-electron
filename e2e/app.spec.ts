import { test, expect } from '@playwright/test';

test.describe('Application Loading', () => {
  test('should load the app and display the header', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Check that the header is visible
    await expect(page.locator('header')).toBeVisible();

    // Check that the main title is visible
    await expect(page.getByRole('heading', { name: 'Code Review Reader' })).toBeVisible();
  });

  test('should display the MR input field', async ({ page }) => {
    await page.goto('/');

    // Check that the MR URL input is visible
    const input = page.getByPlaceholder('Paste GitLab MR URL here...');
    await expect(input).toBeVisible();

    // Check that the Review button is visible but disabled when input is empty
    const reviewButton = page.getByRole('button', { name: 'Review' });
    await expect(reviewButton).toBeVisible();
    await expect(reviewButton).toBeDisabled();
  });

  test('should enable the Review button when URL is entered', async ({ page }) => {
    await page.goto('/');

    // Get the input and button
    const input = page.getByPlaceholder('Paste GitLab MR URL here...');
    const reviewButton = page.getByRole('button', { name: 'Review' });

    // Type a URL
    await input.fill('https://gitlab.com/project/repo/-/merge_requests/123');

    // Check that the button is now enabled
    await expect(reviewButton).toBeEnabled();
  });

  test('should display settings button in header', async ({ page }) => {
    await page.goto('/');

    // Check that the settings button is visible (use exact match for header button)
    const settingsButton = page.getByLabel('Settings');
    await expect(settingsButton).toBeVisible();
  });

  test('should show empty state by default', async ({ page }) => {
    await page.goto('/');

    // The main content area should be visible
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
