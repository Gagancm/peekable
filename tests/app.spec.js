const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const mainPath = path.join(__dirname, '..', 'src', 'main', 'main.js');

// Helper to find and clear the electron-store config for clean tests
function clearConfig() {
  // electron-store saves under the app name from package.json
  // When running with electron directly (not packaged), it uses "Electron" as the app name
  const possibleDirs = [
    path.join(process.env.HOME || process.env.USERPROFILE, 'Library', 'Application Support', 'Electron'),
    path.join(process.env.HOME || process.env.USERPROFILE, 'Library', 'Application Support', 'peekable'),
  ];
  for (const dir of possibleDirs) {
    const configPath = path.join(dir, 'peekable-config.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

async function launchApp() {
  const app = await electron.launch({
    args: [mainPath],
    env: { ...process.env, NODE_ENV: 'test' }
  });
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  return { app, win };
}

// Helper to navigate past step 1
async function completeStep1(win) {
  await win.fill('#parent-email', 'parent@test.com');
  await win.fill('#parent-password', 'test1234');
  await win.fill('#parent-password-confirm', 'test1234');
  await win.click('#step1-next');
}

// Helper to navigate past step 2 (returns false if permission not granted)
async function completeStep2(win) {
  await win.click('#check-permission-btn');
  await win.waitForTimeout(1000);
  const nextBtn = win.locator('#step2-next');
  const isVisible = await nextBtn.isVisible();
  if (isVisible) {
    await nextBtn.click();
    return true;
  }
  return false;
}

let electronApp;
let window;

test.beforeEach(async () => {
  clearConfig();
});

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close().catch(() => {});
    electronApp = null;
  }
});

test.describe('Onboarding Flow', () => {
  test('shows step 1 on first launch', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    const step1 = window.locator('#step-1');
    await expect(step1).toBeVisible();
    await expect(window.locator('#step-1 h1')).toHaveText('Welcome to Peekable');
  });

  test('validates email on step 1', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await window.fill('#parent-email', 'notanemail');
    await window.fill('#parent-password', 'test1234');
    await window.fill('#parent-password-confirm', 'test1234');
    await window.click('#step1-next');
    const error = window.locator('#password-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Please enter a valid email address.');
  });

  test('validates password length on step 1', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await window.fill('#parent-email', 'parent@test.com');
    await window.fill('#parent-password', 'ab');
    await window.fill('#parent-password-confirm', 'ab');
    await window.click('#step1-next');
    const error = window.locator('#password-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Password must be at least 4 characters.');
  });

  test('validates password match on step 1', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await window.fill('#parent-email', 'parent@test.com');
    await window.fill('#parent-password', 'test1234');
    await window.fill('#parent-password-confirm', 'different');
    await window.click('#step1-next');
    const error = window.locator('#password-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Passwords do not match.');
  });

  test('navigates to step 2 with valid inputs', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeStep1(window);
    await expect(window.locator('#step-2')).toBeVisible();
    await expect(window.locator('#step-2 h1')).toHaveText('Screen Recording Permission');
  });

  test('step 2 shows permission controls', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeStep1(window);
    await expect(window.locator('#open-settings-btn')).toBeVisible();
    await expect(window.locator('#check-permission-btn')).toBeVisible();
    await expect(window.locator('#permission-status')).toBeVisible();
  });

  test('step 2 check permission button updates status', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeStep1(window);
    await window.click('#check-permission-btn');
    await window.waitForTimeout(1000);
    const text = await window.locator('#permission-text').textContent();
    expect(['Permission granted!', 'Permission not yet granted']).toContain(text);
  });

  test('full onboarding through categories and settings', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeStep1(window);
    const permGranted = await completeStep2(window);
    if (!permGranted) {
      test.skip('Screen permission not granted');
      return;
    }

    // Step 3 - categories
    await expect(window.locator('#step-3')).toBeVisible();
    await expect(window.locator('#step-3 h1')).toHaveText('What should we watch for?');
    const categoryItems = window.locator('#categories-list .category-item');
    const count = await categoryItems.count();
    expect(count).toBe(11);
    await window.click('#step3-next');

    // Step 4 - sensitivity
    await expect(window.locator('#step-4')).toBeVisible();
    await expect(window.locator('#screenshot-interval')).toHaveValue('5');
    await expect(window.locator('#alert-cooldown')).toHaveValue('15');
    await expect(window.locator('#confidence-threshold')).toHaveValue('medium');
    await window.click('#step4-next');

    // Step 5 - summary
    await expect(window.locator('#step-5')).toBeVisible();
    await expect(window.locator('#summary')).toContainText('parent@test.com');
  });
});

