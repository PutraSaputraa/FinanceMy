import assert from 'node:assert/strict'
import test from 'node:test'
import { getMessageId, resolveSenderPhone } from '../src/message-identity.js'

test('uses the serialized message ID when available', () => {
  assert.equal(getMessageId({ id: { _serialized: 'old-id' } }), 'old-id')
})

test('accepts the newer WhatsApp ID field and reconstructs an ID', () => {
  assert.equal(getMessageId({ id: { $1: 'new-id' } }), 'new-id')
  assert.equal(getMessageId({ id: {
    fromMe: false,
    remote: '12345@lid',
    id: '3A123',
  } }), 'false_12345@lid_3A123')
  assert.equal(getMessageId({ id: { remote: '12345@lid' } }), null)
})

test('resolves a LID only when WhatsApp confirms its phone mapping', async () => {
  const client = {
    getContactLidAndPhone: async () => [
      { lid: 'other@lid', pn: '628111111111@c.us' },
      { lid: '12345@lid', pn: '628222222222@c.us' },
    ],
  }
  assert.equal(await resolveSenderPhone(client, '12345@lid'), '628222222222')
  assert.equal(await resolveSenderPhone(client, '628333333333@c.us'), '628333333333')
  assert.equal(await resolveSenderPhone(client, 'unknown@g.us'), null)
  assert.equal(await resolveSenderPhone({ getContactLidAndPhone: async () => [] }, '12345@lid'), null)
})
