import { describe, expect, it } from "vitest";
import { exportSPKI, generateKeyPair, jwtVerify } from "jose";
import { mintServiceAssertion, SERVICE_ASSERTION_ISSUER, SERVICE_ASSERTION_TTL_SEC } from "../worker/auth/service-assertion";

describe("general service assertions", () => {
  it("mints an audience-bound assertion from the authenticated user only", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const privatePem = await (await import("jose")).exportPKCS8(privateKey);
    const token = await mintServiceAssertion(privatePem, "infaix-chat", { id: "usr_core", status: "ACTIVE" });
    const verified = await jwtVerify(token, publicKey, { issuer: SERVICE_ASSERTION_ISSUER, audience: "infaix-chat" });
    expect(verified.payload.sub).toBe("usr_core");
    expect(verified.payload.iss).toBe("infaix-core");
    expect(verified.payload.aud).toBe("infaix-chat");
    expect(typeof verified.payload.jti).toBe("string");
    expect((verified.payload.exp ?? 0) - (verified.payload.iat ?? 0)).toBe(SERVICE_ASSERTION_TTL_SEC);
    expect(token).not.toContain("password");
    expect(token).not.toContain("session");
    expect(token).not.toContain("reset");
    expect(await exportSPKI(publicKey)).toContain("BEGIN PUBLIC KEY");
  });

  it("refuses inactive identities and creates distinct JTIs", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const privatePem = await (await import("jose")).exportPKCS8(privateKey);
    await expect(mintServiceAssertion(privatePem, "infaix-chat", { id: "usr_disabled", status: "DISABLED" })).rejects.toThrow("INACTIVE_IDENTITY");
    const a = await mintServiceAssertion(privatePem, "infaix-chat", { id: "usr_core", status: "ACTIVE" });
    const b = await mintServiceAssertion(privatePem, "infaix-chat", { id: "usr_core", status: "ACTIVE" });
    expect(a).not.toBe(b);
  });
});
