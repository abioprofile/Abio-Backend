import { describe, it, expect } from "vitest";
import { detectPlatform } from "@/modules/links/link.service";

describe("detectPlatform", () => {
  it("detects known social platforms (uppercase keys)", () => {
    expect(detectPlatform("https://github.com/abio")).toBe("GITHUB");
    expect(detectPlatform("https://twitter.com/abio")).toBe("TWITTER");
    expect(detectPlatform("https://x.com/abio")).toBe("TWITTER");
    expect(detectPlatform("https://instagram.com/abio")).toBe("INSTAGRAM");
    expect(detectPlatform("https://linkedin.com/in/abio")).toBe("LINKEDIN");
  });

  it("returns null for unknown URLs", () => {
    expect(detectPlatform("https://example.com/me")).toBeNull();
    expect(detectPlatform("https://not-a-social.site")).toBeNull();
  });
});
