import { describe, expect, it } from "vitest";
import env from "@/env";
import { signPrivateDocumentUrl } from "@/shared/utils/cloudinary";

const base = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image`;

describe("signPrivateDocumentUrl", () => {
  it("turns an authenticated asset URL into a signed, expiring download link", () => {
    const signed = signPrivateDocumentUrl(
      `${base}/authenticated/v1712345/badge-id-documents/abc123.pdf`
    );
    const url = new URL(signed);
    expect(url.pathname).toContain("/image/download");
    expect(url.searchParams.get("public_id")).toBe("badge-id-documents/abc123");
    expect(url.searchParams.get("format")).toBe("pdf");
    expect(url.searchParams.get("type")).toBe("authenticated");
    expect(url.searchParams.get("signature")).toBeTruthy();
    expect(Number(url.searchParams.get("expires_at"))).toBeGreaterThan(
      Math.floor(Date.now() / 1000)
    );
  });

  it("ignores a signature segment in the stored URL", () => {
    const signed = signPrivateDocumentUrl(
      `${base}/authenticated/s--AbC123xy--/v1712345/badge-id-documents/abc123.jpg`
    );
    expect(new URL(signed).searchParams.get("public_id")).toBe(
      "badge-id-documents/abc123"
    );
  });

  it.each([
    `${base}/upload/v1/badge-id-documents/old.webp`,
    "https://cdn.example.com/id.webp",
    "not a url",
  ])("leaves %s unchanged", (value) => {
    expect(signPrivateDocumentUrl(value)).toBe(value);
  });
});
