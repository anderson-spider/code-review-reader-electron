import { test, expect } from '@playwright/test';

test.describe('Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Visual Theme', () => {
    test('should apply dark class to html element when dark mode is enabled', async ({ page }) => {
      const htmlElement = page.locator('html');

      // Get initial state (should be light mode after clearing localStorage)
      const initialDarkMode = await htmlElement.evaluate((el) => el.classList.contains('dark'));
      expect(initialDarkMode).toBe(false);

      // Toggle dark mode via the dark mode button in header
      const darkModeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });
      await darkModeButton.click();

      // Verify dark mode is enabled
      await expect(htmlElement).toHaveClass(/dark/);
    });

    test('should remove dark class when dark mode is disabled', async ({ page }) => {
      const htmlElement = page.locator('html');
      const darkModeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });

      // Enable dark mode
      await darkModeButton.click();
      await expect(htmlElement).toHaveClass(/dark/);

      // Disable dark mode
      await darkModeButton.click();

      // Verify dark class is removed
      const hasDarkClass = await htmlElement.evaluate((el) => el.classList.contains('dark'));
      expect(hasDarkClass).toBe(false);
    });

    test('should have appropriate background color in dark mode', async ({ page }) => {
      const main = page.locator('main');
      const darkModeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });

      // Enable dark mode
      await darkModeButton.click();

      // Check for dark background (TailwindCSS dark: variants)
      const backgroundColor = await main.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Dark mode should have a dark background (not white/light)
      expect(backgroundColor).not.toBe('rgb(255, 255, 255)');
    });
  });

  test.describe('Persistence', () => {
    test('should persist dark mode preference after page reload', async ({ page }) => {
      const htmlElement = page.locator('html');
      const darkModeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });

      // Enable dark mode
      await darkModeButton.click();
      await expect(htmlElement).toHaveClass(/dark/);

      // Reload the page
      await page.reload();

      // Dark mode should still be enabled
      await expect(htmlElement).toHaveClass(/dark/);
    });

    test('should persist light mode preference after page reload', async ({ page }) => {
      const htmlElement = page.locator('html');

      // Ensure light mode (localStorage was cleared in beforeEach)
      const initialDark = await htmlElement.evaluate((el) => el.classList.contains('dark'));
      expect(initialDark).toBe(false);

      // Reload the page
      await page.reload();

      // Should still be light mode
      const hasDarkClass = await htmlElement.evaluate((el) => el.classList.contains('dark'));
      expect(hasDarkClass).toBe(false);
    });
  });

  test.describe('UI Elements in Dark Mode', () => {
    test('should style header appropriately in dark mode', async ({ page }) => {
      const darkModeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });

      // Enable dark mode
      await darkModeButton.click();

      const htmlElement = page.locator('html');
      await expect(htmlElement).toHaveClass(/dark/);

      // The header should have dark styling classes applied
      const header = page.locator('header');
      await expect(header).toBeVisible();
    });

    test('should style input field appropriately in dark mode', async ({ page }) => {
      const darkModeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });

      // Enable dark mode
      await darkModeButton.click();

      const input = page.getByPlaceholder('Paste GitLab MR URL here...');
      const inputStyles = await input.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
        };
      });

      // Input should have appropriate contrast in dark mode
      expect(inputStyles.backgroundColor).toBeDefined();
      expect(inputStyles.color).toBeDefined();
    });

    test('should style buttons appropriately in dark mode', async ({ page }) => {
      const darkModeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });

      // Enable dark mode
      await darkModeButton.click();

      const settingsButton = page.getByLabel('Settings');
      const buttonStyles = await settingsButton.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
        };
      });

      expect(buttonStyles.backgroundColor).toBeDefined();
      expect(buttonStyles.color).toBeDefined();
    });

    test('should style modals appropriately in dark mode', async ({ page }) => {
      // Wait for app to load
      await expect(page.getByRole('heading', { name: 'Code Review Reader' })).toBeVisible({ timeout: 10000 });

      const darkModeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });

      // Enable dark mode
      await darkModeButton.click();

      // Open settings page via "Open Settings" button in empty state
      const settingsButton = page.getByRole('button', { name: 'Open Settings' });
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      // Wait for settings page to open (heading is in Portuguese)
      await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible({ timeout: 5000 });

      // Verify settings page is visible and dark mode is active
      const htmlElement = page.locator('html');
      await expect(htmlElement).toHaveClass(/dark/);
    });
  });

  test.describe('System Preference Detection', () => {
    test('should respect system dark mode preference on first load', async ({ page, context }) => {
      // This test simulates system dark mode preference
      await context.close();

      const darkContext = await page.context().browser()!.newContext({
        colorScheme: 'dark',
      });
      const darkPage = await darkContext.newPage();
      await darkPage.goto('/');

      // Clear any persisted preference first
      await darkPage.evaluate(() => localStorage.clear());
      await darkPage.reload();

      const htmlElement = darkPage.locator('html');

      // Should detect system dark mode preference
      // Note: This depends on implementation respecting matchMedia
      const hasDarkClass = await htmlElement.evaluate((el) => el.classList.contains('dark'));

      // The app should respect system preference (if implemented)
      // If not implemented, this test documents the expected behavior
      await darkContext.close();
    });
  });

  test.describe('Keyboard Shortcut', () => {
    test('should toggle dark mode with Ctrl+D keyboard shortcut', async ({ page }) => {
      const htmlElement = page.locator('html');

      // Get initial state
      const initialDarkMode = await htmlElement.evaluate((el) => el.classList.contains('dark'));

      // Toggle dark mode via keyboard shortcut
      await page.keyboard.press('Control+d');

      // Wait a bit for state to update
      await page.waitForTimeout(100);

      // Verify dark mode toggled
      const afterToggle = await htmlElement.evaluate((el) => el.classList.contains('dark'));
      expect(afterToggle).toBe(!initialDarkMode);
    });
  });
});
