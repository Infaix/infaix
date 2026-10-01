import { describe, expect, it } from "vitest";
import { exportPKCS8, exportSPKI, generateKeyPair, SignJWT } from "jose";
import {
  mintServiceAssertion,
  SERVICE_ASSERTION_ISSUER,
  SERVICE_ASSERTION_TTL_SEC,
} from "../worker/auth/service-assertion";
import { verifyServiceAssertion } from "../../chat/src/server/auth/service-assertion";

const AUDIENCE = "infaix-chat";
const TEST_NOW = Math.floor(Date.now() / 1000);

async function makePair() {
  const pair = await generateKeyPair("RS256", { extractable: true });
  return {
    privateKey: pair.privateKey,
    privatePem: await exportPKCS8(pair.privateKey),
    publicPem: await exportSPKI(pair.publicKey),
  };
}

describe("deployed Core-to-Chat assertion contract", () => {
  it("accepts the assertion created by Core's signer in Chat's verifier", async () => {
    const pair = await makePair();
    const token = await mintServiceAssertion(pair.privatePem, AUDIENCE, {
      id: "usr_ephemeral_test",
      status: "ACTIVE",
    });

    const claims = await verifyServiceAssertion(token, pair.publicPem);
    expect(claims.iss).toBe(SERVICE_ASSERTION_ISSUER);
    expect(claims.aud).toBe(AUDIENCE);
    expect(claims.sub).toBe("usr_ephemeral_test");
    expect(typeof claims.jti).toBe("string");
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(SERVICE_ASSERTION_TTL_SEC);
  });

  it("rejects a Core-signed assertion under a different Chat public key", async () => {
    const corePair = await makePair();
    const otherPair = await makePair();
    const token = await mintServiceAssertion(corePair.privatePem, AUDIENCE, {
      id: "usr_ephemeral_test",
      status: "ACTIVE",
    });
    await expect(verifyServiceAssertion(token, otherPair.publicPem)).rejects.toMatchObject({
      reasonCode: "HANDOFF_SIGNATURE_INVALID",
    });
  });

  it("rejects wrong issuer and audience claims", async () => {
    const pair = await makePair();
    const wrongIssuer = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer("not-infaix-core")
      .setAudience(AUDIENCE)
      .setSubject("usr_ephemeral_test")
      .setIssuedAt(TEST_NOW)
      .setJti("jti_ephemeral_wrong_issuer")
      .setExpirationTime(TEST_NOW + SERVICE_ASSERTION_TTL_SEC)
      .sign(pair.privateKey);
    const wrongAudience = await mintServiceAssertion(pair.privatePem, "not-infaix-chat", {
      id: "usr_ephemeral_test",
      status: "ACTIVE",
    });

    await expect(verifyServiceAssertion(wrongIssuer, pair.publicPem)).rejects.toMatchObject({
      reasonCode: "HANDOFF_ISSUER_INVALID",
    });
    await expect(verifyServiceAssertion(wrongAudience, pair.publicPem)).rejects.toMatchObject({
      reasonCode: "HANDOFF_AUDIENCE_INVALID",
    });
  });

  it("rejects expired and malformed assertions", async () => {
    const pair = await makePair();
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(SERVICE_ASSERTION_ISSUER)
      .setAudience(AUDIENCE)
      .setSubject("usr_ephemeral_test")
      .setIssuedAt(TEST_NOW - 30)
      .setJti("jti_ephemeral_expired")
      .setExpirationTime(TEST_NOW - 10)
      .sign(pair.privateKey);

    await expect(verifyServiceAssertion(expired, pair.publicPem, new Date(TEST_NOW * 1000))).rejects.toMatchObject({
      reasonCode: "HANDOFF_EXPIRED",
    });
    await expect(verifyServiceAssertion("not.a.jwt", pair.publicPem)).rejects.toMatchObject({
      reasonCode: "HANDOFF_ASSERTION_INVALID",
    });
    await expect(verifyServiceAssertion(expired, "not a PEM")).rejects.toMatchObject({
      reasonCode: "HANDOFF_KEY_IMPORT_FAILED",
    });
  });
});
