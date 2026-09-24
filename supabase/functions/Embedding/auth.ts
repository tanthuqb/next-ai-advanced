// Shared-secret check for the Embedding function.
// The function is deployed with --no-verify-jwt and only the Next.js server calls it,
// so every request must carry `x-ingest-secret` matching the INGEST_SECRET function secret.

export const INGEST_SECRET_HEADER = 'x-ingest-secret'

export type SecretCheck = { ok: true } | { ok: false; status: 401 | 503; error: string }

const encoder = new TextEncoder()

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

async function constantTimeEquals(a: string, b: string) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)])
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

export async function checkFunctionSecret(
  req: Request,
  expected: string | undefined
): Promise<SecretCheck> {
  if (!expected) {
    // Fail closed: never run without a configured secret.
    return { ok: false, status: 503, error: 'INGEST_SECRET is not configured for this function' }
  }
  const provided = req.headers.get(INGEST_SECRET_HEADER)
  if (!provided || !(await constantTimeEquals(provided, expected))) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  return { ok: true }
}
