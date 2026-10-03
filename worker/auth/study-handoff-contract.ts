// Core → Study identity handoff contract.
//
// Study verifies this in its own repository and must not import from here:
// production builds clone Core alone. Values are restated (not re-derived) so
// the contract is readable on both sides of the boundary.

import { HANDOFF_ALGORITHM, HANDOFF_TTL_SEC } from "./handoff-contract";

export const STUDY_HANDOFF_ALGORITHM = HANDOFF_ALGORITHM;
export const STUDY_HANDOFF_ISSUER = "infaix-core";
export const STUDY_HANDOFF_AUDIENCE = "infaix-study";
export const STUDY_HANDOFF_TTL_SEC = HANDOFF_TTL_SEC;

/** Where Core sends a Study assertion when the caller omits `return_to`. */
export const STUDY_HANDOFF_CALLBACK_PATH = "/api/auth/core/callback";
