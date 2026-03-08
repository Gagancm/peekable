const { captureScreenshot } = require('./screenshot');
const { analyzeScreenshot } = require('./analyzer');
const { sendAlert } = require('./emailer');
const { store } = require('./store');

// Track last alert time per category for cooldown
const lastAlertTimes = {};
// Global cooldown: last time ANY alert was sent
let lastGlobalAlertTime = 0;
let monitorInterval = null;
let checkInProgress = false;

// Hard per-category dedup: never report the same violation twice within 1 hour
const PER_CATEGORY_DEDUP_MS = 60 * 60 * 1000;

function isOnCooldown(category) {
  const cooldownMs = store.get('alertCooldownMinutes') * 60 * 1000;
  const now = Date.now();

  // Global cooldown — no alerts at all within the cooldown window
  if ((now - lastGlobalAlertTime) < cooldownMs) {
    return true;
  }

  // Per-category dedup — same violation cannot repeat within 1 hour
  const lastTime = lastAlertTimes[category];
  if (lastTime && (now - lastTime) < PER_CATEGORY_DEDUP_MS) {
    return true;
  }

  return false;
}

function meetsConfidenceThreshold(alertConfidence) {
  const threshold = store.get('confidenceThreshold');
  const levels = { low: 1, medium: 2, high: 3 };
  return (levels[alertConfidence] || 0) >= (levels[threshold] || 2);
}

async function runCheck() {
  // Prevent concurrent checks — if a previous check is still running (waiting on
  // OpenAI), skip this tick. This prevents duplicate emails from overlapping calls.
  if (checkInProgress) {
    console.log('Check already in progress, skipping');
    return;
  }
  if (!store.get('onboardingComplete')) return;

  checkInProgress = true;
  try {
    const screenshotBuffer = await captureScreenshot();
    if (!screenshotBuffer) return;

    const categories = store.get('categories');
    const hasEnabledCategory = Object.values(categories).some(c => c.enabled);
    if (!hasEnabledCategory) return;

    // Check global cooldown BEFORE making the expensive API call
    const cooldownMs = store.get('alertCooldownMinutes') * 60 * 1000;
    if ((Date.now() - lastGlobalAlertTime) < cooldownMs) {
      console.log('Global cooldown active, skipping analysis');
      return;
    }

    const result = await analyzeScreenshot(screenshotBuffer, categories);

    if (result.triggered && result.category) {
      if (isOnCooldown(result.category)) {
        console.log(`Alert for ${result.category} suppressed (cooldown active)`);
        return;
      }

      if (!meetsConfidenceThreshold(result.confidence)) {
        console.log(`Alert for ${result.category} suppressed (confidence ${result.confidence} below threshold)`);
        return;
      }

      const parentEmail = store.get('parentEmail');
      const sent = await sendAlert(parentEmail, result, screenshotBuffer);
      if (sent) {
        const now = Date.now();
        lastAlertTimes[result.category] = now;
        lastGlobalAlertTime = now;
      }
    }
  } finally {
    checkInProgress = false;
  }
}

function startMonitoring() {
  if (monitorInterval) return;
  const intervalMs = store.get('screenshotIntervalSeconds') * 1000;
  console.log(`Monitoring started (every ${store.get('screenshotIntervalSeconds')}s)`);
  monitorInterval = setInterval(runCheck, intervalMs);
  // Run first check immediately
  runCheck();
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('Monitoring stopped');
  }
}

function restartMonitoring() {
  stopMonitoring();
  startMonitoring();
}

module.exports = { startMonitoring, stopMonitoring, restartMonitoring };
