'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User, Tenant, AuthState } from '@/types'
import { api } from '@/lib/api'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    password: string
    firstName: string
    lastName: string
    businessName: string
    businessType: string
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'mitch_auth_token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (token) {
        api.setToken(token)
        try {
          const response = await api.getCurrentUser()
          if (response.data) {
            setState({
              user: response.data.user,
              tenant: response.data.tenant,
              token,
              isLoading: false,
              isAuthenticated: true,
            })
            return
          }
        } catch {
          localStorage.removeItem(TOKEN_KEY)
        }
      }
      setState(prev => ({ ...prev, isLoading: false }))
    }
    initAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password)
    if (response.data) {
      const { token, user, tenant } = response.data
      localStorage.setItem(TOKEN_KEY, token)
      api.setToken(token)
      setState({
        user,
        tenant,
        token,
        isLoading: false,
        isAuthenticated: true,
      })
      router.push('/dashboard')
    }
  }, [router])

  const register = useCallback(async (data: {
    email: string
    password: string
    firstName: string
    lastName: string
    businessName: string
    businessType: string
  }) => {
    const response = await api.register(data)
    if (response.data) {
      const { token, user, tenant } = response.data
      localStorage.setItem(TOKEN_KEY, token)
      api.setToken(token)
      setState({
        user,
        tenant,
        token,
        isLoading: false,
        isAuthenticated: true,
      })
      // Redirect to onboarding wizard for new tenants
      if (tenant && !tenant.onboardingComplete) {
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }
    }
  }, [router])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    api.setToken(null)
    setState({
      user: null,
      tenant: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    })
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
