import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createInbox } from '../src/inbox.js'

test('stores a message once across restarts', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financemy-wa-test-'))
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    fs.rmSync(directory, { recursive: true, force: true })
  })

  let inbox = createInbox(directory)
  const message = { id: 'false_12345@lid_3A123', text: 'Tes 123' }
  assert.equal(inbox.append(message), true)
  assert.equal(inbox.append(message), false)
  inbox.close()

  inbox = createInbox(directory)
  assert.equal(inbox.count, 1)
  assert.equal(inbox.append(message), false)
  inbox.close()

  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'inbox.jsonl'), 'utf8').trim()), message)
})
