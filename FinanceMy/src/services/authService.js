import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../firebase/config'

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password)
export const logoutUser = () => signOut(auth)
export const resetPassword = (email) => sendPasswordResetEmail(auth, email)
