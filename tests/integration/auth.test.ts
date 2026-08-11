import crypto from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createTestUser } from "../helpers/factories";
import { prisma } from "@/lib/prisma";

const { cacheStore } = vi.hoisted(() => ({
  cacheStore: new Map<string, string>(),
}));

vi.mock("@/lib/cache", () => ({
  default: {
    get: vi.fn(async (key: string) => cacheStore.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      cacheStore.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      cacheStore.delete(key);
      return 1;
    }),
  },
}));

vi.mock("@/shared/utils/email", () => ({
  default: class Email {
    constructor(..._args: unknown[]) {}
    sendEmailVerification = vi.fn().mockResolvedValue(undefined);
    sendPasswordReset = vi.fn().mockResolvedValue(undefined);
    static sendWaitlistConfirmation = vi.fn().mockResolvedValue(undefined);
  },
}));

const AUTH = "/api/v1/auth";
const USER = "/api/v1/user";

describe("Auth API", () => {
  beforeEach(() => {
    cacheStore.clear();
    vi.clearAllMocks();
  });

  it("signs up a new user and creates a profile", async () => {
    const email = `signup-${Date.now()}@test.abio.local`;
    const res = await testApp.post(`${AUTH}/signup`).send({
      name: "New User",
      email,
      password: "Password123!",
      passwordConfirm: "Password123!",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.profile).toBeTruthy();
    expect(res.body.data.password).toBeUndefined();
  });

  it("rejects duplicate signup email with 409", async () => {
    const email = `dup-${Date.now()}@test.abio.local`;
    await createTestUser({ email });

    const res = await testApp.post(`${AUTH}/signup`).send({
      name: "Dup",
      email,
      password: "Password123!",
      passwordConfirm: "Password123!",
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("logs in a verified user and sets cookies", async () => {
    const password = "Password123!";
    const user = await createTestUser({ password, isEmailVerified: true });

    const res = await testApp.post(`${AUTH}/login`).send({
      email: user.email,
      password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.token).toBeTruthy();
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^access=/),
        expect.stringMatching(/^logged_in=/),
      ])
    );
  });

  it("rejects login with wrong password", async () => {
    const user = await createTestUser({ password: "Password123!" });

    const res = await testApp.post(`${AUTH}/login`).send({
      email: user.email,
      password: "wrong-password",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects login when email is not verified", async () => {
    const password = "Password123!";
    const user = await createTestUser({ password, isEmailVerified: false });

    const res = await testApp.post(`${AUTH}/login`).send({
      email: user.email,
      password,
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  it("logs out and clears auth cookies", async () => {
    const res = await testApp.post(`${AUTH}/logout`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("blacklists the access token on logout so it cannot be reused", async () => {
    const user = await createTestUser();
    const headers = authHeader(user.id);

    const meBefore = await testApp.get(USER).set(headers);
    expect(meBefore.status).toBe(200);

    const logout = await testApp.post(`${AUTH}/logout`).set(headers);
    expect(logout.status).toBe(200);

    const meAfter = await testApp.get(USER).set(headers);
    expect(meAfter.status).toBe(401);
    expect(meAfter.body.success).toBe(false);
  });

  it("forgot-password 404s for unknown email", async () => {
    const res = await testApp.post(`${AUTH}/forgot-password`).send({
      email: `missing-${Date.now()}@test.abio.local`,
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("forgot-password stores a reset token for a known email", async () => {
    const user = await createTestUser();

    const res = await testApp.post(`${AUTH}/forgot-password`).send({
      email: user.email,
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/token sent/i);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        passwordResetToken: true,
        passwordResetExpires: true,
      },
    });
    expect(updated?.passwordResetToken).toBeTruthy();
    expect(updated?.passwordResetExpires).toBeTruthy();
  });

  it("resets password with a valid token then allows login", async () => {
    const user = await createTestUser({ password: "Password123!" });
    const plainToken = "123456";
    const hashedToken = crypto
      .createHash("sha256")
      .update(plainToken)
      .digest("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const reset = await testApp.post(`${AUTH}/reset-password`).send({
      token: plainToken,
      password: "NewPass123!",
      passwordConfirm: "NewPass123!",
    });

    expect(reset.status).toBe(200);
    expect(reset.body.message).toMatch(/password reset successfully/i);

    const oldLogin = await testApp.post(`${AUTH}/login`).send({
      email: user.email,
      password: "Password123!",
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await testApp.post(`${AUTH}/login`).send({
      email: user.email,
      password: "NewPass123!",
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.success).toBe(true);
  });

  it("rejects reset-password with invalid token", async () => {
    const res = await testApp.post(`${AUTH}/reset-password`).send({
      token: "000000",
      password: "NewPass123!",
      passwordConfirm: "NewPass123!",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("updates password when authenticated with correct current password", async () => {
    const user = await createTestUser({ password: "Password123!" });

    const res = await testApp
      .patch(`${AUTH}/update-password`)
      .set(authHeader(user.id))
      .send({
        passwordCurrent: "Password123!",
        password: "NewerPass123!",
        passwordConfirm: "NewerPass123!",
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password updated successfully/i);

    const login = await testApp.post(`${AUTH}/login`).send({
      email: user.email,
      password: "NewerPass123!",
    });
    expect(login.status).toBe(200);
  });

  it("rejects update-password with wrong current password", async () => {
    const user = await createTestUser({ password: "Password123!" });

    const res = await testApp
      .patch(`${AUTH}/update-password`)
      .set(authHeader(user.id))
      .send({
        passwordCurrent: "wrong-password",
        password: "NewerPass123!",
        passwordConfirm: "NewerPass123!",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("verifies email with a valid token and returns a JWT", async () => {
    const plainToken = "654321";
    const hashedToken = crypto
      .createHash("sha256")
      .update(plainToken)
      .digest("hex");

    const user = await createTestUser({ isEmailVerified: false });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedToken,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await testApp.post(`${AUTH}/verify-email`).send({
      token: plainToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.isEmailVerified).toBe(true);
  });

  it("resends verification email for an unverified user", async () => {
    const user = await createTestUser({ isEmailVerified: false });

    const res = await testApp.post(`${AUTH}/resend-verification-email`).send({
      email: user.email,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("sets up TOTP 2FA for an authenticated user with a profile", async () => {
    const user = await createTestUser();

    const res = await testApp
      .get(`${AUTH}/2fa/totp/activate`)
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.secret).toBeTruthy();
    expect(res.body.data.qrcode).toBeTruthy();
  });
});
