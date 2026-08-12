// Shared error vocabulary. Kept out of the "use server" modules, which may
// only export async functions.

/** A failure reported by the n8n booking backend. */
export class BackendError extends Error {}

/** A failure loading data from Supabase. */
export class DataError extends Error {}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const GENERIC_ERROR = "Se produjo un error. Inténtalo de nuevo.";

/**
 * Maps internal failures to messages safe to show restaurant staff. Anything
 * unrecognised becomes the generic message, so SQL text, Supabase internals,
 * n8n internals and stack traces never reach the interface.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof BackendError || error instanceof DataError) {
    return error.message;
  }
  return GENERIC_ERROR;
}
