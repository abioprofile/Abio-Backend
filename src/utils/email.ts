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
    this.firstName = user.firstName;
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

  async sendPartnerInvitation(
    partnerEmail: string,
    partnerName: string,
    relationship: string
  ) {
    const subject = `You've Been Invited to Support ${this.firstName}'s Journey on ${ORGANIZATION_NAME}`;
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UpHold — Invitation</title>
  <style>
    :root{
      --background: #0b0c0f0a;
      --foreground: #0b0c0f;
      --wellness-dark: #0F172A;
      --wellness-blue: #2563EB;
      --wellness-gray: #6B7280;
      --info-bg: #F3F4F6;
      --card-bg: #ffffff;
      --radius-xl: 16px;
      --shadow-card: 0 10px 30px rgba(2,6,23,0.07), 0 4px 12px rgba(2,6,23,0.06);
      --shadow-hover: 0 16px 40px rgba(2,6,23,0.10), 0 8px 18px rgba(2,6,23,0.08);
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body{
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
      color: var(--foreground);
      background: var(--background);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      line-height: 1.5;
    }

    .min-h-screen { min-height: 100vh; display: flex; flex-direction: column; }
    .container { max-width: 48rem; margin: 0 auto; padding: 0 1.5rem 2rem; width: 100%; }

    .header { display:flex; align-items:center; justify-content:center; padding-top: 2rem; padding-bottom: 1.25rem; }
    .brand { display:flex; align-items:center; gap: .75rem; }
    .brand-square{
      width: 2.5rem; height: 2.5rem; border-radius: .75rem;
      background: var(--wellness-dark); display:flex; align-items:center; justify-content:center;
    }
    .brand-square span{ color: #fff; font-weight: 800; font-size: 1.125rem; }
    .brand-name{ font-size: 1.25rem; font-weight: 600; }

    .card{
      background: var(--card-bg);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-card);
      padding: 2rem;
      transition: box-shadow .25s ease, transform .25s ease;
    }

    .center { text-align: center; }
    .title{
      font-size: clamp(1.5rem, 2.2vw + 1rem, 1.875rem);
      font-weight: 800;
      margin: 0 0 1.25rem;
      letter-spacing: -0.01em;
    }
    .lead{ font-size: 1.125rem; color: var(--foreground); }
    .muted{ color: var(--wellness-gray); }
    .section-title{
      font-size: 1.125rem; font-weight: 700; margin: 0 0 .75rem;
    }

    .avatar-wrap{
      display:flex; align-items:center; justify-content:center; gap: 1rem; margin-bottom: 1rem;
    }
    .avatar{
      width: 4rem; height: 4rem; border-radius: 9999px; overflow: hidden;
      display:flex; align-items:center; justify-content:center; background: var(--wellness-blue);
      color: #fff; font-weight: 700; font-size: 1.125rem;
      box-shadow: 0 6px 14px rgba(37, 99, 235, .25);
    }

    .info{
      background: var(--info-bg);
      border: 0;
      border-radius: calc(var(--radius-xl) - 4px);
      padding: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .list{ display: grid; gap: .75rem; }
    .row{ display:flex; align-items: flex-start; gap: .75rem; }
    .row .text .label{ display:block; font-weight: 600; color: var(--foreground); }
    .row .text .help{ color: var(--wellness-gray); }

    .bullets { list-style: none; padding: 0; margin: 0; display:grid; gap:.5rem; color: var(--wellness-gray); }
    .bullets li{ display:flex; align-items:flex-start; gap:.5rem; }
    .dot{
      width: .375rem; height: .375rem; border-radius: 9999px; background: var(--wellness-gray);
      margin-top: .5rem; flex-shrink: 0;
    }

    .btn{
      display:inline-flex; justify-content:center; align-items:center; gap:.5rem;
      width: 100%;
      padding: 1rem 1.25rem;
      border: 0; border-radius: .9rem;
      background: var(--wellness-dark); color: #fff;
      font-size: 1.125rem; font-weight: 600;
      cursor: pointer;
      transition: transform .08s ease, filter .2s ease, box-shadow .2s ease;
      box-shadow: 0 8px 18px rgba(15,23,42,.18), inset 0 0 0 1px rgba(255,255,255,.06);
      text-decoration: none;
    }

    .icon{ width: 20px; height: 20px; flex-shrink: 0; color: var(--wellness-gray); margin-top: 2px; }
    .icon-lock{ width: 20px; height: 20px; color: var(--wellness-gray); }

    .mt-24 { margin-top: 1.5rem; }
    .mb-24 { margin-bottom: 1.5rem; }
    .mb-32 { margin-bottom: 2rem; }
    .pb-32 { padding-bottom: 2rem; }

    @media (min-width: 480px){
      .card{ padding: 2.5rem; }
    }
    @media (min-width: 640px){
      .card{ padding: 3rem; }
    }
  </style>
</head>
<body>
  <div class="min-h-screen">
    <header class="header">
      <div class="brand">
        <div class="brand-square"><span>U</span></div>
        <span class="brand-name">${ORGANIZATION_NAME}</span>
      </div>
    </header>

    <main class="container pb-32">
      <section class="card">
        <div class="center mb-32">
          <h1 class="title">You've Been Invited to Support Someone's Journey</h1>

          <div class="avatar-wrap">
            <div class="avatar" aria-hidden="true">
              ${this.firstName.charAt(0).toUpperCase()}${
      this.firstName.split(" ")[1]
        ? this.firstName.split(" ")[1].charAt(0).toUpperCase()
        : ""
    }
            </div>
          </div>

          <p class="lead">
            <strong>${this.firstName}</strong> (${
      this.to
    }) has invited you to be their accountability
            partner on ${ORGANIZATION_NAME}, a privacy-first digital wellness platform.
          </p>

          <p class="muted mt-24">
            As their <strong class="lead" style="font-size:1rem;">${relationship}</strong>, you would receive progress updates to help support their
            journey toward healthier digital habits.
          </p>
        </div>

        <div class="info mb-24">
          <h2 class="section-title">What does this mean?</h2>
          <p class="muted">
            ${ORGANIZATION_NAME} helps people break free from compulsive digital behaviors like
            excessive social media use, adult content consumption, and online gambling.
            Your role would be to provide encouragement and accountability through
            <span style="color: var(--wellness-blue); font-weight: 600;">automated progress reports</span>.
          </p>
        </div>

        <div class="info mb-32">
          <h2 class="section-title">What you'll receive:</h2>
          <div class="list">
            <div class="row">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6"/>
                <path d="M16 13H8"/>
                <path d="M16 17H8"/>
                <path d="M10 9H8"/>
              </svg>
              <div class="text">
                <span class="label">Weekly Progress Reports</span>
                <span class="help">Summary of their digital wellness progress</span>
              </div>
            </div>

            <div class="row">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="6"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
              <div class="text">
                <span class="label">Streak Milestones</span>
                <span class="help">Notifications when they reach important milestones</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mb-32">
          <div class="row mb-24" style="align-items:center;">
            <svg class="icon-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <h2 class="section-title" style="margin:0;">Privacy &amp; Control</h2>
          </div>
          <ul class="bullets">
            <li><span class="dot"></span><span>You'll only receive the specific information ${
              this.firstName
            } has authorized</span></li>
            <li><span class="dot"></span><span>No personal content, messages, or detailed browsing history is ever shared</span></li>
            <li><span class="dot"></span><span>${
              this.firstName
            } can modify or revoke these permissions at any time</span></li>
            <li><span class="dot"></span><span>All data is encrypted and handled with the highest privacy standards</span></li>
          </ul>
        </div>

        <a href="${this.code}" class="btn">
          Accept Invitation &amp; Support ${this.firstName}
        </a>
      </section>
    </main>
  </div>
</body>
</html>
    `;

    // Send to partner email instead of user's email
    const mailOptions = {
      from: this.from,
      to: partnerEmail,
      subject,
      html,
      text: convert(html),
    };

    await this.createTransport().sendMail(mailOptions);
  }
}
