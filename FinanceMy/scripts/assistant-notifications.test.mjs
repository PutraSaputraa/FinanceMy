import assert from 'node:assert/strict'
import test from 'node:test'
import { notificationQueue } from '../netlify/functions/_lib/assistant-notifications.mjs'

// A transaction double exercises queue state transitions without real messages or credentials.
function database() {
  const rows = new Map()
  const reads = []
  const snapshot = (ref) => ({ id: ref.id, exists: rows.has(ref.path), data: () => rows.get(ref.path) })
  const db = {
    doc: (path) => ({ path, id: path.split('/').at(-1), get: async () => snapshot(db.doc(path)) }),
    collection: (path) => {
      let size = Infinity, cursor = null
      const query = {
        orderBy: () => query,
        limit: (value) => { size = value; return query },
        startAfter: (value) => { cursor = value; return query },
        get: async () => {
          reads.push(path)
          const keys = [...rows.keys()].filter((key) => key.startsWith(`${path}/`) && key.slice(path.length + 1).split('/').length === 1).sort()
          return { docs: keys.map((key) => snapshot(db.doc(key))).filter((item) => !cursor || item.id > cursor).slice(0, size) }
        },
      }
      return query
    },
    runTransaction: async (callback) => callback({ get: async (ref) => snapshot(ref), set: (ref, value) => rows.set(ref.path, value), update: (ref, value) => rows.set(ref.path, { ...rows.get(ref.path), ...value }) }),
  }
  rows.set('users/user-a', { status: 'active' })
  rows.set('waConnections/user-a', { senderId: '62812345678@c.us' })
  rows.set('users/user-a/settings/assistant', { monthlyReport: true, recurringReminder: true, reminderDays: 7 })
  rows.set('users/user-a/recurringTransactions/rent', { name: 'Kos', amount: 100, nextDate: '2026-10-08', type: 'Tagihan' })
  return { rows, reads, queue: notificationQueue(db) }
}
const candidate = { key: 'monthly_2026-09', kind: 'monthly', period: '2026-09', text: 'Laporan September' }
const now = new Date('2026-10-01T02:00:00Z')

test('leases prevent duplicate claims; expired claim can retry; ACK is authenticated and idempotent', async () => {
  const { rows, queue } = database()
  const first = await queue.claim('user-a', '62812345678@c.us', candidate, {}, now)
  assert.ok(first)
  assert.equal(await queue.claim('user-a', '62812345678@c.us', candidate, {}, now), null)
  assert.equal(await queue.acknowledge(first.id, 'wrong-token', now), false)
  const retry = await queue.claim('user-a', '62812345678@c.us', candidate, {}, new Date(now.getTime() + 301_000))
  assert.equal(retry.id, first.id)
  assert.notEqual(retry.leaseToken, first.leaseToken)
  assert.equal(await queue.acknowledge(first.id, first.leaseToken, now), false)
  assert.equal(await queue.acknowledge(retry.id, retry.leaseToken, now), true)
  assert.equal(await queue.acknowledge(retry.id, retry.leaseToken, now), true)
  assert.equal(await queue.claim('user-a', '62812345678@c.us', candidate, {}, new Date(now.getTime() + 600_000)), null)
  assert.equal(rows.get('waReportContexts/user-a').period, '2026-09')
  assert.equal(rows.get('waReportContexts/user-b'), undefined)
})

test('disabled users, disconnected or reassigned chats, opt-outs and paid/deleted schedules cannot be claimed', async () => {
  for (const mutation of [
    (rows) => rows.set('users/user-a', { status: 'disabled' }),
    (rows) => rows.delete('waConnections/user-a'),
    (rows) => rows.set('waConnections/user-a', { senderId: '62899999999@c.us' }),
    (rows) => rows.set('users/user-a/settings/assistant', { monthlyReport: false }),
  ]) {
    const { rows, queue } = database(); mutation(rows)
    assert.equal(await queue.claim('user-a', '62812345678@c.us', candidate, {}, now), null)
  }
  const recurring = { key: 'recurring_rent_2026-10-08', kind: 'recurring', recurringId: 'rent', dueDate: '2026-10-08', text: 'Pengingat kos' }
  for (const mutation of [
    (rows) => rows.delete('users/user-a/recurringTransactions/rent'),
    (rows) => rows.set('users/user-a/recurringTransactions/rent', { name: 'Kos', amount: 100, nextDate: '2026-11-08' }),
    (rows) => rows.set('users/user-a/settings/assistant', { recurringReminder: false }),
  ]) {
    const { rows, queue } = database(); mutation(rows)
    assert.equal(await queue.claim('user-a', '62812345678@c.us', recurring, { reminderDays: 7 }, now), null)
  }
  const { queue } = database()
  assert.ok(await queue.claim('user-a', '62812345678@c.us', recurring, { reminderDays: 7 }, now))
})

test('poll paginates connected users and skips transaction reads after reports are delivered', async () => {
  const { rows, reads, queue } = database()
  rows.clear()
  for (let index = 0; index < 12; index++) {
    const uid = `user-${String(index).padStart(2, '0')}`
    rows.set(`users/${uid}`, { status: 'active' })
    rows.set(`waConnections/${uid}`, { senderId: `628123456${String(index).padStart(2, '0')}@c.us` })
    rows.set(`users/${uid}/settings/assistant`, { monthlyReport: true })
    rows.set(`users/${uid}/transactions/salary`, { type: 'income', amount: 5000000, date: '2026-09-15' })
  }
  const first = await queue.poll({ now })
  assert.equal(first.items.length, 10)
  assert.equal(first.cursor, 'user-09')
  const second = await queue.poll({ cursor: first.cursor, now })
  assert.equal(second.items.length, 2)
  assert.equal(second.cursor, null)
  for (const item of [...first.items, ...second.items]) await queue.acknowledge(item.id, item.leaseToken, now)
  reads.length = 0
  const repeated = await queue.poll({ now })
  assert.equal(repeated.items.length, 0)
  assert.ok(!reads.some((path) => path.endsWith('/transactions')))
  reads.length = 0
  assert.deepEqual(await queue.poll({ now: new Date('2026-10-01T01:00:00Z') }), { items: [], cursor: null })
  assert.deepEqual(reads, [])
})
