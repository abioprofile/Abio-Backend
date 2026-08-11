import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createTestUser } from "../helpers/factories";
import { prisma } from "@/lib/prisma";

vi.mock("@/shared/utils/email", () => ({
  default: class Email {
    constructor(..._args: unknown[]) {}
    sendEmailVerification = vi.fn().mockResolvedValue(undefined);
    static sendWaitlistConfirmation = vi.fn().mockResolvedValue(undefined);
  },
}));

const USER = "/api/v1/user";

describe("Users API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs up a new user and creates a profile", async () => {
    const email = `signup-${Date.now()}@test.abio.local`;
    const res = await testApp.post(`${USER}/signup`).send({
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

    const res = await testApp.post(`${USER}/signup`).send({
      name: "Dup",
      email,
      password: "Password123!",
      passwordConfirm: "Password123!",
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("returns the logged-in user", async () => {
    const user = await createTestUser();
    const res = await testApp.get(USER).set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.email).toBe(user.email);
  });

  it("rejects get me without auth", async () => {
    const res = await testApp.get(USER);
    expect(res.status).toBe(401);
  });

  it("rejects account delete with wrong password", async () => {
    const user = await createTestUser({ password: "Password123!" });
    const res = await testApp
      .delete(USER)
      .set(authHeader(user.id))
      .send({ password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("deletes the account with the correct password", async () => {
    const user = await createTestUser({ password: "Password123!" });
    const res = await testApp
      .delete(USER)
      .set(authHeader(user.id))
      .send({ password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const gone = await prisma.user.findUnique({ where: { id: user.id } });
    expect(gone).toBeNull();
  });
});
