import fs from 'node:fs'
import path from 'node:path'

export function createNotifications(directory, sendMessage, { fetchRequest = fetch, endpoint = process.env.WA_NOTIFICATION_ENDPOINT || (process.env.WA_INGEST_ENDPOINT ? new URL('whatsapp-notifications', process.env.WA_INGEST_ENDPOINT).href : ''), key = process.env.WA_CONNECTOR_KEY } = {}) {
  if (!endpoint) return { start() {}, stop() {}, flush: async () => {} }
  if (new URL(endpoint).protocol !== 'https:' || !key) throw new Error('Konfigurasi pengingat WhatsApp tidak lengkap.')
  const file = fs.openSync(path.join(directory, 'notifications-sent.jsonl'), 'a+', 0o600)
  fs.fchmodSync(file, 0o600)
  const sent = new Set()
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    try { const record = JSON.parse(line); if (record.id) sent.add(record.id) } catch { /* Ignore an incomplete final write. */ }
  }
  let timer, cursor = null, running = false, closed = false
  const request = async (body) => {
    const result = await fetchRequest(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-financemy-connector-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(55_000) })
    if (!result.ok) throw new Error(`HTTP ${result.status}`)
    return result.json()
  }
  const flush = async () => {
    if (running || closed) return
    running = true
    try {
      const result = await request({ action: 'poll', cursor })
      cursor = result.cursor || null
      for (const item of result.items || []) {
        if (closed) break
        if (!/^[a-f0-9]{64}$/.test(item.id || '') || !/^\d{6,20}@(lid|c\.us)$/.test(item.senderId || '') || typeof item.text !== 'string' || !item.text || item.text.length > 4000) continue
        try {
          if (!sent.has(item.id)) {
            await sendMessage(item.senderId, item.text)
            fs.appendFileSync(file, `${JSON.stringify({ id: item.id })}\n`, 'utf8')
            fs.fsyncSync(file)
            sent.add(item.id)
          }
          // If ACK fails, the durable ledger suppresses re-sending after lease expiry/restart.
          await request({ action: 'ack', id: item.id, leaseToken: item.leaseToken })
        } catch (error) { console.error('Pengingat WhatsApp akan dicoba lagi:', error.message) }
      }
    } catch (error) { console.error('Pemeriksaan pengingat WhatsApp gagal:', error.message) }
    finally {
      running = false
      if (closed) fs.closeSync(file)
    }
  }
  return {
    flush,
    start() { if (!timer && !closed) { timer = setInterval(() => void flush(), 60_000); void flush() } },
    stop() { if (closed) return; closed = true; clearInterval(timer); if (!running) fs.closeSync(file) },
  }
}
