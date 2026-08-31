import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { isValidEmail } from '../../utils/validators'

type LoginForm = {
  email: string
  password: string
}

type LoginErrors = Partial<Record<keyof LoginForm, string>>

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

const REMEMBERED_EMAIL_KEY = 'rememberedAdminEmail'

function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string>('')
  const navigate = useNavigate()

  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY)
    if (rememberedEmail) {
      setForm((current) => ({ ...current, email: rememberedEmail }))
      setRememberDevice(true)
    }
  }, [])

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

      if (rememberDevice) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, form.email.trim())
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }

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
        <h2 className="animate-auth-fade-up text-xl font-extrabold tracking-tight leading-tight text-[#111827]">Admin Login</h2>
        <p className="animate-auth-fade-up mt-1 text-sm text-[#64748b]" style={{ animationDelay: '90ms' }}>
          Access your centralized transport control panel.
        </p>

        {apiError && (
          <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200">
            {apiError}
          </div>
        )}

        <form
          className="mt-5 space-y-4"
          onSubmit={handleLogin}
          noValidate
        >
          <div className="animate-auth-fade-up" style={{ animationDelay: '160ms' }}>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-[#334155]">
              Email Address
            </label>
            <div className="flex items-center rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 transition focus-within:border-[#2642a6] focus-within:ring-1 focus-within:ring-[#2642a6]">
              <FontAwesomeIcon icon={faEnvelope} className="mr-3 text-[#94a3b8]" />
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
                className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none disabled:opacity-50"
              />
            </div>
            {errors.email ? (
              <p id="login-email-error" className="mt-1.5 text-sm font-medium text-[#dc2626]">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className="animate-auth-fade-up" style={{ animationDelay: '230ms' }}>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-semibold text-[#334155]"
            >
              Password
            </label>
            <div className="flex items-center rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 transition focus-within:border-[#2642a6] focus-within:ring-1 focus-within:ring-[#2642a6]">
              <FontAwesomeIcon icon={faLock} className="mr-3 text-[#94a3b8]" />
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
                className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
                className="text-[#111827] transition-transform duration-200 hover:scale-110 disabled:opacity-50"
              >
                <FontAwesomeIcon icon={showPassword ? faEye : faEyeSlash} />
              </button>
            </div>
            {errors.password ? (
              <p id="login-password-error" className="mt-1.5 text-sm font-medium text-[#dc2626]">
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="animate-auth-fade-up flex items-center justify-between text-sm" style={{ animationDelay: '300ms' }}>
            <label className="flex cursor-pointer items-center gap-2 text-[#334155]">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                disabled={loading}
                className="h-5 w-5 rounded border-[#d6dbe6] text-[#2642a6] focus:ring-[#2642a6] disabled:opacity-50"
              />
              <span className="font-semibold">Remember Device</span>
            </label>
            <Link to="/forgot-password" className="font-semibold text-[#2642a6]">
              Recovery Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="animate-auth-fade-up flex w-full items-center justify-center gap-2 rounded-lg bg-[#2642a6] py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96] hover:shadow-[0_12px_26px_rgba(38,66,166,0.34)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ animationDelay: '360ms' }}
          >
            {loading ? 'Logging in...' : 'Login to Dashboard'}
            {!loading && <FontAwesomeIcon icon={faArrowRight} />}
          </button>
        </form>

        <div className="animate-auth-fade-up mt-6 border-t border-[#e5e7eb] pt-5 text-center" style={{ animationDelay: '420ms' }}>
          <p className="text-sm font-semibold text-[#334155]">
            New administrator profile required?{' '}
            <Link to="/signup" className="text-[#2642a6]">
              Sign Up
            </Link>
          </p>

          <div className="mt-4 flex justify-center gap-10 text-sm font-semibold text-[#94a3b8]">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-service">Terms of Service</Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}

export default Login