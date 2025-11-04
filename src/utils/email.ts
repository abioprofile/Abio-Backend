import { UserWithProfile } from "@/types";

import { convert } from "html-to-text";
import nodemailer from "nodemailer";
import { ORGANIZATION_NAME } from "@/utils/constants";

export default class Email {
  private to: string;
  private firstName: string;
  private code: string;
  private from: string;

  constructor(user: UserWithProfile, code: string) {
    this.to = user.email;
    // Extract first name from the full name (use full name if no space found)
    this.firstName = user.name.split(' ')[0] || user.name;
    this.code = code;
    this.from = `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`;
  }

  private createTransport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  private async send(subject: string, html: string) {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html),
    };

    await this.createTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    const subject = `Welcome to ${ORGANIZATION_NAME}!`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome, ${this.firstName}!</h2>
        <p>We're excited to have you on board. Click the button below to get started:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.code}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">
            Get Started
          </a>
        </div>
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Best regards,<br>${ORGANIZATION_NAME}</p>
      </div>
    `;

    await this.send(subject, html);
  }

  async sendPasswordReset() {
    const subject = "Your Password Reset Token (Valid for 10 minutes)";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hi ${this.firstName},</p>
        <p>You requested to reset your password. Use the verification code below to reset it (valid for 10 minutes):</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f5f5f5; color: #333; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; border: 2px dashed #4CAF50;">
            ${this.code}
          </div>
        </div>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>${ORGANIZATION_NAME}</p>
      </div>
    `;

    await this.send(subject, html);
  }

  async sendEmailVerification() {
    const subject = "Verify Your Email Address";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${ORGANIZATION_NAME}!</h2>
        <p>Hi ${this.firstName},</p>
        <p>Thank you for signing up! To complete your registration and verify your email address, please use the verification code below (valid for 10 minutes):</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f5f5f5; color: #333; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; border: 2px dashed #4CAF50;">
            ${this.code}
          </div>
        </div>
        <p>If you didn't create an account with us, please ignore this email.</p>
        <p>Best regards,<br>${ORGANIZATION_NAME}</p>
      </div>
    `;

    await this.send(subject, html);
  }

  static async sendWaitlistConfirmation(email: string, name: string) {
    const subject = "You've successfully joined the Waitlist!";
    const from = `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`;
    
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>bio.site Waitlist</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Satoshi:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #fef4ea;
        font-family: "Satoshi", Arial, sans-serif;
        color: #2b1c12;
      }

      .logo {
        text-align: center;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
      }

      .logo img {
        width: 22px;
        height: 22px;
      }

      .logo-text {
        font-weight: 700;
        font-size: 22px;
        color: #2b1c12;
        line-height: 1;
      }

      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #fff4ec;
        border-radius: 10px;
        padding: 30px 25px;
      }

      h1 {
        font-size: 1.3em;
        margin-top: 0;
        text-align: center;
      }

      p {
        margin-bottom: 20px;
        line-height: 1.5;
        font-size: 14px;
      }

      /* Footer styles (converted from Tailwind/React design to email-safe CSS) */
      .email-footer {
        background-color: #331400;
        color: #ffffff;
        padding: 20px 0 22px 0;
        /* border-radius: 0 0 10px 10px; */
        font-size: 14px;
      }

      .email-footer .inner {
        max-width: full;
        margin: 0;
        padding: 0 12px;
      }

      .brand-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: nowrap;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .brand img {
        width: 28px;
        height: 28px;
        display: block;
        border: 0;
      }

      .brand .brand-name {
        font-weight: 700;
        font-size: 16px;
        color: #ffffff;
        line-height: 1;
      }

      .legal-link a {
        color: #ffffff;
        text-decoration: none;
        font-weight: 700;
        font-size: 13px;
      }

      .bottom-row {
        border-top: 2px solid #fed45c;
        padding-top: 12px;
        margin-top: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .copyright {
        font-weight: 500;
        font-size: 12px;
        color: #ffffff;
      }

      .social-icons {
        display: flex;
        margin-top: 5px;
        gap: 8px;
        font-size: 14px;
      }

      .social-link {
        display: inline-block;
        padding: 6px;
        color: #fff;
        text-decoration: none;
      }

      .social-link svg {
        display: block;
        width: 16px;
        height: 16px;
        fill: #fff;
      }

      @media (max-width: 600px) {
        h1 {
          font-size: 1.4em;
        }

        .bottom-row {
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
        }

        .copyright {
          text-align: center;
          width: 100%;
        }

        .social-icons {
          justify-content: center;
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">
        <img
          src="https://abio.site/_next/image?url=%2Ficons%2FA.Bio.png&w=64&q=75"
          alt="bio.site Logo"
          fetchpriority="high"
          loading="eager"
        />
        <span class="logo-text">bio</span>
      </div>
      <h1>You've successfully joined the Waitlist!</h1>

      <p>Welcome ${name}! 🎉</p>
      <p>
        Get ready for abio.site Web Beta.<br />
        You’re on the waitlist to use the abio.site Web Beta. We can’t wait for
        you to experience the future of seamless contact sharing where sharing
        your details is as simple as sharing one single link.
      </p>
      <p>
        abio.site brings all your contact information, social and key links to
        one beautifully designed profile that works anywhere, from business
        meetings and social events to casual meetups paired with our Acard. No
        more juggling business cards or typing out usernames, just instant,
        effortless connections.
      </p>
      <p>
        You’ll receive an email once we launch! In the meantime, be sure to
        check out our socials and stay tuned for updates.
      </p>

      <footer class="email-footer">
        <div class="inner">
          <div class="brand-row">
            <div class="brand">
              <a
                href="https://abio.site"
                style="
                  text-decoration: none;
                  color: inherit;
                  display: flex;
                  align-items: center;
                  gap: 2px;
                "
              >
                <img
                  src="https://abio.site/_next/image?url=%2Ficons%2FA.Bio.png&w=64&q=75"
                  alt="A.Bio Logo"
                  width="20"
                  height="20"
                  loading="eager"
                  fetchpriority="high"
                  style="vertical-align: middle; border: 0"
                />
                <span class="brand-name" style="color: #fff">bio</span>
              </a>
            </div>
            <div class="legal-link">
              <a href="#" target="_blank" rel="noopener noreferrer"
                >Privacy Policy</a
              >
            </div>
          </div>

          <div class="bottom-row">
            <div class="copyright">
              © 2025 🅰bio.site — One Link, Endless Connections
            </div>
            <div class="social-icons">
              <!-- Instagram -->
              <a
                class="social-link"
                href="https://www.instagram.com/abio.site?igsh=MXhjYmtvOWlvbXBpeg%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <svg
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7zm5 6a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm6.5-3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"
                  />
                </svg>
              </a>

              <!-- TikTok -->
              <a
                class="social-link"
                href="https://www.tiktok.com/@abio.site?_t=ZS-90XaM2rHhp4&_r=1"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
              >
                <svg
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12.75 3h3.06c.18 1.56 1.37 3.2 3.19 3.6v3.15a6.27 6.27 0 0 1-3.19-.88v5.68c0 3.45-2.88 6.25-6.44 6.25S3.94 18 3.94 14.44 6.81 8.19 10.38 8.19v3.2a3.05 3.05 0 0 0-3.06 3.05 3.05 3.05 0 0 0 3.06 3.05c1.7 0 3.07-1.37 3.07-3.05V3z"
                  />
                </svg>
              </a>

              <!-- Pinterest -->
              <a
                class="social-link"
                href="https://pin.it/4rk3x7b28"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pinterest"
              >
                <svg
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2.04C6.48 2.04 2 6.52 2 12.04c0 4.13 2.52 7.66 6.13 9.18-.09-.78-.17-1.98.04-2.83.18-.77 1.16-4.89 1.16-4.89s-.3-.61-.3-1.51c0-1.41.82-2.47 1.84-2.47.87 0 1.29.65 1.29 1.43 0 .87-.55 2.18-.83 3.39-.24 1.02.52 1.85 1.54 1.85 1.85 0 3.27-1.95 3.27-4.77 0-2.49-1.79-4.23-4.34-4.23-2.96 0-4.71 2.22-4.71 4.52 0 .9.35 1.87.8 2.4.09.11.1.21.08.33-.09.36-.29 1.13-.33 1.29-.05.21-.17.26-.4.16-1.49-.69-2.43-2.85-2.43-4.59 0-3.73 2.71-7.17 7.82-7.17 4.1 0 7.29 2.93 7.29 6.84 0 4.08-2.57 7.37-6.13 7.37-1.2 0-2.32-.63-2.71-1.36l-.74 2.83c-.27 1.04-1 2.34-1.49 3.13 1.12.35 2.3.54 3.53.54 5.52 0 10-4.48 10-10s-4.48-10-10-10z"
                  />
                </svg>
              </a>

              <!-- X (Twitter) -->
              <a
                class="social-link"
                href="https://x.com/abioprofile?s=21"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
              >
                <svg
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M18.9 2H22l-7.98 9.14L23 22h-7.1l-5.5-6.63L4.9 22H2l8.58-9.84L2.4 2h7.2l5 5.94L18.9 2zm-2.43 18h1.7L7.64 4h-1.8l10.63 16z"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </body>
</html>
`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from,
      to: email,
      subject,
      html,
      text: convert(html),
    };

    await transporter.sendMail(mailOptions);
  }

}
