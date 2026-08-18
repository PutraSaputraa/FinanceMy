import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : null
}

async function credentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE
  if (!file) throw new Error('Atur FIREBASE_SERVICE_ACCOUNT_FILE atau FIREBASE_SERVICE_ACCOUNT_JSON.')
  return JSON.parse(await readFile(file, 'utf8'))
}

const email = argument('email')
const uid = argument('uid')
if (!email && !uid) throw new Error('Gunakan --email admin@example.com atau --uid FIREBASE_UID.')

const app = initializeApp({ credential: cert(await credentials()) })
const auth = getAuth(app)
const user = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true })
console.log(`Claim admin berhasil diberikan kepada ${user.email || user.uid}. Logout lalu login kembali untuk memperbarui token.`)
