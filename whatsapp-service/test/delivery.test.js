import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createInbox } from '../src/inbox.js'
import { createDelivery } from '../src/delivery.js'

test('retries a failed delivery and does not resend after restart', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financemy-wa-delivery-'))
  const previousEndpoint = process.env.WA_INGEST_ENDPOINT
  const previousKey = process.env.WA_CONNECTOR_KEY
  process.env.WA_INGEST_ENDPOINT = 'https://example.test/ingest'
  process.env.WA_CONNECTOR_KEY = 'test-key'
  t.after(() => {
    if (previousEndpoint === undefined) delete process.env.WA_INGEST_ENDPOINT
    else process.env.WA_INGEST_ENDPOINT = previousEndpoint
    if (previousKey === undefined) delete process.env.WA_CONNECTOR_KEY
    else process.env.WA_CONNECTOR_KEY = previousKey
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const inbox = createInbox(directory)
  inbox.append({ id: 'message-1', senderId: '123456789@lid', phone: null, type: 'chat', text: 'Makan siang 25000' })
  let calls = 0
  const send = async () => {
    calls += 1
    return { ok: calls > 1, status: calls > 1 ? 200 : 503 }
  }
  let delivery = createDelivery(inbox, directory, send)
  await delivery.flush()
  assert.equal(calls, 1)
  await delivery.flush()
  assert.equal(calls, 2)
  delivery.stop()
  inbox.close()

  const reopenedInbox = createInbox(directory)
  delivery = createDelivery(reopenedInbox, directory, send)
  await delivery.flush()
  assert.equal(calls, 2)
  delivery.stop()
  reopenedInbox.close()
})
