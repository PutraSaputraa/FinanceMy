import assert from 'node:assert/strict'
import test from 'node:test'
import { receiptMedia, MAX_RECEIPT_BYTES } from '../netlify/functions/_lib/whatsapp-receipt.mjs'
import { draftConfirmation } from '../netlify/functions/_lib/whatsapp-chat.mjs'

test('accepts supported receipt images within the Netlify payload limit', () => {
  const data = Buffer.from('receipt').toString('base64')
  assert.deepEqual(receiptMedia({ mimeType: 'image/jpeg', data }), {
    mimeType: 'image/jpeg', data, filename: 'struk.jpg', size: 7,
  })
  assert.equal(receiptMedia({ mimeType: 'application/pdf', data }), null)
  assert.equal(receiptMedia({ mimeType: 'image/png', data: Buffer.alloc(MAX_RECEIPT_BYTES + 1).toString('base64') }), null)
  assert.equal(receiptMedia({ mimeType: 'image/png', data: 'not base64!' }), null)
})

test('receipt drafts remind the user to review OCR results', () => {
  const parsed = {
    type: 'expense', title: 'Toko Serba Ada', amount: 125000, category: 'Belanja',
    date: '2026-09-23', accountHint: 'BCA', budgetHint: '', receipt: true,
  }
  const reply = draftConfirmation(parsed, [{ id: 'a1', name: 'BCA', isActive: true }], [])
  assert.match(reply, /Hasil dibaca dari foto/)
  assert.match(reply, /Periksa kembali nominal/)
  assert.match(reply, /SUBMIT/)
})