test.describe('Category Configuration', () => {
  test('categories can be toggled', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeStep1(window);
    if (!(await completeStep2(window))) {
      test.skip('Screen permission not granted');
      return;
    }

    const gamblingCheckbox = window.locator('#categories-list input[data-key="gambling"]');
    await expect(gamblingCheckbox).not.toBeChecked();
    await gamblingCheckbox.check();
    await expect(gamblingCheckbox).toBeChecked();

    const strangerCheckbox = window.locator('#categories-list input[data-key="strangerInteraction"]');
    await expect(strangerCheckbox).toBeChecked();
    await strangerCheckbox.uncheck();
    await expect(strangerCheckbox).not.toBeChecked();
  });

  test('custom rule textarea appears when enabled', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeStep1(window);
    if (!(await completeStep2(window))) {
      test.skip('Screen permission not granted');
      return;
    }

    const customTextarea = window.locator('#categories-list textarea[data-key="custom"]');
    await expect(customTextarea).toBeHidden();

    const customCheckbox = window.locator('#categories-list input[data-key="custom"]');
    await customCheckbox.check();
    await expect(customTextarea).toBeVisible();
    await customTextarea.fill('Watching videos about dangerous challenges');
  });
});

test.describe('Sensitivity Settings', () => {
  test('can change settings and see them in summary', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeStep1(window);
    if (!(await completeStep2(window))) {
      test.skip('Screen permission not granted');
      return;
    }
    await window.click('#step3-next');

    await window.selectOption('#screenshot-interval', '10');
    await window.selectOption('#alert-cooldown', '30');
    await window.selectOption('#confidence-threshold', 'high');

    await expect(window.locator('#screenshot-interval')).toHaveValue('10');
    await expect(window.locator('#alert-cooldown')).toHaveValue('30');
    await expect(window.locator('#confidence-threshold')).toHaveValue('high');

    await window.click('#step4-next');
    const summary = window.locator('#summary');
    await expect(summary).toContainText('Every 10 seconds');
    await expect(summary).toContainText('30 minutes');
    await expect(summary).toContainText('high');
  });
});

test.describe('Password Protection', () => {
  // Helper: complete onboarding via test IPC handler
  async function completeOnboardingViaIPC(win) {
    await win.evaluate(() => {
      return window.peekable.__testCompleteOnboarding({ password: 'test1234', email: 'parent@test.com' });
    });
  }

  test('shows password prompt for returning user', async () => {
    // Set up config directly
    ({ app: electronApp, win: window } = await launchApp());
    await completeOnboardingViaIPC(window);
    await electronApp.close();

    // Relaunch
    ({ app: electronApp, win: window } = await launchApp());
    const passwordPrompt = window.locator('#password-prompt');
    await expect(passwordPrompt).toBeVisible();
  });

  test('rejects wrong password', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeOnboardingViaIPC(window);
    await electronApp.close();

    ({ app: electronApp, win: window } = await launchApp());
    await expect(window.locator('#password-prompt')).toBeVisible();

    await window.fill('#unlock-password', 'wrongpassword');
    await window.click('#unlock-btn');
    await expect(window.locator('#unlock-error')).toBeVisible();
    await expect(window.locator('#unlock-error')).toHaveText('Incorrect password');
  });

  test('accepts correct password and shows settings', async () => {
    ({ app: electronApp, win: window } = await launchApp());
    await completeOnboardingViaIPC(window);
    await electronApp.close();

    ({ app: electronApp, win: window } = await launchApp());
    await expect(window.locator('#password-prompt')).toBeVisible();

    await window.fill('#unlock-password', 'test1234');
    await window.click('#unlock-btn');

    const settingsPanel = window.locator('#settings-panel');
    await expect(settingsPanel).toBeVisible();
    await expect(window.locator('#settings-email')).toHaveValue('parent@test.com');
  });
});
