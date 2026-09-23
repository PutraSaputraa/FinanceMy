import fs from 'node:fs'
import path from 'node:path'

export function createDelivery(inbox, directory, fetchMessage = fetch, sendReply = async () => {}, mediaStore = null) {
  const endpoint = process.env.WA_INGEST_ENDPOINT
  const key = process.env.WA_CONNECTOR_KEY
  if (!endpoint) return { start() {}, flush: async () => {}, stop() {} }
  if (new URL(endpoint).protocol !== 'https:' || !key) throw new Error('Konfigurasi pengiriman pesan WhatsApp tidak lengkap.')

  const deliveredPath = path.join(directory, 'delivered.jsonl')
  const deliveredFile = fs.openSync(deliveredPath, 'a+', 0o600)
  fs.fchmodSync(deliveredFile, 0o600)
  const delivered = new Set()
  for (const line of fs.readFileSync(deliveredFile, 'utf8').split('\n')) {
    if (!line) continue
    try { delivered.add(JSON.parse(line).id) } catch { /* Baris terakhir mungkin terpotong saat server mati. */ }
  }

  let timer = null
  let running = false
  let closed = false

  const markDelivered = (id) => {
    fs.appendFileSync(deliveredFile, `${JSON.stringify({ id })}\n`, 'utf8')
    fs.fsyncSync(deliveredFile)
    delivered.add(id)
  }

  const flush = async () => {
    if (running || closed) return
    running = true
    try {
      const records = fs.readFileSync(inbox.filePath, 'utf8').split('\n')
      for (const line of records) {
        if (!line || closed) continue
        let record
        try { record = JSON.parse(line) } catch { continue }
        if (!record.id || delivered.has(record.id)) continue
        const isText = record.type === 'chat' && record.text?.trim()
        const isReceipt = record.type === 'image' && record.media && mediaStore
        if (!isText && !isReceipt) {
          markDelivered(record.id)
          continue
        }
        let media
        if (isReceipt) {
          try {
            media = mediaStore.read(record.media)
          } catch {
            await sendReply(record.senderId, '⚠️ *FOTO TIDAK TERSEDIA*\n\nKirim ulang foto struk agar dapat diproses.')
            markDelivered(record.id)
            continue
          }
        }
        const result = await fetchMessage(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-financemy-connector-key': key },
          body: JSON.stringify({ id: record.id, senderId: record.senderId, phone: record.phone, type: record.type, text: record.text, ...(media ? { media } : {}) }),
          signal: AbortSignal.timeout(55000),
        })
        if (!result.ok && result.status !== 202) throw new Error(`HTTP ${result.status}`)
        const outcome = typeof result.json === 'function' ? await result.json() : {}
        if (typeof outcome?.reply === 'string' && outcome.reply) {
          await sendReply(record.senderId, outcome.reply)
        }
        markDelivered(record.id)
        if (record.media && mediaStore) mediaStore.remove(record.media)
        console.log('Pesan WhatsApp terkirim untuk pemrosesan FinanceMy.')
      }
    } catch (error) {
      console.error('Pengiriman pesan WhatsApp akan dicoba lagi:', error.message)
    } finally {
      running = false
    }
  }

  return {
    start() {
      if (timer) return
      timer = setInterval(() => void flush(), 30000)
      void flush()
    },
    flush,
    stop() {
      closed = true
      if (timer) clearInterval(timer)
      fs.closeSync(deliveredFile)
    },
  }
}
