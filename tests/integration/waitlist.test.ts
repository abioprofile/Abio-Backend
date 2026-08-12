import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";

vi.mock("@/shared/utils/email", () => ({
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  sendWelcome: vi.fn().mockResolvedValue(undefined),
  sendWaitlistConfirmation: vi.fn().mockResolvedValue(undefined),
}));

const WAITLIST = "/api/v1/waitlist";

describe("Waitlist API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("joins the waitlist", async () => {
    const res = await testApp.post(WAITLIST).send({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/successfully joined waitlist/i);
    expect(res.body.data).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(res.body.data.id).toBeTruthy();
  });

  it("returns 409 for duplicate email", async () => {
    const payload = {
      name: "Grace Hopper",
      email: "grace@example.com",
    };

    const first = await testApp.post(WAITLIST).send(payload);
    expect(first.status).toBe(201);

    const duplicate = await testApp.post(WAITLIST).send({
      name: "Grace Again",
      email: "grace@example.com",
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.message).toMatch(/already registered/i);
  });

  it("rejects invalid input", async () => {
    const missingName = await testApp.post(WAITLIST).send({
      email: "nobody@example.com",
    });
    expect(missingName.status).toBe(400);
    expect(missingName.body.success).toBe(false);

    const badEmail = await testApp.post(WAITLIST).send({
      name: "Bad Email",
      email: "not-an-email",
    });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.success).toBe(false);
  });

  it("lists waitlist entries via the admin path", async () => {
    await testApp.post(WAITLIST).send({
      name: "Alan Turing",
      email: "alan@example.com",
    });

    const res = await testApp.get(`${WAITLIST}/jzI27AUJTCKU`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(
      res.body.data.some((e: { email: string }) => e.email === "alan@example.com")
    ).toBe(true);
  });
});
