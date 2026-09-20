import assert from 'node:assert/strict'
import test from 'node:test'
import { balanceChanges } from '../src/utils/transactionBalances.js'

test('editing an expense moves its full balance effect between accounts', () => {
  const previous = { type: 'expense', accountId: 'cash', amount: 50000 }
  const next = { type: 'expense', accountId: 'bank', amount: 70000 }
  assert.deepEqual(balanceChanges(previous, next).map(({ accountId, delta }) => [accountId, delta]), [
    ['cash', 50000], ['bank', -70000],
  ])
})

test('editing a transfer reverses the old fee and destination', () => {
  const previous = { type: 'transfer', accountId: 'bank', destinationAccountId: 'wallet', amount: 100000, adminFee: 2500 }
  const next = { type: 'transfer', accountId: 'bank', destinationAccountId: 'cash', amount: 80000, adminFee: 1000 }
  assert.deepEqual(balanceChanges(previous, next).map(({ accountId, delta }) => [accountId, delta]), [
    ['bank', 21500], ['wallet', -100000], ['cash', 80000],
  ])
})

test('deleting income, refund, and adjustment restores their balance effects', () => {
  assert.equal(balanceChanges({ type: 'income', accountId: 'bank', amount: 10000 }, null)[0].delta, -10000)
  assert.equal(balanceChanges({ type: 'refund', accountId: 'bank', amount: 10000 }, null)[0].delta, -10000)
  assert.equal(balanceChanges({ type: 'adjustment', accountId: 'bank', amount: 10000, adjustmentDelta: -10000 }, null)[0].delta, 10000)
})
