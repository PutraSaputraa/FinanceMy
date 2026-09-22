import assert from 'node:assert/strict'
import test from 'node:test'
import { createPairingCode, hashPairingCode, matchesConnectorKey, validPairingCode, validPhone, validSenderId } from '../netlify/functions/_lib/whatsapp-pairing.mjs'

test('pairing codes are well formed and different', () => {
  const codes = new Set(Array.from({ length: 100 }, createPairingCode))
  assert.equal(codes.size, 100)
  for (const code of codes) assert.equal(validPairingCode(code), true)
  assert.equal(validPairingCode('FM-ABCD0FGH'), false)
  assert.equal(validPairingCode('FM-ABCDEFGH extra'), false)
})

test('code hashes and connector keys are checked exactly', () => {
  assert.equal(hashPairingCode('FM-ABCDEFGH'), hashPairingCode('FM-ABCDEFGH'))
  assert.notEqual(hashPairingCode('FM-ABCDEFGH'), hashPairingCode('FM-ABCDEFGJ'))
  assert.equal(matchesConnectorKey('long-secret', 'long-secret'), true)
  assert.equal(matchesConnectorKey('long-secret', 'long-secrex'), false)
  assert.equal(matchesConnectorKey('short', 'long-secret'), false)
})

test('sender and phone values have WhatsApp ID shapes', () => {
  assert.equal(validSenderId('123456789@lid'), true)
  assert.equal(validSenderId('123456789@c.us'), true)
  assert.equal(validSenderId('bad/path@lid'), false)
  assert.equal(validPhone('628123456789'), true)
  assert.equal(validPhone(null), true)
  assert.equal(validPhone('62812@c.us'), false)
})
