import { describe, it, expect } from "vitest";
import { testApp } from "../helpers/testApp";

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await testApp.get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
    });
    expect(res.body.timestamp).toBeTruthy();
  });
});
