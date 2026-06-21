import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
} from '@fortawesome/free-solid-svg-icons'
import AuthLayout from '../../components/layout/AuthLayout'
import authService from '../../services/authService'

type LoginForm = {
  email: string
  password: string
}

type LoginErrors = Partial<Record<keyof LoginForm, string>>

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateLogin(form: LoginForm): LoginErrors {
  const errors: LoginErrors = {}

  if (!form.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!isValidEmail(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!form.password) {
    errors.password = 'Password is required.'
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  }

  return errors
}

function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string>('')
  const navigate = useNavigate()

  const updateField = (field: keyof LoginForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setApiError('')
  }

  const validateField = (field: keyof LoginForm) => {
    const fieldErrors = validateLogin(form)
    setErrors((current) => ({ ...current, [field]: fieldErrors[field] }))
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()

    const validationErrors = validateLogin(form)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) return

    setLoading(true)
    setApiError('')

    try {
      await authService.login({
        email: form.email,
        password: form.password,
      })

      navigate('/dashboard')
    } catch (error: any) {
      setApiError(error.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[520px]">
        <h2 className="animate-auth-fade-up text-sm font-bold leading-tight text-[#121b33]">Admin Login</h2>
        <p className="animate-auth-fade-up mt-2 text-sm text-[#5b6476]" style={{ animationDelay: '90ms' }}>
          Access your centralized transport control panel.
        </p>

        {apiError && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">
            {apiError}
          </div>
        )}

        <form
          className="mt-6 space-y-5"
          onSubmit={handleLogin}
          noValidate
        >
          <div className="animate-auth-fade-up" style={{ animationDelay: '160ms' }}>
            <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-[#4d5564]">
              Email Address
            </label>
            <div className="flex h-9 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
              <FontAwesomeIcon icon={faEnvelope} className="mr-3 text-[#8b92a1]" />
              <input
                id="login-email"
                type="email"
                placeholder="admin@smartbus-system.com"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                onBlur={() => validateField('email')}
                autoComplete="email"
                disabled={loading}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                className="w-full bg-transparent text-sm text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none disabled:opacity-50"
              />
            </div>
            {errors.email ? (
              <p id="login-email-error" className="mt-2 text-sm font-medium text-[#dc2626]">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className="animate-auth-fade-up" style={{ animationDelay: '230ms' }}>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-semibold text-[#4d5564]"
            >
              Password
            </label>
            <div className="flex h-9 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
              <FontAwesomeIcon icon={faLock} className="mr-3 text-[#8b92a1]" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter Password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                onBlur={() => validateField('password')}
                autoComplete="current-password"
                disabled={loading}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                className="w-full bg-transparent text-sm text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
                className="text-[#2b2b2b] transition-transform duration-200 hover:scale-110 disabled:opacity-50"
              >
                <FontAwesomeIcon icon={showPassword ? faEye : faEyeSlash} />
              </button>
            </div>
            {errors.password ? (
              <p id="login-password-error" className="mt-2 text-sm font-medium text-[#dc2626]">
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="animate-auth-fade-up flex items-center justify-between text-sm" style={{ animationDelay: '300ms' }}>
            <label className="flex cursor-pointer items-center gap-2 text-[#4d5564]">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                disabled={loading}
                className="h-5 w-5 rounded border-[#d4d8e3] text-[#2342a6] focus:ring-[#2342a6] disabled:opacity-50"
              />
              <span className="font-semibold">Remember Device</span>
            </label>
            <a href="#" className="font-semibold text-[#129a8f]">
              Recovery Password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="animate-auth-fade-up flex h-10 w-full items-center justify-center gap-4 rounded-xl bg-[#2342a6] text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#1f3a93] hover:shadow-[0_12px_26px_rgba(35,66,166,0.34)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ animationDelay: '360ms' }}
          >
            {loading ? 'Logging in...' : 'Login to Dashboard'}
            {!loading && <FontAwesomeIcon icon={faArrowRight} />}
          </button>
        </form>

        <div className="animate-auth-fade-up mt-8 border-t border-[#dde0e7] pt-8 text-center" style={{ animationDelay: '420ms' }}>
          <p className="text-sm font-semibold text-[#4d5564]">
            New administrator profile required?{' '}
            <a href="#" className="text-[#129a8f]">
              Sign Up
            </a>
          </p>

          <div className="mt-8 flex justify-center gap-16 text-sm font-semibold text-[#a3a9b5]">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}

export default Login