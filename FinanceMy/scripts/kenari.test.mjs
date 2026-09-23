import assert from 'node:assert/strict'
import test from 'node:test'
import { kenariCompletion } from '../netlify/functions/_lib/kenari.mjs'

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

test('uses the configured Kenari model when it is healthy', async () => {
  const requestedModels = []
  const content = await kenariCompletion([{ role: 'user', content: 'Hai' }], {
    apiKey: 'test-key',
    model: 'FinanceMy',
    fallbackModel: 'kenari-free',
    fetchImpl: async (_url, options) => {
      requestedModels.push(JSON.parse(options.body).model)
      return response(200, { choices: [{ message: { content: 'Halo' } }] })
    },
  })

  assert.equal(content, 'Halo')
  assert.deepEqual(requestedModels, ['FinanceMy'])
})

test('falls back when the configured Kenari route returns 503', async () => {
  const requestedModels = []
  const content = await kenariCompletion([{ role: 'user', content: 'Hai' }], {
    apiKey: 'test-key',
    model: 'FinanceMy',
    fallbackModel: 'kenari-free',
    fetchImpl: async (_url, options) => {
      const requestedModel = JSON.parse(options.body).model
      requestedModels.push(requestedModel)
      if (requestedModel === 'FinanceMy') {
        return response(503, { error: { code: 'all_providers_failed' } })
      }
      return response(200, { choices: [{ message: { content: 'Halo dari cadangan' } }] })
    },
  })

  assert.equal(content, 'Halo dari cadangan')
  assert.deepEqual(requestedModels, ['FinanceMy', 'kenari-free'])
})

test('does not hide a non-retryable Kenari error', async () => {
  let calls = 0
  await assert.rejects(
    kenariCompletion([{ role: 'user', content: 'Hai' }], {
      apiKey: 'test-key',
      model: 'FinanceMy',
      fallbackModel: 'kenari-free',
      fetchImpl: async () => {
        calls += 1
        return response(400, { error: { code: 'invalid_request_error' } })
      },
    }),
    /Kenari HTTP 400 \(invalid_request_error\)/,
  )
  assert.equal(calls, 1)
})
