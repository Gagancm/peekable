const Store = require('electron-store');
const crypto = require('crypto');

const store = new Store({
  name: 'peekable-config',
  encryptionKey: 'peekable-v1-encryption-key',
  defaults: {
    onboardingComplete: false,
    parentPasswordHash: null,
    parentEmail: null,
    categories: {
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
      custom: { enabled: false, label: 'Custom Rule', description: '', customRule: '' }
    },
    screenshotIntervalSeconds: 5,
    alertCooldownMinutes: 15,
    confidenceThreshold: 'medium'
  }
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function setPassword(password) {
  store.set('parentPasswordHash', hashPassword(password));
}

function verifyPassword(password) {
  return store.get('parentPasswordHash') === hashPassword(password);
}

module.exports = { store, setPassword, verifyPassword };
