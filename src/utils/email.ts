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


}
