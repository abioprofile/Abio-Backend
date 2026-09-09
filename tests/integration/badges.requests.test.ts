import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

vi.mock("@/shared/utils/cloudinary", () => ({
  uploadToCloudinary: vi.fn().mockResolvedValue({
    url: "https://cdn.example.com/badge-id-documents/id.webp",
    publicId: "badge-id-documents/id",
  }),
  deleteFromCloudinary: vi.fn().mockResolvedValue(undefined),
}));

const USER_REQ = "/api/v1/user/badges/requests";
const ADMIN_REQ = "/api/v1/admin/badge-requests";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("Badge verification requests", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };
  let userId: string;
  let adminId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const user = await createTestUser({ name: "Badge Applicant" });
    const admin = await createAdminUser({ name: "Badge Admin" });
    userId = user.id;
    adminId = admin.id;
    userHeaders = authHeader(user.id);
    adminHeaders = authHeader(admin.id);
  });

  it("lets a user submit a request with reason + id document", async () => {
    const res = await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "I am a verified creator on Abio.")
      .attach("idDocument", tinyPng, "id.png");

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.reason).toContain("verified creator");
    expect(res.body.data.idDocumentUrl).toContain("cdn.example.com");
  });

  it("rejects duplicate pending requests", async () => {
    await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "First verification request here.")
      .attach("idDocument", tinyPng, "id.png");

    const res = await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "Second verification request here.")
      .attach("idDocument", tinyPng, "id.png");

    expect(res.status).toBe(409);
  });

  it("returns my badge status", async () => {
    await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "Please verify my identity now.")
      .attach("idDocument", tinyPng, "id.png");

    const res = await testApp.get(`${USER_REQ}/me`).set(userHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.hasActiveBadge).toBe(false);
    expect(res.body.data.latestRequest.status).toBe("pending");
  });

  it("lists pending requests for staff and approves them", async () => {
    const created = await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "Approve this verification request.")
      .attach("idDocument", tinyPng, "id.png");

    const list = await testApp
      .get(ADMIN_REQ)
      .query({ status: "pending" })
      .set(adminHeaders);
    expect(list.status).toBe(200);
    expect(list.body.data.requests.length).toBeGreaterThanOrEqual(1);

    const approve = await testApp
      .post(`${ADMIN_REQ}/${created.body.data.id}/approve`)
      .set(adminHeaders);
    expect(approve.status).toBe(200);
    expect(approve.body.data.request.status).toBe("approved");
    expect(approve.body.data.badge.revokedAt).toBeNull();

    const status = await testApp.get(`${USER_REQ}/me`).set(userHeaders);
    expect(status.body.data.hasActiveBadge).toBe(true);

    const audit = await prisma.adminAuditLog.findFirst({
      where: { adminId, action: "badge.request.approve" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects a pending request with optional reason", async () => {
    const created = await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "Please reject this verification.")
      .attach("idDocument", tinyPng, "id.png");

    const res = await testApp
      .post(`${ADMIN_REQ}/${created.body.data.id}/reject`)
      .set(adminHeaders)
      .send({ reason: "Document unclear" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("rejected");
    expect(res.body.data.reviewNote).toBe("Document unclear");

    const status = await testApp.get(`${USER_REQ}/me`).set(userHeaders);
    expect(status.body.data.hasActiveBadge).toBe(false);
    expect(status.body.data.latestRequest.status).toBe("rejected");
  });

  it("blocks new request while active badge exists; allows after revoke", async () => {
    const created = await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "Grant then revoke then re-request.")
      .attach("idDocument", tinyPng, "id.png");

    await testApp
      .post(`${ADMIN_REQ}/${created.body.data.id}/approve`)
      .set(adminHeaders);

    const blocked = await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "Should not work with active badge.")
      .attach("idDocument", tinyPng, "id.png");
    expect(blocked.status).toBe(409);

    await testApp
      .post(`/api/v1/admin/users/${userId}/badges/verified/revoke`)
      .set(adminHeaders)
      .send({ reason: "Expired" });

    const again = await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "Re-request after revoke is allowed.")
      .attach("idDocument", tinyPng, "id.png");
    expect(again.status).toBe(201);
  });

  it("closes pending request when admin direct-grants", async () => {
    const created = await testApp
      .post(USER_REQ)
      .set(userHeaders)
      .field("reason", "Pending until direct grant closes it.")
      .attach("idDocument", tinyPng, "id.png");

    await testApp
      .post(`/api/v1/admin/users/${userId}/badges`)
      .set(adminHeaders)
      .send({});

    const request = await prisma.badgeRequest.findUnique({
      where: { id: created.body.data.id },
    });
    expect(request?.status).toBe("approved");
    expect(request?.reviewNote).toContain("direct grant");
  });

  it("forbids non-staff from admin queue", async () => {
    const res = await testApp.get(ADMIN_REQ).set(userHeaders);
    expect(res.status).toBe(403);
  });
});
