import assert from 'node:assert/strict'
import test from 'node:test'
import { goalProgress, goalSavedAmount, linkedGoalAccount } from '../src/utils/goals.js'

const accounts = [
  { id: 'bsi', name: 'BSI', currentBalance: 4_000_000 },
  { id: 'blu', name: 'Blu', currentBalance: 2_500_000, isActive: false },
]

test('a linked goal follows the current account balance', () => {
  const goal = { accountId: 'bsi', target: 20_000_000, saved: 900_000 }
  assert.equal(linkedGoalAccount(goal, accounts)?.name, 'BSI')
  assert.equal(goalSavedAmount(goal, accounts), 4_000_000)
  assert.equal(goalProgress(goal, accounts), 20)
})

test('legacy goals retain their old progress until an account is selected', () => {
  const goal = { target: 10_000_000, saved: 3_000_000 }
  assert.equal(linkedGoalAccount(goal, accounts), null)
  assert.equal(goalSavedAmount(goal, accounts), 3_000_000)
  assert.equal(goalProgress(goal, accounts), 30)
})

test('a deactivated linked account still supplies the target balance', () => {
  assert.equal(goalSavedAmount({ accountId: 'blu', saved: 0 }, accounts), 2_500_000)
})
