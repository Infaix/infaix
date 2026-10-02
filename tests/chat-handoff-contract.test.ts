import { describe, expect, it } from "vitest";
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import {
  CHAT_HANDOFF_ALGORITHM,
  CHAT_HANDOFF_AUDIENCE,
  CHAT_HANDOFF_CLAIMS,
  CHAT_HANDOFF_FAILURE_CODES,
  CHAT_HANDOFF_ISSUER,
  CHAT_HANDOFF_TTL_SEC,
  CHAT_HANDOFF_TYPE,
} from "../worker/auth/chat-handoff-contract";
import { mintServiceAssertion, SERVICE_ASSERTION_ISSUER, SERVICE_ASSERTION_TTL_SEC } from "../worker/auth/service-assertion";

async function privatePem() {
  const { privateKey, publicKey } = await generateKeyPair(CHAT_HANDOFF_ALGORITHM, { extractable: true });
  return { privateKey, publicKey, pem: await exportPKCS8(privateKey) };
}

describe("Core side of the Chat handoff contract", () => {
  it("mints only the claims Chat is specified to accept", async () => {
    const keys = await privatePem();
    const token = await mintServiceAssertion(keys.pem, CHAT_HANDOFF_AUDIENCE, {
      id: "usr_ephemeral_test",
      status: "ACTIVE",
    });

    expect(decodeProtectedHeader(token)).toMatchObject({
      alg: CHAT_HANDOFF_ALGORITHM,
      typ: CHAT_HANDOFF_TYPE,
    });
    const verified = await jwtVerify(token, keys.publicKey, {
      algorithms: [CHAT_HANDOFF_ALGORITHM],
      issuer: CHAT_HANDOFF_ISSUER,
      audience: CHAT_HANDOFF_AUDIENCE,
    });
    expect(verified.payload.iss).toBe(SERVICE_ASSERTION_ISSUER);
    expect(verified.payload.aud).toBe(CHAT_HANDOFF_AUDIENCE);
    expect(verified.payload.sub).toBe("usr_ephemeral_test");
    expect(typeof verified.payload.jti).toBe("string");
    expect(verified.payload.jti?.length).toBeGreaterThan(0);
    expect((verified.payload.exp ?? 0) - (verified.payload.iat ?? 0)).toBe(SERVICE_ASSERTION_TTL_SEC);
    expect(SERVICE_ASSERTION_TTL_SEC).toBe(CHAT_HANDOFF_TTL_SEC);
    expect(Object.keys(decodeJwt(token)).sort()).toEqual([...CHAT_HANDOFF_CLAIMS].sort());
    expect(JSON.stringify(decodeJwt(token))).not.toMatch(/password|session|reset|email/i);
  });

  it("binds the audience it was asked to mint, so a non-Chat audience will not satisfy Chat", async () => {
    const keys = await privatePem();
    const token = await mintServiceAssertion(keys.pem, "not-infaix-chat", {
      id: "usr_ephemeral_test",
      status: "ACTIVE",
    });
    await expect(
      jwtVerify(token, keys.publicKey, {
        algorithms: [CHAT_HANDOFF_ALGORITHM],
        issuer: CHAT_HANDOFF_ISSUER,
        audience: CHAT_HANDOFF_AUDIENCE,
      }),
    ).rejects.toThrow();
    expect(decodeJwt(token).aud).toBe("not-infaix-chat");
  });

  it("refuses inactive identities", async () => {
    const keys = await privatePem();
    await expect(
      mintServiceAssertion(keys.pem, CHAT_HANDOFF_AUDIENCE, { id: "usr_disabled", status: "DISABLED" }),
    ).rejects.toThrow("INACTIVE_IDENTITY");
  });

  it("names the failure codes Chat's verifier is required to report", () => {
    expect([...CHAT_HANDOFF_FAILURE_CODES]).toEqual([
      "HANDOFF_KEY_IMPORT_FAILED",
      "HANDOFF_SIGNATURE_INVALID",
      "HANDOFF_ISSUER_INVALID",
      "HANDOFF_AUDIENCE_INVALID",
      "HANDOFF_EXPIRED",
      "HANDOFF_SUBJECT_INVALID",
      "HANDOFF_JTI_INVALID",
      "HANDOFF_ASSERTION_INVALID",
    ]);
  });
});
