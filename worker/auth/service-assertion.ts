import { importPKCS8, SignJWT } from "jose";
import { newId } from "./crypto";
import type { UserRow } from "./types";

export const SERVICE_ASSERTION_ISSUER = "infaix-core";
export const SERVICE_ASSERTION_TTL_SEC = 90;

export async function mintServiceAssertion(
  privateKeyPem: string,
  audience: string,
  user: Pick<UserRow, "id" | "status">
): Promise<string> {
  if (user.status !== "ACTIVE") throw new Error("INACTIVE_IDENTITY");
  const key = await importPKCS8(privateKeyPem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(SERVICE_ASSERTION_ISSUER)
    .setAudience(audience)
    .setSubject(user.id)
    .setIssuedAt(now)
    .setJti(newId("jti"))
    .setExpirationTime(now + SERVICE_ASSERTION_TTL_SEC)
    .sign(key);
}
