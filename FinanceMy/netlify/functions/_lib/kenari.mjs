const DEFAULT_MODEL = 'step-3-7-flash:free'
const DEFAULT_FALLBACK_MODEL = 'kenari-free'

function errorCode(payload) {
  return payload?.error?.code || payload?.error?.type || payload?.code || ''
}

function retryableStatus(status) {
  return status === 402 || status === 429 || status >= 500
}

export async function kenariCompletion(messages, {
  apiKey = process.env.KENARI_API_KEY,
  model = process.env.KENARI_MODEL || DEFAULT_MODEL,
  fallbackModel = process.env.KENARI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  maxTokens = 300,
  plugins,
  timeoutMs = 25_000,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) throw new Error('KENARI_API_KEY belum dikonfigurasi')

  const models = [...new Set([model, fallbackModel].map((value) => value?.trim()).filter(Boolean))]
  const deadline = Date.now() + timeoutMs
  let lastError = null

  for (const [index, candidate] of models.entries()) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) break

    const result = await fetchImpl('https://kenari.id/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: candidate,
        stream: false,
        temperature: 0,
        max_tokens: maxTokens,
        messages,
        ...(plugins ? { plugins } : {}),
      }),
      signal: AbortSignal.timeout(remainingMs),
    })

    if (result.ok) {
      const data = await result.json()
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) throw new Error('Respons Kenari kosong')
      return content
    }

    let code = ''
    try { code = errorCode(await result.json()) } catch { /* Respons error dapat berupa teks. */ }
    lastError = new Error(`Kenari HTTP ${result.status}${code ? ` (${code})` : ''}`)
    const hasFallback = index < models.length - 1
    if (!hasFallback || !retryableStatus(result.status)) throw lastError
    console.warn(`Kenari model ${candidate} gagal dengan HTTP ${result.status}${code ? ` (${code})` : ''}; mencoba model cadangan.`)
  }

  throw lastError || new Error('Waktu pemrosesan Kenari habis')
}
