import { test, expect } from '@playwright/test';

test.describe('Review Options Panel', () => {
  test('shows configurable tests and always-on local checkout', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Include Tests')).toBeVisible();
    await expect(page.getByText('Local Checkout · Always on')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(1);
    await expect(page.locator('input[type="checkbox"]')).not.toBeChecked();
  });

  test('toggles Include Tests independently', async ({ page }) => {
    await page.goto('/');
    const includeTestsLabel = page.getByText('Include Tests').locator('..');
    const includeTestsCheckbox = page.locator('input[type="checkbox"]');

    await includeTestsLabel.click();
    await expect(includeTestsCheckbox).toBeChecked();
    await expect(page.getByText('Local Checkout · Always on')).toBeVisible();

    await includeTestsLabel.click();
    await expect(includeTestsCheckbox).not.toBeChecked();
  });

  test('disables project memory until a valid MR URL is entered', async ({ page }) => {
    await page.goto('/');
    const picker = page.getByLabel('Project memory container');
    await expect(picker).toBeDisabled();

    await page.getByPlaceholder('Paste GitLab MR URL here...').fill(
      'https://gitlab.example.com/example-org/sample-project/-/merge_requests/42',
    );
    await expect(picker).toBeEnabled();
  });
});
