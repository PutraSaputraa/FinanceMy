export const MAX_RECEIPT_BYTES = 4_000_000

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function receiptMedia(value) {
  const mimeType = typeof value?.mimeType === 'string' ? value.mimeType.split(';', 1)[0].trim().toLowerCase() : ''
  const data = typeof value?.data === 'string' ? value.data.trim() : ''
  if (!acceptedMimeTypes.has(mimeType) || !data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
  const size = Math.floor(data.length * 3 / 4) - padding
  if (size <= 0 || size > MAX_RECEIPT_BYTES) return null
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1]
  return { mimeType, data, filename: `struk.${extension}`, size }
}

