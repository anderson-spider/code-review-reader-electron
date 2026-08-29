import { test, expect } from '@playwright/test';

// Helper to open settings page by clicking the "Open Settings" button
async function openSettings(page: import('@playwright/test').Page) {
  // Wait for app to fully load - check for the header
  await expect(page.getByRole('heading', { name: 'Code Review Reader' })).toBeVisible({ timeout: 10000 });

  // Use the "Open Settings" text button which is always visible in empty state
  const openSettingsButton = page.getByRole('button', { name: 'Open Settings' });
  await expect(openSettingsButton).toBeVisible({ timeout: 5000 });
  await openSettingsButton.click();

  // Wait for settings page to load
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
}

test.describe('Settings Page', () => {
  test('should open settings page when clicking settings button', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await expect(page.getByRole('heading', { name: 'Code Review Reader' })).toBeVisible({ timeout: 10000 });

    // Click the "Open Settings" button in empty state
    const settingsButton = page.getByRole('button', { name: 'Open Settings' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // Check that the settings page is visible
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  });

  test('should return to main view when clicking back button', async ({ page }) => {
    await page.goto('/');

    // Open settings
    await openSettings(page);

    // Find and click the back button
    const backButton = page.getByRole('button', { name: 'Voltar' });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Verify we're back on main view
    await expect(page.getByRole('heading', { name: 'Code Review Reader' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Configurações' })).not.toBeVisible();
  });

  test('should display all settings categories in sidebar', async ({ page }) => {
    await page.goto('/');

    // Open settings
    await openSettings(page);

    // Check for connection categories
    await expect(page.getByRole('button', { name: /GitLab.*API e autenticação/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Proxy.*Configurações de rede/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Codex.*App Server e prompts/i })).toBeVisible();

    // Check for preference categories
    await expect(page.getByRole('button', { name: /Aparência.*Tema e fonte/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sobre.*Versão e informações/i })).toBeVisible();
  });

  test('should switch between settings categories', async ({ page }) => {
    await page.goto('/');

    // Open settings
    await openSettings(page);

    // GitLab should be active by default
    await expect(page.getByRole('heading', { name: 'GitLab API', level: 2 })).toBeVisible();

    // Click on Proxy category
    await page.getByRole('button', { name: /Proxy.*Configurações de rede/i }).click();
    await expect(page.getByRole('heading', { name: 'Configurações de Proxy', level: 2 })).toBeVisible();

    // Click on Codex category
    await page.getByRole('button', { name: /Codex/i }).click();
    await expect(page.getByRole('heading', { name: 'Codex App Server', level: 2 })).toBeVisible();

    // Click on Appearance category
    await page.getByRole('button', { name: /Aparência.*Tema e fonte/i }).click();
    await expect(page.getByRole('heading', { name: 'Aparência', level: 2 })).toBeVisible();

    // Click on About category
    await page.getByRole('button', { name: /Sobre.*Versão e informações/i }).click();
    await expect(page.getByRole('heading', { name: 'Sobre', level: 2 })).toBeVisible();
  });

  test('should show Codex App Server without provider or model controls', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await page.getByRole('button', { name: /Codex.*App Server e prompts/i }).click();

    await expect(page.getByRole('heading', { name: 'Codex App Server', level: 2 })).toBeVisible();
    await expect(page.getByText(/codex app-server/i).first()).toBeVisible();
    await expect(page.getByText(/codex login status/i).first()).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByLabel('Modelo')).not.toBeVisible();
  });

  test('should keep Codex settings readable on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');
    await openSettings(page);
    await page.getByRole('button', { name: /Codex/i }).click();

    const bounds = await page.getByRole('heading', { name: 'Codex App Server', level: 2 }).boundingBox();

    expect(bounds?.width).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('should display GitLab settings content', async ({ page }) => {
    await page.goto('/');

    // Open settings
    await openSettings(page);

    // Check for GitLab Base URL input
    const baseUrlInput = page.getByPlaceholder('https://gitlab.com/api/v4');
    await expect(baseUrlInput).toBeVisible();

    // Check for token input
    const tokenInput = page.getByPlaceholder(/glpat-/);
    await expect(tokenInput).toBeVisible();
    await expect(tokenInput).toHaveAttribute('type', 'password');

    // Check for Save Token button
    await expect(page.getByRole('button', { name: 'Salvar Token' })).toBeVisible();
  });

  test('should have Save Token button disabled when token field is empty', async ({ page }) => {
    await page.goto('/');

    // Open settings
    await openSettings(page);

    // Check that Save Token button is disabled
    const saveButton = page.getByRole('button', { name: 'Salvar Token' });
    await expect(saveButton).toBeDisabled();
  });

  test('should enable Save Token button when token is entered', async ({ page }) => {
    await page.goto('/');

    // Open settings
    await openSettings(page);

    // Type a token
    const tokenInput = page.getByPlaceholder(/glpat-/);
    await tokenInput.fill('glpat-test-token-12345');

    // Check that Save Token button is now enabled
    const saveButton = page.getByRole('button', { name: 'Salvar Token' });
    await expect(saveButton).toBeEnabled();
  });

  test('should display proxy settings with toggle', async ({ page }) => {
    await page.goto('/');

    // Open settings and go to Proxy
    await openSettings(page);
    await page.getByRole('button', { name: /Proxy.*Configurações de rede/i }).click();

    // Check for proxy toggle (button with role="switch")
    await expect(page.getByRole('switch')).toBeVisible();

    // Check for "Habilitar Proxy" label text
    await expect(page.getByText('Habilitar Proxy')).toBeVisible();

    // Check for proxy type select
    await expect(page.getByLabel('Tipo de Proxy')).toBeVisible();

    // Check for host and port inputs
    await expect(page.getByLabel('Host')).toBeVisible();
    await expect(page.getByLabel('Porta')).toBeVisible();
  });

  test('should display appearance settings with theme options', async ({ page }) => {
    await page.goto('/');

    // Open settings and go to Appearance
    await openSettings(page);
    await page.getByRole('button', { name: /Aparência.*Tema e fonte/i }).click();

    // Check for theme options
    await expect(page.getByRole('radio', { name: /Sistema/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Claro/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Escuro/i })).toBeVisible();

    // Check for font size options
    await expect(page.getByRole('radio', { name: /Pequena/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Média/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Grande/i })).toBeVisible();
  });

  test('should display about page with app information', async ({ page }) => {
    await page.goto('/');

    // Open settings and go to About
    await openSettings(page);
    await page.getByRole('button', { name: /Sobre.*Versão e informações/i }).click();

    // Check for app name
    await expect(page.getByRole('heading', { name: 'Code Review Reader', level: 3 })).toBeVisible();

    // Check for version info (use exact: true to avoid matching sidebar text)
    await expect(page.getByText('Versão', { exact: true })).toBeVisible();
    await expect(page.getByText('Plataforma', { exact: true })).toBeVisible();

    // Check for useful links heading (it's a "h3" rendered as text-sm font-medium)
    await expect(page.getByText('Links Úteis')).toBeVisible();
    await expect(page.getByRole('button', { name: /Repositório GitHub/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reportar Problema/i })).toBeVisible();
  });

  test('should open settings via keyboard shortcut Cmd/Ctrl+,', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await expect(page.getByRole('heading', { name: 'Code Review Reader' })).toBeVisible({ timeout: 10000 });

    // Press Cmd/Ctrl + , to open settings
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+,' : 'Control+,');

    // Check that settings page is visible
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  });

  test('should close settings via Escape key', async ({ page }) => {
    await page.goto('/');

    // Open settings
    await openSettings(page);

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Verify we're back on main view
    await expect(page.getByRole('heading', { name: 'Code Review Reader' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Configurações' })).not.toBeVisible();
  });
});
