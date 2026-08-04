import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCFXytPt6S0nYZuWMBWjGfTfVyATIS9_nY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'financemy-3ddec.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'financemy-3ddec',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '275663496289',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:275663496289:web:45337f332d86af52ff7620',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-NKD8T5QQGG',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app