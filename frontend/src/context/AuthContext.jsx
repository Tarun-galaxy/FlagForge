import { createContext, useContext, useState, useEffect } from 'react'
import apiClient from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const storedToken = localStorage.getItem('token')
      if (!storedToken) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const response = await apiClient.get('/api/auth/me')
        setUser(response.data)
      } catch (err) {
        console.error('Failed to validate session token', err)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
        setToken('')
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentUser()
  }, [token])

  const saveAuthSession = (authToken, userData) => {
    localStorage.setItem('token', authToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(authToken)
    setUser(userData)
  }

  const loginWithEmail = async (email, password) => {
    const res = await apiClient.post('/api/auth/login', { email, password })
    saveAuthSession(res.data.access_token, res.data.user)
    return res.data
  }

  const registerWithEmail = async (email, password, fullName) => {
    const res = await apiClient.post('/api/auth/register', { email, password, full_name: fullName })
    saveAuthSession(res.data.access_token, res.data.user)
    return res.data
  }

  const handleOAuthCallback = async (provider, code) => {
    const res = await apiClient.post(`/api/auth/${provider}/callback`, { code })
    saveAuthSession(res.data.access_token, res.data.user)
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken('')
    setUser(null)
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !!user,
      loginWithEmail,
      registerWithEmail,
      handleOAuthCallback,
      saveAuthSession,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
