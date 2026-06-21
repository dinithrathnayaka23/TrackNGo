import type { NavigateFunction } from 'react-router-dom'

// Centralized auth storage keys used across login/logout flows.
const AUTH_STORAGE_KEYS = ['jwtToken', 'adminEmail', 'adminProfile', 'authToken', 'admin'] as const

export function clearAuthSession(): void {
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  }
}

export function logoutToLogin(navigate: NavigateFunction): void {
  clearAuthSession()
  navigate('/login', { replace: true })
}

