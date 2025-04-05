// server/utils/emailService.js
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const readHTMLFile = (filePath, callback) => {
  fs.readFile(filePath, { encoding: 'utf-8' }, (err, html) => {
    if (err) {
      callback(err);
    } else {
      callback(null, html);
    }
  });
};

const sendEmail = (to, subject, templateName, replacements) => {
  const templatePath = path.join(__dirname, '..', 'email-templates', `${templateName}.html`);

  readHTMLFile(templatePath, (err, html) => {
    if (err) {
      console.error('Error reading email template:', err);
      return;
    }

    const template = handlebars.compile(html);
    const htmlToSend = template(replacements);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: to,
      subject: subject,
      html: htmlToSend,
    };

    transporter.sendMail(mailOptions, (error, response) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent successfully to:', to);
      }
    });
  });
};

module.exports = { sendEmail };