import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const defaultCategories = ['Gaji', 'Freelance', 'Makan & Minum', 'Transportasi', 'Belanja', 'Kebutuhan Rumah', 'Tagihan', 'Langganan', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Pengeluaran Lainnya']

export async function registerUser({ name, email, password }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName: name })
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', credential.user.uid), {
    name, email, currency: 'IDR', budgetStartDay: 1, nextIncomeDate: null,
    onboardingCompleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  defaultCategories.forEach((categoryName) => {
    const categoryRef = doc(collection(db, 'users', credential.user.uid, 'categories'))
    batch.set(categoryRef, { name: categoryName, isDefault: true, isActive: true, createdAt: serverTimestamp() })
  })
  await batch.commit()
  return credential.user
}

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password)
export const logoutUser = () => signOut(auth)
export const resetPassword = (email) => sendPasswordResetEmail(auth, email)
