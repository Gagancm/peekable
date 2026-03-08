// State
let onboardingData = {
  email: '',
  password: '',
  categories: {},
  screenshotIntervalSeconds: 5,
  alertCooldownMinutes: 15,
  confidenceThreshold: 'medium'
};

const defaultCategories = {
  strangerInteraction: { enabled: true, label: 'Stranger Interaction', description: 'Chatting with unknown people online' },
  adultContent: { enabled: true, label: 'Adult/Sexual Content', description: 'Pornography or explicit material', sensitivity: 'strict' },
  violence: { enabled: true, label: 'Violence/Gore', description: 'Graphic violent content' },
  cyberbullying: { enabled: true, label: 'Cyberbullying', description: 'Being bullied or bullying others' },
  selfHarm: { enabled: true, label: 'Self-Harm/Suicide', description: 'Content related to self-harm' },
  drugs: { enabled: true, label: 'Drug/Alcohol Content', description: 'Substance use content' },
  politicalContent: { enabled: false, label: 'Political Content', description: 'Political media/discussions', parentNote: '' },
  thirstTraps: { enabled: false, label: 'Thirst Traps', description: 'Provocative social media content' },
  looksmaxxing: { enabled: false, label: 'Looksmaxxing', description: 'Appearance obsession content' },
  gambling: { enabled: false, label: 'Gambling', description: 'Betting or gambling sites' },
  custom: { enabled: false, label: 'Custom Rule', description: 'Define your own monitoring rule', customRule: '' }
};

// ---- Category Rendering ----

function renderCategories(containerId, categories) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (const [key, cat] of Object.entries(categories)) {
    const item = document.createElement('div');
    const hasExtra = key === 'adultContent' || key === 'politicalContent' || key === 'custom';
    item.className = 'category-item' + (hasExtra ? ' category-item--wide' : '');
    item.dataset.key = key;

    let extraHTML = '';
    if (key === 'adultContent') {
      extraHTML = `
        <div class="category-extra" style="${cat.enabled ? '' : 'display:none'}">
          <label>Sensitivity</label>
          <select data-key="${key}" data-field="sensitivity">
            <option value="strict" ${cat.sensitivity === 'strict' ? 'selected' : ''}>Strict</option>
            <option value="moderate" ${cat.sensitivity === 'moderate' ? 'selected' : ''}>Moderate</option>
          </select>
        </div>`;
    } else if (key === 'politicalContent') {
      extraHTML = `
        <div class="category-extra" style="${cat.enabled ? '' : 'display:none'}">
          <label>Describe your concern</label>
          <textarea data-key="${key}" data-field="parentNote" placeholder="e.g., extremist content, misinformation...">${cat.parentNote || ''}</textarea>
        </div>`;
    } else if (key === 'custom') {
      extraHTML = `
        <div class="category-extra" style="${cat.enabled ? '' : 'display:none'}">
          <label>Describe what to watch for</label>
          <textarea data-key="${key}" data-field="customRule" placeholder="e.g., Watching videos about building weapons...">${cat.customRule || ''}</textarea>
        </div>`;
    }

    item.innerHTML = `
      <input type="checkbox" data-key="${key}" ${cat.enabled ? 'checked' : ''} />
      <div class="category-info">
        <div class="category-label">${cat.label}</div>
        <div class="category-desc">${cat.description}</div>
        ${extraHTML}
      </div>
    `;

    container.appendChild(item);
  }

  // Event listeners for checkboxes
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const key = e.target.dataset.key;
      categories[key].enabled = e.target.checked;
      // Show/hide extra fields
      const extra = e.target.closest('.category-item').querySelector('.category-extra');
      if (extra) {
        extra.style.display = e.target.checked ? '' : 'none';
      }
    });
  });

  // Event listeners for extra fields
  container.querySelectorAll('[data-field]').forEach(el => {
    const event = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(event, (e) => {
      const key = e.target.dataset.key;
      const field = e.target.dataset.field;
      categories[key][field] = e.target.value;
    });
  });
}

// ---- Navigation ----

function showStep(stepId) {
  document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
  document.getElementById(stepId).style.display = 'block';
}

// ---- Welcome ----

document.getElementById('welcome-create-account').addEventListener('click', () => {
  showStep('create-account-step');
});

document.getElementById('welcome-sign-in').addEventListener('click', () => {
  showStep('login-step');
});

// ---- Create account (back link) ----

document.getElementById('create-account-back').addEventListener('click', (e) => {
  e.preventDefault();
  showStep('welcome-step');
});

// ---- Create account: submit ----

document.getElementById('step1-next').addEventListener('click', () => {
  const email = document.getElementById('parent-email').value.trim();
  const password = document.getElementById('parent-password').value;
  const confirm = document.getElementById('parent-password-confirm').value;
  const errorEl = document.getElementById('password-error');

  if (!email || !email.includes('@')) {
    errorEl.textContent = 'Please enter a valid email address.';
    errorEl.style.display = 'block';
    return;
  }
  if (password.length < 4) {
    errorEl.textContent = 'Password must be at least 4 characters.';
    errorEl.style.display = 'block';
    return;
  }
  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match.';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  onboardingData.email = email;
  onboardingData.password = password;
  showStep('step-2');
});

// ---- Login ----

