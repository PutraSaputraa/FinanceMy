import assert from 'node:assert/strict'
import test from 'node:test'
import { pairingCodeFromMessage } from '../src/pairing.js'

test('recognizes only a standalone pairing code in a direct text message', () => {
  assert.equal(pairingCodeFromMessage({ type: 'chat', body: ' fm-abcdefgh ' }), 'FM-ABCDEFGH')
  assert.equal(pairingCodeFromMessage({ type: 'chat', body: 'FM-ABCDEFGH beli kopi' }), null)
  assert.equal(pairingCodeFromMessage({ type: 'image', body: 'FM-ABCDEFGH' }), null)
  assert.equal(pairingCodeFromMessage({ type: 'chat', body: 'FM-ABCD0FGH' }), null)
})
