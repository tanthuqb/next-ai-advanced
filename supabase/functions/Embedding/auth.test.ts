import { assertEquals } from 'jsr:@std/assert@1'
import { checkFunctionSecret, INGEST_SECRET_HEADER } from './auth.ts'

const req = (secret?: string) =>
  new Request('http://localhost/Embedding', {
    method: 'POST',
    headers: secret === undefined ? {} : { [INGEST_SECRET_HEADER]: secret },
  })

Deno.test('fails closed when INGEST_SECRET is not configured', async () => {
  const r = await checkFunctionSecret(req('anything'), undefined)
  assertEquals(r.ok ? 0 : r.status, 503)
})

Deno.test('rejects a missing header', async () => {
  const r = await checkFunctionSecret(req(), 's3cret-value')
  assertEquals(r, { ok: false, status: 401, error: 'Unauthorized' })
})

Deno.test('rejects a wrong secret', async () => {
  const r = await checkFunctionSecret(req('s3cret-valuX'), 's3cret-value')
  assertEquals(r, { ok: false, status: 401, error: 'Unauthorized' })
})

Deno.test('accepts the right secret', async () => {
  const r = await checkFunctionSecret(req('s3cret-value'), 's3cret-value')
  assertEquals(r.ok, true)
})