document.getElementById('login-btn').addEventListener('click', async () => {
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';

  if (!password) {
    errorEl.textContent = 'Please enter your password.';
    errorEl.style.display = 'block';
    return;
  }

  const valid = await window.peekable.verifyPassword(password);
  if (valid) {
    await loadSettings();
    showStep('settings-panel');
  } else {
    errorEl.textContent = 'Incorrect password. Try again or create an account.';
    errorEl.style.display = 'block';
  }
});

document.getElementById('login-create-account-link').addEventListener('click', (e) => {
  e.preventDefault();
  showStep('create-account-step');
});

document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

// ---- Step 2: Screen Permission ----

document.getElementById('open-settings-btn').addEventListener('click', async () => {
  await window.peekable.openScreenPermissionSettings();
});

document.getElementById('check-permission-btn').addEventListener('click', async () => {
  const granted = await window.peekable.checkScreenPermission();
  const statusBox = document.getElementById('permission-status');
  const icon = document.getElementById('permission-icon');
  const text = document.getElementById('permission-text');
  const warning = document.getElementById('permission-warning');
  const nextBtn = document.getElementById('step2-next');

  if (granted) {
    statusBox.className = 'status-box granted';
    icon.textContent = '\u2705';
    text.textContent = 'Permission granted!';
    nextBtn.style.display = 'inline-block';
    warning.style.display = 'none';
    document.getElementById('open-settings-btn').style.display = 'none';
    document.getElementById('check-permission-btn').style.display = 'none';
  } else {
    statusBox.className = 'status-box pending';
    icon.textContent = '\u26A0';
    text.textContent = 'Permission not yet granted';
    warning.style.display = 'block';
  }
});

document.getElementById('step2-next').addEventListener('click', () => {
  onboardingData.categories = JSON.parse(JSON.stringify(defaultCategories));
  renderCategories('categories-list', onboardingData.categories);
  showStep('step-3');
});

// ---- Step 3: Categories ----

document.getElementById('step3-next').addEventListener('click', () => {
  showStep('step-4');
});

// ---- Step 4: Sensitivity ----

document.getElementById('step4-next').addEventListener('click', () => {
  onboardingData.screenshotIntervalSeconds = parseInt(document.getElementById('screenshot-interval').value);
  onboardingData.alertCooldownMinutes = parseInt(document.getElementById('alert-cooldown').value);
  onboardingData.confidenceThreshold = document.getElementById('confidence-threshold').value;

  // Build summary
  const enabledCats = Object.values(onboardingData.categories).filter(c => c.enabled).map(c => c.label);
  const summary = document.getElementById('summary');
  summary.innerHTML = `
    <p><strong>Email:</strong> ${onboardingData.email}</p>
    <p><strong>Monitoring:</strong> ${enabledCats.join(', ') || 'None'}</p>
    <p><strong>Screenshot interval:</strong> Every ${onboardingData.screenshotIntervalSeconds} seconds</p>
    <p><strong>Alert cooldown:</strong> ${onboardingData.alertCooldownMinutes === 0 ? 'No cooldown' : onboardingData.alertCooldownMinutes + ' minutes'}</p>
    <p><strong>Confidence threshold:</strong> ${onboardingData.confidenceThreshold}</p>
  `;
  showStep('step-5');
});

// ---- Step 5: Start Monitoring ----

document.getElementById('start-monitoring').addEventListener('click', async () => {
  await window.peekable.saveOnboarding(onboardingData);
  // Hide window — monitoring has begun
  window.close();
});

// ---- Password Prompt (returning parent) ----

document.getElementById('unlock-btn').addEventListener('click', async () => {
  const password = document.getElementById('unlock-password').value;
  const valid = await window.peekable.verifyPassword(password);
  if (valid) {
    document.getElementById('unlock-error').style.display = 'none';
    await loadSettings();
    showStep('settings-panel');
  } else {
    document.getElementById('unlock-error').style.display = 'block';
  }
});

// Enter key support for password field
document.getElementById('unlock-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('unlock-btn').click();
});

async function loadSettings() {
  const config = await window.peekable.getConfig();
  document.getElementById('settings-email').value = config.parentEmail || '';
  document.getElementById('settings-screenshot-interval').value = config.screenshotIntervalSeconds;
  document.getElementById('settings-alert-cooldown').value = config.alertCooldownMinutes;
  document.getElementById('settings-confidence-threshold').value = config.confidenceThreshold;
  renderCategories('settings-categories-list', config.categories);

  // Store reference for save
  window._settingsCategories = config.categories;
}

document.getElementById('save-settings').addEventListener('click', async () => {
  await window.peekable.saveSettings({
    email: document.getElementById('settings-email').value,
    categories: window._settingsCategories,
    screenshotIntervalSeconds: parseInt(document.getElementById('settings-screenshot-interval').value),
    alertCooldownMinutes: parseInt(document.getElementById('settings-alert-cooldown').value),
    confidenceThreshold: document.getElementById('settings-confidence-threshold').value,
    newPassword: document.getElementById('settings-new-password').value || undefined
  });
  window.close();
});

document.getElementById('close-settings').addEventListener('click', () => {
  window.close();
});

// ---- Listen for show-password-prompt from main ----

window.peekable.onShowPasswordPrompt(() => {
  showStep('password-prompt');
});

// ---- Init ----

(async () => {
  const config = await window.peekable.getConfig();
  if (config.onboardingComplete) {
    showStep('password-prompt');
  } else {
    showStep('welcome-step');
  }
})();
