const screenshot = require('screenshot-desktop');

async function captureScreenshot() {
  try {
    const imgBuffer = await screenshot({ format: 'png' });
    return imgBuffer;
  } catch (err) {
    console.error('Screenshot capture failed:', err.message);
    return null;
  }
}

async function testScreenshotPermission() {
  try {
    await screenshot({ format: 'png' });
    return true;
  } catch {
    return false;
  }
}

module.exports = { captureScreenshot, testScreenshotPermission };
