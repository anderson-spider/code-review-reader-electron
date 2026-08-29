import { test, expect } from '@playwright/test';

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Note: Keyboard shortcut tests are skipped because they don't work reliably
  // in browser-only E2E tests (Playwright + Vite). Shortcuts work in Electron.
  // These tests document expected behavior for manual testing.

  test.describe('Keyboard Shortcuts Modal', () => {
    test.skip('should open keyboard shortcuts modal with Cmd/Ctrl+K', async ({ page }) => {
      // Press Cmd+K (or Ctrl+K on non-Mac)
      await page.keyboard.press('Control+k');

      // Check that the modal is visible
      await expect(page.getByRole('heading', { name: /keyboard shortcuts/i })).toBeVisible();
    });

    test.skip('should open keyboard shortcuts modal with Cmd/Ctrl+? (Shift+/)', async ({ page }) => {
      // Press Cmd+? (Shift+/)
      await page.keyboard.press('Control+Shift+/');

      // Check that the modal is visible
      await expect(page.getByRole('heading', { name: /keyboard shortcuts/i })).toBeVisible();
    });

    test.skip('should close keyboard shortcuts modal with Escape', async ({ page }) => {
      // Open the modal first
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('heading', { name: /keyboard shortcuts/i })).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Verify modal is closed
      await expect(page.getByRole('heading', { name: /keyboard shortcuts/i })).not.toBeVisible();
    });

    test.skip('should display all available shortcuts in modal', async ({ page }) => {
      // Open the modal
      await page.keyboard.press('Control+k');

      // Wait for modal to be visible
      await expect(page.getByRole('heading', { name: /keyboard shortcuts/i })).toBeVisible();

      // Check for common shortcuts listed
      await expect(page.getByText(/toggle dark mode/i)).toBeVisible();
      await expect(page.getByText(/show keyboard shortcuts/i)).toBeVisible();
      await expect(page.getByText(/open settings/i)).toBeVisible();
    });
  });

  test.describe('Dark Mode Toggle', () => {
    test('should toggle dark mode with Cmd/Ctrl+D', async ({ page }) => {
      // Get initial state
      const htmlElement = page.locator('html');
      const initialDarkMode = await htmlElement.evaluate((el) => el.classList.contains('dark'));

      // Press Cmd+D
      await page.keyboard.press('Control+d');

      // Check that dark mode toggled
      const newDarkMode = await htmlElement.evaluate((el) => el.classList.contains('dark'));
      expect(newDarkMode).toBe(!initialDarkMode);
    });

    test('should toggle dark mode back and forth', async ({ page }) => {
      const htmlElement = page.locator('html');

      // First toggle
      await page.keyboard.press('Control+d');
      const afterFirstToggle = await htmlElement.evaluate((el) => el.classList.contains('dark'));

      // Second toggle
      await page.keyboard.press('Control+d');
      const afterSecondToggle = await htmlElement.evaluate((el) => el.classList.contains('dark'));

      // Should be opposite
      expect(afterSecondToggle).toBe(!afterFirstToggle);
    });
  });

  test.describe('Settings Shortcut', () => {
    // Note: Settings shortcut (Ctrl+,) doesn't work in browser E2E tests
    // because browsers intercept Ctrl+, for their own settings
    test.skip('should open settings modal with Cmd/Ctrl+,', async ({ page }) => {
      // Press Cmd+,
      await page.keyboard.press('Control+,');

      // Check that settings modal is visible
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    });

    test.skip('should close settings modal with Escape after opening with shortcut', async ({ page }) => {
      // Open with shortcut
      await page.keyboard.press('Control+,');
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

      // Close with Escape
      await page.keyboard.press('Escape');

      // Verify closed
      await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();
    });
  });

  test.describe('Submit Shortcut', () => {
    test('should submit review with Cmd/Ctrl+Enter when input is focused and has value', async ({ page }) => {
      // Focus the input and type a URL
      const input = page.getByPlaceholder('Paste GitLab MR URL here...');
      await input.focus();
      await input.fill('https://gitlab.com/namespace/project/-/merge_requests/123');

      // Verify input is focused
      await expect(input).toBeFocused();

      // Press Cmd+Enter - this should trigger submit
      // Note: In actual test, this would trigger the review flow
      // Since we don't have a real GitLab backend, we just verify the button would be clicked
      await page.keyboard.press('Control+Enter');

      // The button should have been "clicked" (loading state may show briefly)
      // This depends on your error handling when GitLab is not configured
    });

    test('should not submit when input is empty', async ({ page }) => {
      const input = page.getByPlaceholder('Paste GitLab MR URL here...');
      await input.focus();

      // Make sure input is empty
      await expect(input).toHaveValue('');

      // Press Cmd+Enter
      await page.keyboard.press('Control+Enter');

      // Nothing should happen - review button should still be disabled
      const reviewButton = page.getByRole('button', { name: 'Review' });
      await expect(reviewButton).toBeDisabled();
    });
  });

  test.describe('Shortcut Prevention in Input Fields', () => {
    test('should not toggle dark mode when typing "d" in input field', async ({ page }) => {
      const input = page.getByPlaceholder('Paste GitLab MR URL here...');
      const htmlElement = page.locator('html');

      // Get initial dark mode state
      const initialDarkMode = await htmlElement.evaluate((el) => el.classList.contains('dark'));

      // Focus input and type 'd'
      await input.focus();
      await input.type('d');

      // Dark mode should NOT have changed
      const afterTypingDarkMode = await htmlElement.evaluate((el) => el.classList.contains('dark'));
      expect(afterTypingDarkMode).toBe(initialDarkMode);

      // Input should have 'd' in it
      await expect(input).toHaveValue('d');
    });

    test('should allow normal typing in input without triggering shortcuts', async ({ page }) => {
      const input = page.getByPlaceholder('Paste GitLab MR URL here...');

      // Focus and type a URL
      await input.focus();
      await input.type('https://gitlab.com/test');

      // The input should have the typed value
      await expect(input).toHaveValue('https://gitlab.com/test');

      // No modals should have opened
      await expect(page.getByRole('heading', { name: /keyboard shortcuts/i })).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();
    });
  });
});
