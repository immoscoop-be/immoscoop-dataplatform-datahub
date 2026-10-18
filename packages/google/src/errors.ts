/**
 * An error with Google's own reason in it, such as an API that is not enabled, and for a bad request
 * which argument it refused; for the log.
 */
export async function googleApiError(what: string, response: Response): Promise<Error> {
  let reason = '';
  try {
    const body = (await response.json()) as {
      error?: { message?: string; details?: { fieldViolations?: { field?: string; description?: string }[] }[] };
    };
    const violations = (body.error?.details ?? [])
      .flatMap((detail) => detail.fieldViolations ?? [])
      .map((violation) => `${violation.field ?? '?'}: ${violation.description ?? ''}`);
    reason = [body.error?.message ?? '', ...violations].filter(Boolean).join(' · ');
  } catch {
    // No JSON: the status says enough.
  }
  return new Error(`${what}: ${response.status}${reason ? ` ${reason}` : ''}`);
}
