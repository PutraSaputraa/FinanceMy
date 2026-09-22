import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const codePattern = /^FM-[A-HJ-NP-Z2-9]{8}$/

export function createPairingCode() {
  const bytes = randomBytes(8)
  return `FM-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`
}

export function validPairingCode(value) {
  return typeof value === 'string' && codePattern.test(value)
}

export function hashPairingCode(code) {
  return createHash('sha256').update(code).digest('hex')
}

export function validSenderId(value) {
  return typeof value === 'string' && /^\d{6,20}@(lid|c\.us)$/.test(value)
}

export function validPhone(value) {
  return value === null || (typeof value === 'string' && /^\d{6,15}$/.test(value))
}

export function matchesConnectorKey(provided, expected) {
  if (!provided || !expected) return false
  const actual = Buffer.from(provided)
  const stored = Buffer.from(expected)
  return actual.length === stored.length && timingSafeEqual(actual, stored)
}
