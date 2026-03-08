const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function sendAlert(parentEmail, alert, screenshotBuffer) {
  const mailOptions = {
    from: `"Peekable Alert" <${process.env.GMAIL_EMAIL}>`,
    to: parentEmail,
    subject: `Peekable Alert: ${alert.categoryLabel} detected`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e74c3c;">Peekable Alert</h2>
        <p><strong>Category:</strong> ${alert.categoryLabel}</p>
        <p><strong>Confidence:</strong> ${alert.confidence}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>What was detected:</strong></p>
        <p style="background: #f8f9fa; padding: 12px; border-radius: 6px;">${alert.description}</p>
        <p style="color: #666; font-size: 12px;">Screenshot attached. This alert was sent because <strong>${alert.categoryLabel}</strong> monitoring is enabled in your Peekable settings.</p>
      </div>
    `,
    attachments: [
      {
        filename: `screenshot-${Date.now()}.png`,
        content: screenshotBuffer,
        contentType: 'image/png'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Alert email sent: ${alert.categoryLabel}`);
    return true;
  } catch (err) {
    console.error('Failed to send alert email:', err.message);
    return false;
  }
}

module.exports = { sendAlert };
