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
    return { ok: calls > 1, status: calls > 1 ? 200 : 503, json: async () => ({ reply: 'Draf siap. Balas SUBMIT.' }) }
  }
  const replies = []
  let delivery = createDelivery(inbox, directory, send, async (to, text) => { replies.push({ to, text }) })
  await delivery.flush()
  assert.equal(calls, 1)
  await delivery.flush()
  assert.equal(calls, 2)
  assert.deepEqual(replies, [{ to: '123456789@lid', text: 'Draf siap. Balas SUBMIT.' }])
  delivery.stop()
  inbox.close()

  const reopenedInbox = createInbox(directory)
  delivery = createDelivery(reopenedInbox, directory, send, async (to, text) => { replies.push({ to, text }) })
  await delivery.flush()
  assert.equal(calls, 2)
  assert.equal(replies.length, 1)
  delivery.stop()
  reopenedInbox.close()
})

test('delivers a receipt image and removes its temporary file', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financemy-wa-receipt-'))
  const previousEndpoint = process.env.WA_INGEST_ENDPOINT
  const previousKey = process.env.WA_CONNECTOR_KEY
  process.env.WA_INGEST_ENDPOINT = 'https://example.test/ingest'
  process.env.WA_CONNECTOR_KEY = 'test-key'
  t.after(() => {
    if (previousEndpoint === undefined) delete process.env.WA_INGEST_ENDPOINT
    else process.env.WA_INGEST_ENDPOINT = previousEndpoint
    if (previousKey === undefined) delete process.env.WA_CONNECTOR_KEY
    else process.env.WA_CONNECTOR_KEY = previousKey
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const inbox = createInbox(directory)
  const reference = { key: 'media-key', mimeType: 'image/jpeg', filename: 'struk.jpg', size: 7 }
  inbox.append({ id: 'receipt-1', senderId: '123@lid', phone: null, type: 'image', text: 'pakai BCA', media: reference })
  const removed = []
  const mediaStore = {
    read: (value) => ({ ...value, data: Buffer.from('receipt').toString('base64') }),
    remove: (value) => removed.push(value),
  }
  let requestBody
  const send = async (_url, options) => {
    requestBody = JSON.parse(options.body)
    return { ok: true, status: 200, json: async () => ({ reply: 'Draf foto siap.' }) }
  }
  const replies = []
  const delivery = createDelivery(inbox, directory, send, async (_to, text) => replies.push(text), mediaStore)
  await delivery.flush()
  assert.equal(requestBody.type, 'image')
  assert.equal(requestBody.media.mimeType, 'image/jpeg')
  assert.equal(requestBody.media.data, Buffer.from('receipt').toString('base64'))
  assert.deepEqual(replies, ['Draf foto siap.'])
  assert.deepEqual(removed, [reference])
  delivery.stop()
  inbox.close()
})

test('a failed receipt does not block later chat messages', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financemy-wa-fair-delivery-'))
  const previousEndpoint = process.env.WA_INGEST_ENDPOINT
  const previousKey = process.env.WA_CONNECTOR_KEY
  process.env.WA_INGEST_ENDPOINT = 'https://example.test/ingest'
  process.env.WA_CONNECTOR_KEY = 'test-key'
  t.after(() => {
    if (previousEndpoint === undefined) delete process.env.WA_INGEST_ENDPOINT
    else process.env.WA_INGEST_ENDPOINT = previousEndpoint
    if (previousKey === undefined) delete process.env.WA_CONNECTOR_KEY
    else process.env.WA_CONNECTOR_KEY = previousKey
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const inbox = createInbox(directory)
  const reference = { key: 'media-key', mimeType: 'image/jpeg', filename: 'struk.jpg', size: 7 }
  inbox.append({ id: 'receipt-failed', senderId: '123@lid', phone: null, type: 'image', text: '', media: reference })
  inbox.append({ id: 'chat-success', senderId: '123@lid', phone: null, type: 'chat', text: 'Hai' })
  const mediaStore = {
    read: (value) => ({ ...value, data: Buffer.from('receipt').toString('base64') }),
    remove: () => {},
  }
  const calls = []
  const send = async (_url, options) => {
    const body = JSON.parse(options.body)
    calls.push(body.id)
    if (body.type === 'image') return { ok: false, status: 503, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ reply: 'Halo juga.' }) }
  }
  const replies = []
  const delivery = createDelivery(inbox, directory, send, async (_to, text) => replies.push(text), mediaStore)

  await delivery.flush()

  assert.deepEqual(calls, ['receipt-failed', 'chat-success'])
  assert.deepEqual(replies, ['Halo juga.'])
  delivery.stop()
  inbox.close()
})
