import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createMediaStore, MAX_RECEIPT_BYTES } from '../src/media-store.js'

test('stores receipt images privately and removes them after use', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financemy-wa-media-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const store = createMediaStore(directory)
  const reference = store.save('message-1', { mimetype: 'image/jpeg', data: Buffer.from('receipt').toString('base64') })
  assert.equal(reference.mimeType, 'image/jpeg')
  assert.equal(store.read(reference).data, Buffer.from('receipt').toString('base64'))
  const target = path.join(directory, 'receipt-media', reference.key)
  if (process.platform !== 'win32') assert.equal(fs.statSync(target).mode & 0o777, 0o600)
  store.remove(reference)
  assert.equal(fs.existsSync(target), false)
})

test('rejects unsupported and oversized receipt images', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financemy-wa-media-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const store = createMediaStore(directory)
  assert.throws(() => store.save('bad', { mimetype: 'application/pdf', data: 'YQ==' }), /JPEG/)
  assert.throws(() => store.save('large', { mimetype: 'image/png', data: Buffer.alloc(MAX_RECEIPT_BYTES + 1).toString('base64') }), /maksimal 4 MB/)
  assert.throws(() => store.read({ key: '../secret.jpg' }), /tidak valid/)
})
