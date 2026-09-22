import assert from 'node:assert/strict'
import test from 'node:test'
import { parseWhatsAppDraft } from '../netlify/functions/_lib/whatsapp-draft.mjs'

test('parses a financial message into a reviewable draft', () => {
  assert.deepEqual(parseWhatsAppDraft('{"kind":"transaction","type":"expense","title":"Makan siang","amount":25000,"category":"Makan & Minum","date":"2026-09-22","accountHint":"BCA"}', '2026-09-22'), {
    status: 'draft',
    parsed: { type: 'expense', title: 'Makan siang', amount: 25000, category: 'Makan & Minum', date: '2026-09-22', accountHint: 'BCA', budgetHint: '' },
  })
})

test('ignores messages classified as non-transactions', () => {
  assert.deepEqual(parseWhatsAppDraft('{"kind":"ignore"}', '2026-09-22'), { status: 'ignored', parsed: null })
})

test('leaves uncertain fields for manual review', () => {
  const result = parseWhatsAppDraft('{"kind":"transaction","type":"expense","title":"Belanja","amount":null,"category":"unknown","date":"2026-02-30"}', '2026-09-22')
  assert.equal(result.status, 'draft')
  assert.equal(result.parsed.amount, null)
  assert.equal(result.parsed.category, 'Pengeluaran Lainnya')
  assert.equal(result.parsed.date, '2026-09-22')
})
