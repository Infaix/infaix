/**
 * The version strings shown wherever a person is asked to accept the terms.
 *
 * Kept in their own module because they are needed by client components: the
 * signup form must name the exact text it is asking about without pulling the
 * whole policy body into the browser bundle. `tests/legal-content.test.ts`
 * asserts these match the documents themselves, so they cannot drift.
 */

export const TERMS_VERSION = "terms-2026-10-03";
export const PRIVACY_VERSION = "privacy-2026-10-03";