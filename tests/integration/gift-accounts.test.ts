import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { enqueueVerificationEmail } from "@/queues/queue";
import { sendGiftAccountClaim } from "@/shared/utils/email";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

vi.mock("@/lib/cache", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    mget: vi.fn().mockResolvedValue([null, null]),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
  },
  DEPLOY_ID: "test",
}));

vi.mock("@/shared/utils/email", () => ({
  sendGiftAccountClaim: vi.fn().mockResolvedValue(undefined),
  sendModeratorInvitation: vi.fn().mockResolvedValue(undefined),
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  sendWelcome: vi.fn().mockResolvedValue(undefined),
  sendWaitlistConfirmation: vi.fn().mockResolvedValue(undefined),
  sendLinkTapNotification: vi.fn().mockResolvedValue(undefined),
}));

const GIFTS = "/api/v1/admin/gift-accounts";
const RESET = "/api/v1/auth/reset-password";
const AUTH = "/api/v1/auth";
const PASSWORD = "Gift-Pass123!";

const tokenFrom = (claimUrl: string) => claimUrl.split("/auth/reset-password/")[1];

async function createModeratorUser() {
  const user = await createTestUser({ name: "Mod" });
  const role = await prisma.role.upsert({
    where: { name: "moderator" },
    create: { name: "moderator" },
    update: {},
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return user;
}

const claim = (token: string, password = PASSWORD) =>
  testApp.post(RESET).send({ token, password, passwordConfirm: password });

let seq = 0;
const uniqueEmail = () => `gift-${Date.now()}-${seq++}@example.com`;

describe("Gift accounts", () => {
  let staff: { Authorization: string };
  let staffId: string;

  const createGift = (body: Record<string, unknown>, headers = staff) =>
    testApp
      .post(GIFTS)
      .set(headers)
      .send({ email: uniqueEmail(), ...body });

  beforeEach(async () => {
    vi.clearAllMocks();
    const admin = await createAdminUser({ name: "Gift Admin" });
    staffId = admin.id;
    staff = authHeader(admin.id);
  });

  describe("access control", () => {
    it("rejects anonymous and regular users", async () => {
      const user = await createTestUser();
      expect((await testApp.get(GIFTS)).status).toBe(401);
      expect((await testApp.get(GIFTS).set(authHeader(user.id))).status).toBe(403);
      const res = await createGift(
        { name: "X", username: "nope_user" },
        authHeader(user.id)
      );
      expect(res.status).toBe(403);
    });

    it("lets moderators create gift accounts", async () => {
      const mod = await createModeratorUser();
      const res = await createGift(
        { name: "Mod Gift", username: "mod_gift" },
        authHeader(mod.id)
      );
      expect(res.status).toBe(201);
    });
  });

  describe("create", () => {
    it("creates an unclaimed account with a claim link and QR code", async () => {
      const res = await createGift({
        name: "Ada Lovelace",
        username: "ada_gift",
        email: "Ada@Example.com",
        sendEmail: true,
      });

      expect(res.status).toBe(201);
      const { account, claim } = res.body.data;
      expect(account).toMatchObject({
        name: "Ada Lovelace",
        email: "ada@example.com",
        username: "ada_gift",
        status: "unclaimed",
        isEmailVerified: false,
      });
      expect(claim.claimUrl).toMatch(/\/auth\/reset-password\/[a-f0-9]{64}$/);
      expect(claim.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(claim.emailStatus).toBe("sent");
      expect(sendGiftAccountClaim).toHaveBeenCalledWith(
        expect.objectContaining({ to: "ada@example.com", claimUrl: claim.claimUrl })
      );

      // Only the hash of the token is stored.
      const gift = await prisma.giftAccount.findUniqueOrThrow({
        where: { userId: account.userId },
      });
      expect(gift.claimTokenHash).not.toBe(tokenFrom(claim.claimUrl));
      expect(gift.createdById).toBe(staffId);

      const audit = await prisma.adminAuditLog.findFirst({
        where: { action: "gift_account.create", resourceId: account.userId },
      });
      expect(audit).not.toBeNull();
      expect(JSON.stringify(audit)).not.toContain(tokenFrom(claim.claimUrl));
    });

    it("requires an email and can skip sending it", async () => {
      const missing = await testApp
        .post(GIFTS)
        .set(staff)
        .send({ name: "No Mail", username: "no_mail" });
      expect(missing.status).toBe(400);

      const res = await createGift({ name: "Quiet", username: "quiet_gift" });
      expect(res.status).toBe(201);
      expect(res.body.data.claim.emailStatus).toBe("skipped");
      expect(sendGiftAccountClaim).not.toHaveBeenCalled();
    });

    it("rejects an email that is already registered and leaves it untouched", async () => {
      const existing = await createTestUser({ email: "taken@example.com", name: "Original" });
      const res = await createGift({
        name: "Dup",
        username: "dup_user",
        email: "TAKEN@example.com",
      });
      expect(res.status).toBe(409);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
      expect(after.name).toBe("Original");
      expect(await prisma.giftAccount.count()).toBe(0);
    });

    it("rejects a taken username", async () => {
      await createGift({ name: "A", username: "same_name" });
      const res = await createGift({ name: "B", username: "Same_Name" });
      expect(res.status).toBe(409);
    });

    it("rejects unknown fields such as a password", async () => {
      const res = await createGift({
        name: "Sneaky",
        username: "sneaky",
        password: "Password123!",
      });
      expect(res.status).toBe(400);
    });

    it("cannot be logged into before it is claimed", async () => {
      await createGift({ name: "Lock", username: "locked", email: "lock@example.com" });
      const login = await testApp
        .post(`${AUTH}/login`)
        .send({ email: "lock@example.com", password: "anything" });
      expect(login.status).toBe(401);

      const forgot = await testApp
        .post(`${AUTH}/forgot-password`)
        .send({ email: "lock@example.com" });
      expect(forgot.status).toBe(403);

      const resend = await testApp
        .post(`${AUTH}/resend-verification-email`)
        .send({ email: "lock@example.com" });
      expect(resend.status).toBe(403);
    });
  });

  describe("list and detail", () => {
    it("lists and filters by status and search", async () => {
      await createGift({ name: "Listed One", username: "listed_one" });
      await createGift({ name: "Listed Two", username: "listed_two" });

      const all = await testApp.get(GIFTS).set(staff);
      expect(all.status).toBe(200);
      expect(all.body.data.pagination.total).toBe(2);

      const search = await testApp.get(GIFTS).query({ q: "two" }).set(staff);
      expect(search.body.data.accounts).toHaveLength(1);

      const claimed = await testApp.get(GIFTS).query({ status: "claimed" }).set(staff);
      expect(claimed.body.data.accounts).toHaveLength(0);
    });

    it("returns 404 for a regular user", async () => {
      const user = await createTestUser();
      const res = await testApp.get(`${GIFTS}/${user.id}`).set(staff);
      expect(res.status).toBe(404);
    });
  });

  describe("staff build-out", () => {
    let userId: string;

    beforeEach(async () => {
      const res = await createGift({ name: "Builder", username: "builder_gift" });
      userId = res.body.data.account.userId;
    });

    it("edits profile, links and preferences and audits each change", async () => {
      const profile = await testApp
        .patch(`${GIFTS}/${userId}/profile`)
        .set(staff)
        .send({ bio: "Hello from Abio", location: "Lagos", displayName: "Builder Pro" });
      expect(profile.status).toBe(200);
      expect(profile.body.data.bio).toBe("Hello from Abio");

      const link = await testApp
        .post(`${GIFTS}/${userId}/links`)
        .set(staff)
        .send({ title: "GitHub", url: "https://github.com/abio-test" });
      expect(link.status).toBe(201);
      const linkId = link.body.data.id;

      const update = await testApp
        .patch(`${GIFTS}/${userId}/links/${linkId}`)
        .set(staff)
        .send({ title: "My GitHub" });
      expect(update.status).toBe(200);

      const links = await testApp.get(`${GIFTS}/${userId}/links`).set(staff);
      expect(links.status).toBe(200);
      expect(links.body.data).toHaveLength(1);

      const prefs = await testApp
        .put(`${GIFTS}/${userId}/preferences`)
        .set(staff)
        .send({ corner_config: { type: "round" } });
      expect(prefs.status).toBe(200);

      const del = await testApp.delete(`${GIFTS}/${userId}/links/${linkId}`).set(staff);
      expect(del.status).toBe(200);

      const detail = await testApp.get(`${GIFTS}/${userId}`).set(staff);
      expect(detail.body.data.name).toBe("Builder Pro");
      expect(detail.body.data.profile.location).toBe("Lagos");

      const actions = (
        await prisma.adminAuditLog.findMany({
          where: { resourceId: userId },
          select: { action: true },
        })
      ).map((a) => a.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          "gift_account.profile.update",
          "gift_account.link.create",
          "gift_account.link.update",
          "gift_account.preferences.update",
          "gift_account.link.delete",
        ])
      );
    });

    it("cannot touch another user's link through a gift account", async () => {
      const other = await createTestUser();
      const otherLink = await prisma.link.create({
        data: {
          title: "Private",
          url: "https://example.com",
          profileId: other.profile!.id,
        },
      });
      const res = await testApp
        .patch(`${GIFTS}/${userId}/links/${otherLink.id}`)
        .set(staff)
        .send({ title: "Hijacked" });
      expect(res.status).toBe(404);
      const unchanged = await prisma.link.findUniqueOrThrow({ where: { id: otherLink.id } });
      expect(unchanged.title).toBe("Private");
    });

    it("refuses edit routes for regular users", async () => {
      const user = await createTestUser();
      const res = await testApp
        .patch(`${GIFTS}/${user.id}/profile`)
        .set(staff)
        .send({ bio: "staff should not do this" });
      expect(res.status).toBe(404);
    });
  });

  describe("claim links", () => {
    it("re-issuing invalidates the previous link and can change the email", async () => {
      const created = await createGift({ name: "Reissue", username: "reissue" });
      const { userId } = created.body.data.account;
      const oldToken = tokenFrom(created.body.data.claim.claimUrl);

      const res = await testApp
        .post(`${GIFTS}/${userId}/claim-link`)
        .set(staff)
        .send({ email: "reissue@example.com" });
      expect(res.status).toBe(201);
      expect(res.body.data.emailStatus).toBe("sent");
      expect(sendGiftAccountClaim).toHaveBeenLastCalledWith(
        expect.objectContaining({ to: "reissue@example.com" })
      );

      expect((await claim(oldToken)).status).toBe(400);
      expect((await claim(tokenFrom(res.body.data.claimUrl))).status).toBe(200);
    });

    it("rejects an expired link", async () => {
      const created = await createGift({ name: "Expired", username: "expired_gift" });
      await prisma.giftAccount.update({
        where: { userId: created.body.data.account.userId },
        data: { claimTokenExpiresAt: new Date(Date.now() - 1000) },
      });
      const res = await claim(tokenFrom(created.body.data.claim.claimUrl));
      expect(res.status).toBe(400);
    });
  });

  describe("claiming through the reset-password page", () => {
    it("claims once, requires verification, then hands full control to the owner", async () => {
      const created = await createGift({
        name: "Grace Hopper",
        username: "grace_gift",
        email: "grace@example.com",
      });
      const { userId } = created.body.data.account;
      const token = tokenFrom(created.body.data.claim.claimUrl);

      const res = await claim(token);
      expect(res.status).toBe(200);
      expect(enqueueVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "grace@example.com" })
      );

      // Single use.
      expect((await claim(token)).status).toBe(400);

      // Login waits for email verification.
      const early = await testApp
        .post(`${AUTH}/login`)
        .send({ email: "grace@example.com", password: PASSWORD });
      expect(early.status).toBe(403);

      await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });
      const login = await testApp
        .post(`${AUTH}/login`)
        .send({ email: "grace@example.com", password: PASSWORD });
      expect(login.status).toBe(200);

      // Staff can no longer edit or re-issue links.
      const edit = await testApp
        .patch(`${GIFTS}/${userId}/profile`)
        .set(staff)
        .send({ bio: "too late" });
      expect(edit.status).toBe(409);
      const reissue = await testApp.post(`${GIFTS}/${userId}/claim-link`).set(staff).send({});
      expect(reissue.status).toBe(409);

      const detail = await testApp.get(`${GIFTS}/${userId}`).set(staff);
      expect(detail.body.data.status).toBe("claimed");

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { notifyOnLinkTap: true },
      });
      expect(user.notifyOnLinkTap).toBe(true);
    });

    it("keeps normal password resets working", async () => {
      await createTestUser({ email: "regular@example.com" });
      const forgot = await testApp
        .post(`${AUTH}/forgot-password`)
        .send({ email: "regular@example.com" });
      expect(forgot.status).toBe(200);
      expect((await claim("a".repeat(64))).status).toBe(400);
    });
  });

  describe("safety guards", () => {
    it("rejects reserved usernames on create and on profile edit", async () => {
      const res = await createGift({ name: "Dash", username: "Dashboard" });
      expect(res.status).toBe(400);

      const ok = await createGift({ name: "Fine", username: "fine_name" });
      const edit = await testApp
        .patch(`${GIFTS}/${ok.body.data.account.userId}/profile`)
        .set(staff)
        .send({ username: "store" });
      expect(edit.status).toBe(400);
    });

    it("makes a claim wait while a staff edit may still be running", async () => {
      const created = await createGift({ name: "Racer", username: "racer_gift" });
      const { userId } = created.body.data.account;
      const token = tokenFrom(created.body.data.claim.claimUrl);

      await testApp.patch(`${GIFTS}/${userId}/profile`).set(staff).send({ bio: "just edited" });
      const blocked = await claim(token);
      expect(blocked.status).toBe(409);

      // Once the edit window has passed, the same link works.
      await prisma.giftAccount.update({
        where: { userId },
        data: { staffEditStartedAt: new Date(Date.now() - 2 * 60 * 1000) },
      });
      expect((await claim(token)).status).toBe(200);
    });

    it("deletes an unclaimed gift account but never a claimed one", async () => {
      const created = await createGift({ name: "Temp", username: "temp_gift" });
      const { userId } = created.body.data.account;

      const del = await testApp.delete(`${GIFTS}/${userId}`).set(staff);
      expect(del.status).toBe(200);
      expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
      const audit = await prisma.adminAuditLog.findFirst({
        where: { action: "gift_account.delete", resourceId: userId },
      });
      expect(audit).not.toBeNull();

      const kept = await createGift({ name: "Keep", username: "keep_gift" });
      const keptId = kept.body.data.account.userId;
      await claim(tokenFrom(kept.body.data.claim.claimUrl));
      const refused = await testApp.delete(`${GIFTS}/${keptId}`).set(staff);
      expect(refused.status).toBe(409);
      expect(await prisma.user.findUnique({ where: { id: keptId } })).not.toBeNull();

      const regular = await createTestUser();
      expect((await testApp.delete(`${GIFTS}/${regular.id}`).set(staff)).status).toBe(404);
    });
  });
});
