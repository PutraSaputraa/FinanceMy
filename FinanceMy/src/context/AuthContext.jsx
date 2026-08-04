import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import { loginUser, logoutUser, registerUser, resetPassword } from '../services/authService'

const AuthContext = createContext(null)
const demoUser = { uid: 'demo-user', displayName: 'Raka Pratama', email: 'raka@financemy.id', isDemo: true }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => sessionStorage.getItem('financemy-demo') ? demoUser : null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) setUser(firebaseUser)
    else if (!sessionStorage.getItem('financemy-demo')) setUser(null)
    setLoading(false)
  }), [])

  const value = useMemo(() => ({
    user, loading,
    login: async (email, password) => { const result = await loginUser(email, password); setUser(result.user); return result },
    register: registerUser,
    resetPassword,
    demoLogin: async () => {
      if (auth.currentUser) await logoutUser()
      sessionStorage.setItem('financemy-demo', '1')
      setUser(demoUser)
    },
    logout: async () => { sessionStorage.removeItem('financemy-demo'); if (!user?.isDemo) await logoutUser(); setUser(null) },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
