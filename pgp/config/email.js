const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter only if credentials exist
const isSmtpConfigured = () => {
  return process.env.SMTP_USER && process.env.SMTP_USER.trim() !== '' &&
         process.env.SMTP_PASS && process.env.SMTP_PASS.trim() !== '';
};

/**
 * Sends an email notification to a user.
 * Falls back to console log simulation if SMTP is not configured.
 * 
 * @param {string} toEmail 
 * @param {string} subject 
 * @param {string} htmlBody 
 */
async function sendEmailNotification(toEmail, subject, htmlBody) {
  if (!toEmail) {
    console.warn('[EMAIL WARNING] Cannot send email: No recipient email specified.');
    return false;
  }

  if (!isSmtpConfigured()) {
    console.log('\n==================================================');
    console.log('[EMAIL SIMULATION] (SMTP not configured in .env)');
    console.log(`To:      ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:    \n${htmlBody.replace(/<[^>]*>/g, '')}`); // Strip HTML tags for clean console logs
    console.log('==================================================\n');
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
      port: parseInt(process.env.SMTP_PORT) || 2525,
      secure: parseInt(process.env.SMTP_PORT) === 465, // true for 465, false for others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Public Grievance System" <no-reply@grievanceportal.gov>',
      to: toEmail,
      subject: subject,
      html: htmlBody
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SUCCESS] Email sent to ${toEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${toEmail}:`, error.message);
    // Return true to avoid crashing request chains, but log the error
    return false;
  }
}

module.exports = {
  sendEmailNotification
};
