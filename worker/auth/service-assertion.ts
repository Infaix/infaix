import { importPKCS8, SignJWT } from "jose";
import {
  CHAT_HANDOFF_ALGORITHM,
  CHAT_HANDOFF_ISSUER,
  CHAT_HANDOFF_TTL_SEC,
  CHAT_HANDOFF_TYPE,
} from "./chat-handoff-contract";
import { newId } from "./crypto";
import type { UserRow } from "./types";

export const SERVICE_ASSERTION_ISSUER = CHAT_HANDOFF_ISSUER;
export const SERVICE_ASSERTION_TTL_SEC = CHAT_HANDOFF_TTL_SEC;

export async function mintServiceAssertion(
  privateKeyPem: string,
  audience: string,
  user: Pick<UserRow, "id" | "status">
): Promise<string> {
  if (user.status !== "ACTIVE") throw new Error("INACTIVE_IDENTITY");
  const key = await importPKCS8(privateKeyPem, CHAT_HANDOFF_ALGORITHM);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: CHAT_HANDOFF_ALGORITHM, typ: CHAT_HANDOFF_TYPE })
    .setIssuer(SERVICE_ASSERTION_ISSUER)
    .setAudience(audience)
    .setSubject(user.id)
    .setIssuedAt(now)
    .setJti(newId("jti"))
    .setExpirationTime(now + SERVICE_ASSERTION_TTL_SEC)
    .sign(key);
}
