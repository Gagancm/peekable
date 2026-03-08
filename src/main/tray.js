const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function createTray(showSettings) {
  // Create a small icon for the tray (16x16 colored dot)
  const icon = nativeImage.createFromBuffer(createTrayIconBuffer(), { width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Peekable');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Settings',
      click: () => showSettings()
    },
    { type: 'separator' },
    {
      label: 'About Peekable',
      click: () => {}
    }
  ]);

  tray.setContextMenu(contextMenu);
  return tray;
}

function createTrayIconBuffer() {
  // Create a simple 16x16 PNG with a colored circle
  // This is a minimal valid PNG - in production you'd use an actual icon file
  const { createCanvas } = (() => {
    try {
      return require('canvas');
    } catch {
      // Fallback: return empty buffer, Electron will use default
      return { createCanvas: null };
    }
  })();

  if (createCanvas) {
    const canvas = createCanvas(16, 16);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toBuffer('image/png');
  }

  // Fallback: 1x1 transparent PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADklEQVQ4T2NkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==',
    'base64'
  );
}

module.exports = { createTray };
