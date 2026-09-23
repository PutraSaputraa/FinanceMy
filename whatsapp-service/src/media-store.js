import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const MAX_RECEIPT_BYTES = 4_000_000

const extensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
])

function normalizedMime(value) {
  return typeof value === 'string' ? value.split(';', 1)[0].trim().toLowerCase() : ''
}

function safeKey(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(value)
}

export function createMediaStore(directory, now = () => Date.now()) {
  const mediaDirectory = path.join(directory, 'receipt-media')
  fs.mkdirSync(mediaDirectory, { recursive: true, mode: 0o700 })
  fs.chmodSync(mediaDirectory, 0o700)

  for (const entry of fs.readdirSync(mediaDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !safeKey(entry.name)) continue
    const target = path.join(mediaDirectory, entry.name)
    try {
      if (now() - fs.statSync(target).mtimeMs > 24 * 60 * 60 * 1000) fs.rmSync(target, { force: true })
    } catch { /* File mungkin sedang dihapus oleh proses lain. */ }
  }

  const targetPath = (key) => {
    if (!safeKey(key)) throw new Error('Referensi foto struk tidak valid.')
    return path.join(mediaDirectory, key)
  }

  return {
    save(id, media) {
      const mimeType = normalizedMime(media?.mimetype)
      const extension = extensions.get(mimeType)
      if (!extension || typeof media?.data !== 'string' || !media.data) {
        throw new Error('Format foto harus JPEG, PNG, atau WebP.')
      }
      const buffer = Buffer.from(media.data, 'base64')
      if (!buffer.length) throw new Error('Foto struk kosong.')
      if (buffer.length > MAX_RECEIPT_BYTES) throw new Error('Foto terlalu besar. Kirim foto berukuran maksimal 4 MB.')
      const key = `${createHash('sha256').update(String(id)).digest('hex')}${extension}`
      const target = targetPath(key)
      fs.writeFileSync(target, buffer, { mode: 0o600 })
      fs.chmodSync(target, 0o600)
      return { key, mimeType, filename: `struk${extension}`, size: buffer.length }
    },
    read(reference) {
      const target = targetPath(reference?.key)
      const data = fs.readFileSync(target).toString('base64')
      return { mimeType: reference.mimeType, filename: reference.filename, data }
    },
    remove(reference) {
      if (!reference?.key || !safeKey(reference.key)) return
      fs.rmSync(targetPath(reference.key), { force: true })
    },
  }
}

