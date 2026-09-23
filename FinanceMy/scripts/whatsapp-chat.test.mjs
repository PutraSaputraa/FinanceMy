import assert from 'node:assert/strict'
import test from 'node:test'
import { chatCommand, chatTransactionValues, draftConfirmation, simpleRevision } from '../netlify/functions/_lib/whatsapp-chat.mjs'

const parsed = { type: 'expense', title: 'Makan siang', amount: 25000, category: 'Makan & Minum', date: '2026-09-22', accountHint: 'BCA', budgetHint: '' }
const accounts = [{ id: 'a1', name: 'Bank BCA', isActive: true }, { id: 'a2', name: 'Tunai', isActive: true }]

test('recognizes chat approval, revision, and cancellation commands', () => {
  assert.deepEqual(chatCommand(' Submit '), { kind: 'submit' })
  assert.deepEqual(chatCommand('REVISI akun Tunai'), { kind: 'revise', text: 'akun Tunai' })
  assert.deepEqual(chatCommand('batal'), { kind: 'cancel' })
  assert.deepEqual(chatCommand('makan 25000'), { kind: 'other' })
})

test('never submits when account is ambiguous or amount is missing', () => {
  assert.match(chatTransactionValues({ ...parsed, accountHint: '' }, accounts, [], '12:00').error, /AKUN/)
  assert.match(chatTransactionValues({ ...parsed, amount: null }, accounts, [], '12:00').error, /nominal/)
})

test('matches a unique account and formats the confirmation', () => {
  const result = chatTransactionValues(parsed, accounts, [], '12:00')
  assert.equal(result.values.accountId, 'a1')
  assert.equal(result.values.amount, 25000)
  assert.match(draftConfirmation(parsed, accounts, []), /Bank BCA/)
  assert.match(draftConfirmation(parsed, accounts, []), /SUBMIT/)
  assert.match(draftConfirmation(parsed, accounts, []), /22 September 2026/)
  assert.match(draftConfirmation(parsed, accounts, []), /\n\n/)
})

test('revises common fields without changing the rest of the draft', () => {
  assert.equal(simpleRevision(parsed, 'akun Tunai').accountHint, 'Tunai')
  assert.equal(simpleRevision(parsed, 'nominal Rp30.000').amount, 30000)
  assert.equal(simpleRevision(parsed, 'nominal 30 ribu').amount, 30000)
  assert.equal(simpleRevision({ ...parsed, budgetHint: 'Jajan' }, 'tanpa budget').budgetHint, '')
  assert.equal(simpleRevision(parsed, 'tanggal 2026-02-30'), null)
})
