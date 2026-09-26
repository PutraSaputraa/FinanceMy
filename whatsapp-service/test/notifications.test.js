import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createNotifications } from '../src/notifications.js'

test('sent notification is not resent after failed ACK or service restart', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financemy-notifications-'))
  t.after(() => { assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir())); fs.rmSync(directory, { recursive: true, force: true }) })
  let sends = 0, acknowledgments = 0
  const item = { id: 'a'.repeat(64), leaseToken: 'lease-1', senderId: '62812345678@c.us', text: 'Laporan September' }
  const fetchRequest = async (_url, options) => {
    const body = JSON.parse(options.body)
    assert.equal(options.headers['x-financemy-connector-key'], 'test-key')
    if (body.action === 'ack') { acknowledgments++; return { ok: acknowledgments > 1, status: 503, json: async () => ({ acknowledged: true }) } }
    return { ok: true, json: async () => ({ items: [item], cursor: null }) }
  }
  const options = { endpoint: 'https://example.test/whatsapp-notifications', key: 'test-key', fetchRequest }
  let connector = createNotifications(directory, async () => { sends++ }, options)
  await connector.flush()
  connector.stop()
  connector = createNotifications(directory, async () => { sends++ }, options)
  await connector.flush()
  connector.stop()
  assert.equal(sends, 1)
  assert.equal(acknowledgments, 2)
})

test('failed WhatsApp send is not acknowledged, is retried, and malformed recipients are skipped', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financemy-notifications-'))
  t.after(() => { assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir())); fs.rmSync(directory, { recursive: true, force: true }) })
  let sends = 0, acks = 0
  const item = { id: 'b'.repeat(64), leaseToken: 'lease', senderId: '62812345678@c.us', text: 'Kos H-7' }
  const connector = createNotifications(directory, async () => { sends++; if (sends === 1) throw new Error('Offline') }, {
    endpoint: 'https://example.test/notifications', key: 'test-key',
    fetchRequest: async (_url, options) => {
      const body = JSON.parse(options.body)
      if (body.action === 'ack') { acks++; return { ok: true, json: async () => ({ acknowledged: true }) } }
      return { ok: true, json: async () => ({ items: [item, { ...item, id: 'c'.repeat(64), senderId: 'group@g.us' }] }) }
    },
  })
  await connector.flush()
  assert.equal(acks, 0)
  await connector.flush()
  connector.stop()
  assert.equal(sends, 2)
  assert.equal(acks, 1)
})
