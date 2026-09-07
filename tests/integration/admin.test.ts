import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

const ADMIN_ME = "/api/v1/admin/me";
const ADMIN_USERS = "/api/v1/admin/users";

describe("Admin API", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };
  let adminId: string;
  let adminEmail: string;
  let adminName: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const admin = await createAdminUser({ name: "Smoke Admin" });
    userHeaders = authHeader(user.id);
    adminHeaders = authHeader(admin.id);
    adminId = admin.id;
    adminEmail = admin.email;
    adminName = admin.name;
  });

  it("rejects unauthenticated /admin/me", async () => {
    const res = await testApp.get(ADMIN_ME);
    expect(res.status).toBe(401);
  });

  it("rejects a normal user with 403 on /admin/me", async () => {
    const res = await testApp.get(ADMIN_ME).set(userHeaders);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("returns small profile for an admin (200)", async () => {
    const res = await testApp.get(ADMIN_ME).set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      id: adminId,
      email: adminEmail,
      name: adminName,
      roles: ["admin"],
    });
  });

  it("rejects normal user listing users", async () => {
    const res = await testApp.get(ADMIN_USERS).set(userHeaders);
    expect(res.status).toBe(403);
  });

  it("lists users with pagination for admin", async () => {
    await createTestUser({
      name: "Alice Searchable",
      email: "alice-list@test.abio.local",
    });

    const res = await testApp
      .get(ADMIN_USERS)
      .query({ page: "1", limit: "10" })
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.pagination).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);

    const sample = res.body.data.users[0];
    expect(sample).toHaveProperty("id");
    expect(sample).toHaveProperty("email");
    expect(sample).toHaveProperty("name");
    expect(sample).toHaveProperty("active");
    expect(sample).toHaveProperty("hasBadge");
    expect(sample).toHaveProperty("roles");
    expect(sample).not.toHaveProperty("password");
  });

  it("filters users by q (name or email)", async () => {
    await createTestUser({
      name: "UniqueZebra",
      email: "zebra-filter@test.abio.local",
    });

    const res = await testApp
      .get(ADMIN_USERS)
      .query({ q: "UniqueZebra" })
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(
      res.body.data.users.some((u: { name: string }) => u.name === "UniqueZebra")
    ).toBe(true);
  });

  it("filters users by active=false", async () => {
    const inactive = await createTestUser({ name: "Inactive User" });
    await prisma.user.update({
      where: { id: inactive.id },
      data: { active: false },
    });

    const res = await testApp
      .get(ADMIN_USERS)
      .query({ active: "false" })
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.users.every((u: { active: boolean }) => u.active === false)
    ).toBe(true);
  });

  it("filters users by hasBadge", async () => {
    const withBadge = await createTestUser({ name: "Badged User" });
    await prisma.verificationBadge.create({
      data: {
        userId: withBadge.id,
        assignedById: adminId,
        badgeType: "verified",
      },
    });

    const yes = await testApp
      .get(ADMIN_USERS)
      .query({ hasBadge: "true" })
      .set(adminHeaders);

    expect(yes.status).toBe(200);
    expect(
      yes.body.data.users.every((u: { hasBadge: boolean }) => u.hasBadge)
    ).toBe(true);
    expect(
      yes.body.data.users.some((u: { id: string }) => u.id === withBadge.id)
    ).toBe(true);

    const no = await testApp
      .get(ADMIN_USERS)
      .query({ hasBadge: "false" })
      .set(adminHeaders);

    expect(no.status).toBe(200);
    expect(
      no.body.data.users.every((u: { hasBadge: boolean }) => !u.hasBadge)
    ).toBe(true);
  });

  it("rejects unauthenticated GET /admin/users/:id", async () => {
    const target = await createTestUser({ name: "Detail Target" });
    const res = await testApp.get(`${ADMIN_USERS}/${target.id}`);
    expect(res.status).toBe(401);
  });

  it("rejects normal user GET /admin/users/:id with 403", async () => {
    const target = await createTestUser({ name: "Detail Target" });
    const res = await testApp
      .get(`${ADMIN_USERS}/${target.id}`)
      .set(userHeaders);
    expect(res.status).toBe(403);
  });

  it("returns user detail for admin (200)", async () => {
    const target = await createTestUser({
      name: "Detail Alice",
      email: "detail-alice@test.abio.local",
    });
    await prisma.verificationBadge.create({
      data: {
        userId: target.id,
        assignedById: adminId,
        badgeType: "verified",
      },
    });

    const res = await testApp
      .get(`${ADMIN_USERS}/${target.id}`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: target.id,
      email: target.email,
      name: "Detail Alice",
      active: true,
      isEmailVerified: true,
      hasBadge: true,
    });
    expect(res.body.data.roles).toEqual([]);
    expect(res.body.data.profile).toMatchObject({
      username: target.profile!.username,
    });
    expect(res.body.data.badges).toHaveLength(1);
    expect(res.body.data.badges[0]).toMatchObject({
      badgeType: "verified",
      revokedAt: null,
    });
    expect(res.body.data).not.toHaveProperty("password");
  });

  it("treats revoked-only badges as hasBadge false", async () => {
    const target = await createTestUser({ name: "Revoked Badge User" });
    await prisma.verificationBadge.create({
      data: {
        userId: target.id,
        assignedById: adminId,
        badgeType: "verified",
        revokedAt: new Date(),
        revokedById: adminId,
        revokeReason: "test revoke",
      },
    });

    const res = await testApp
      .get(`${ADMIN_USERS}/${target.id}`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.hasBadge).toBe(false);
    expect(res.body.data.badges).toHaveLength(1);
    expect(res.body.data.badges[0].revokedAt).not.toBeNull();
  });

  it("returns 404 for unknown user id", async () => {
    const res = await testApp
      .get(`${ADMIN_USERS}/00000000-0000-4000-8000-000000000099`)
      .set(adminHeaders);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for invalid user id", async () => {
    const res = await testApp
      .get(`${ADMIN_USERS}/not-a-uuid`)
      .set(adminHeaders);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects normal user PATCH /admin/users/:id with 403", async () => {
    const target = await createTestUser({ name: "Patch Target" });
    const res = await testApp
      .patch(`${ADMIN_USERS}/${target.id}`)
      .set(userHeaders)
      .send({ active: false });
    expect(res.status).toBe(403);
  });

  it("deactivates a user and writes an audit log", async () => {
    const target = await createTestUser({
      name: "To Deactivate",
      email: "deactivate-me@test.abio.local",
    });

    const res = await testApp
      .patch(`${ADMIN_USERS}/${target.id}`)
      .set(adminHeaders)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: target.id,
      active: false,
      email: target.email,
      name: "To Deactivate",
    });
    expect(res.body.data).not.toHaveProperty("password");

    const dbUser = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbUser?.active).toBe(false);

    const audit = await prisma.adminAuditLog.findFirst({
      where: {
        adminId: adminId,
        resourceType: "user",
        resourceId: target.id,
        action: "user.deactivate",
      },
    });
    expect(audit).toBeTruthy();
    expect(audit?.oldValue).toEqual({ active: true });
    expect(audit?.newValue).toEqual({ active: false });
  });

  it("reactivates a deactivated user", async () => {
    const target = await createTestUser({ name: "To Reactivate" });
    await prisma.user.update({
      where: { id: target.id },
      data: { active: false },
    });

    const res = await testApp
      .patch(`${ADMIN_USERS}/${target.id}`)
      .set(adminHeaders)
      .send({ active: true });

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(true);

    const audit = await prisma.adminAuditLog.findFirst({
      where: {
        resourceId: target.id,
        action: "user.reactivate",
      },
    });
    expect(audit).toBeTruthy();
  });

  it("rejects admin updating their own account", async () => {
    const res = await testApp
      .patch(`${ADMIN_USERS}/${adminId}`)
      .set(adminHeaders)
      .send({ active: false });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 when patching unknown user", async () => {
    const res = await testApp
      .patch(`${ADMIN_USERS}/00000000-0000-4000-8000-000000000099`)
      .set(adminHeaders)
      .send({ active: false });

    expect(res.status).toBe(404);
  });

  it("blocks deactivated user JWT on protected routes", async () => {
    const target = await createTestUser({ name: "Inactive Token User" });

    await testApp
      .patch(`${ADMIN_USERS}/${target.id}`)
      .set(adminHeaders)
      .send({ active: false });

    const res = await testApp
      .get("/api/v1/user/profile")
      .set(authHeader(target.id));

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
