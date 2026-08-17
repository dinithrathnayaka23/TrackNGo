import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faEnvelope,
  faEye,
  faFingerprint,
  faLock,
  faPhone,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import AuthLayout from '../../components/layout/AuthLayout'
import authService from '../../services/authService'

type SignupForm = {
  fullName: string
  employeeId: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

type SignupErrors = Partial<Record<keyof SignupForm | 'agreePolicy', string>>

type FieldProps = {
  id: string
  name: keyof SignupForm
  label: string
  type?: string
  icon: typeof faUser
  placeholder?: string
  value: string
  error?: string
  onChange: (field: keyof SignupForm, value: string) => void
  onBlur: (field: keyof SignupForm) => void
}

function Field({
  id,
  name,
  label,
  type = 'text',
  icon,
  placeholder,
  value,
  error,
  onChange,
  onBlur,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#4d5564]">
        {label}
      </label>
      <div className="flex h-9 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
        <FontAwesomeIcon icon={icon} className="mr-3 text-[#8b92a1]" />
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          onBlur={() => onBlur(name)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full bg-transparent text-sm text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-[#dc2626]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPhone(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '')
  const digits = normalized.replace('+', '')
  return /^\+?[\d\s()-]+$/.test(phone) && digits.length >= 10 && digits.length <= 15
}

function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return score
}

function validateSignup(form: SignupForm, agreePolicy: boolean): SignupErrors {
  const errors: SignupErrors = {}

  if (!form.fullName.trim()) {
    errors.fullName = 'Full name is required.'
  }

  if (!form.employeeId.trim()) {
    errors.employeeId = 'Employee ID is required.'
  } else if (!/^[A-Za-z0-9-]{4,20}$/.test(form.employeeId.trim())) {
    errors.employeeId = 'Employee ID must be 4-20 characters (letters, numbers, hyphens).'
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!isValidEmail(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!form.phone.trim()) {
    errors.phone = 'Phone number is required.'
  } else if (!isValidPhone(form.phone.trim())) {
    errors.phone = 'Enter a valid phone number.'
  }

  if (!form.password) {
    errors.password = 'Password is required.'
  } else if (getPasswordStrength(form.password) < 4) {
    errors.password = 'Use at least 8 chars with upper, lower, number, and symbol.'
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Confirm password is required.'
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  if (!agreePolicy) {
    errors.agreePolicy = 'You must agree to the policy to continue.'
  }

  return errors
}

function Signup() {
  const navigate = useNavigate()
  const [showPasswords, setShowPasswords] = useState(false)
  const [agreePolicy, setAgreePolicy] = useState(true)
  const [form, setForm] = useState<SignupForm>({
    fullName: '',
    employeeId: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<SignupErrors>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const passwordStrength = getPasswordStrength(form.password)
  const securityLabel =
    passwordStrength >= 4 ? 'Strong' : passwordStrength >= 3 ? 'Medium' : passwordStrength >= 1 ? 'Weak' : 'None'

  const updateField = (field: keyof SignupForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validateField = (field: keyof SignupForm) => {
    const fieldErrors = validateSignup(form, agreePolicy)
    setErrors((current) => ({ ...current, [field]: fieldErrors[field] }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setApiError('')
    setSuccessMessage('')

    const validationErrors = validateSignup(form, agreePolicy)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setLoading(true)
    try {
      await authService.registerAdmin({
        fullName: form.fullName,
        employeeId: form.employeeId,
        email: form.email,
        phone: form.phone,
        password: form.password,
      })
      setSuccessMessage('Registration successful. Redirecting to login...')
      setTimeout(() => navigate('/login'), 1500)
    } catch (error: any) {
      setApiError(error.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[680px]">
        <h2 className="animate-auth-fade-up text-sm font-bold leading-tight text-[#121b33]">Admin Registration</h2>
        <p className="animate-auth-fade-up mt-2 text-sm text-[#5b6476]" style={{ animationDelay: '90ms' }}>
          Access your centralized transport control panel.
        </p>

        {apiError && (
          <div className="animate-auth-fade-up mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {apiError}
          </div>
        )}

        {successMessage && (
          <div className="animate-auth-fade-up mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-600">
            {successMessage}
          </div>
        )}

        <form
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="animate-auth-fade-up grid grid-cols-1 gap-5 sm:grid-cols-2" style={{ animationDelay: '160ms' }}>
            <Field
              id="full-name"
              name="fullName"
              label="Full Name"
              icon={faUser}
              placeholder="John Doe"
              value={form.fullName}
              onChange={updateField}
              onBlur={validateField}
              error={errors.fullName}
            />
            <Field
              id="employee-id"
              name="employeeId"
              label="Employee ID"
              icon={faFingerprint}
              placeholder="EMP-00123"
              value={form.employeeId}
              onChange={updateField}
              onBlur={validateField}
              error={errors.employeeId}
            />
            <Field
              id="signup-email"
              name="email"
              label="Email Address"
              icon={faEnvelope}
              type="email"
              placeholder="j.doe@smartbus.com"
              value={form.email}
              onChange={updateField}
              onBlur={validateField}
              error={errors.email}
            />
            <Field
              id="phone-number"
              name="phone"
              label="Phone Number"
              icon={faPhone}
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={form.phone}
              onChange={updateField}
              onBlur={validateField}
              error={errors.phone}
            />
          </div>

          <div className="animate-auth-fade-up border-t border-[#dde0e7] pt-6" style={{ animationDelay: '240ms' }}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="signup-password" className="mb-2 block text-sm font-semibold text-[#4d5564]">
                  Password
                </label>
                <div className="flex h-9 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
                  <FontAwesomeIcon icon={faLock} className="mr-3 text-[#8b92a1]" />
                  <input
                    id="signup-password"
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Enter Password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    onBlur={() => validateField('password')}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'signup-password-error' : undefined}
                    className="w-full bg-transparent text-sm text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((value) => !value)}
                    className="text-[#2b2b2b] transition-transform duration-200 hover:scale-110"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                </div>
                {errors.password ? (
                  <p id="signup-password-error" className="mt-2 text-sm font-medium text-[#dc2626]">
                    {errors.password}
                  </p>
                ) : null}

                <div className="mt-3">
                  <div className="mb-2 grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <span
                        key={`security-${index}`}
                        className={`h-1.5 rounded ${
                          index < Math.min(passwordStrength, 4) ? 'bg-[#12a39a]' : 'bg-[#d1d5db]'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-[#93a0af]">Security Level</span>
                    <span className={passwordStrength >= 4 ? 'text-[#12a39a]' : 'text-[#f59e0b]'}>{securityLabel}</span>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm font-semibold text-[#4d5564]"
                >
                  Confirm Password
                </label>
                <div className="flex h-9 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
                  <FontAwesomeIcon icon={faLock} className="mr-3 text-[#8b92a1]" />
                  <input
                    id="confirm-password"
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    onBlur={() => validateField('confirmPassword')}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                    className="w-full bg-transparent text-sm text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((value) => !value)}
                    className="text-[#2b2b2b] transition-transform duration-200 hover:scale-110"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                </div>
                {errors.confirmPassword ? (
                  <p id="confirm-password-error" className="mt-2 text-sm font-medium text-[#dc2626]">
                    {errors.confirmPassword}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <label className="animate-auth-fade-up flex cursor-pointer items-start gap-3 text-sm font-semibold text-[#4d5564]" style={{ animationDelay: '320ms' }}>
            <input
              type="checkbox"
              checked={agreePolicy}
              onChange={(event) => {
                setAgreePolicy(event.target.checked)
                setErrors((current) => ({ ...current, agreePolicy: undefined }))
              }}
              className="mt-1 h-5 w-5 rounded border-[#d4d8e3] text-[#2342a6] focus:ring-[#2342a6]"
            />
            <span>
              I agree to the{' '}
              <a href="#" className="text-[#1f3c93]">
                internal data privacy policies
              </a>{' '}
              and confirm the accuracy of my details.
            </span>
          </label>
          {errors.agreePolicy ? (
            <p className="mt-1 text-sm font-medium text-[#dc2626]">{errors.agreePolicy}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="animate-auth-fade-up flex h-10 w-full items-center justify-center gap-4 rounded-xl bg-[#2342a6] text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#1f3a93] hover:shadow-[0_12px_26px_rgba(35,66,166,0.34)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ animationDelay: '380ms' }}
          >
            {loading ? 'Submitting...' : 'Submit Registration'}
            {!loading && <FontAwesomeIcon icon={faArrowRight} />}
          </button>

          <p className="animate-auth-fade-up text-center text-sm font-medium text-[#666f80]" style={{ animationDelay: '440ms' }}>
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-[#1f3c93]">
              Login to Dashboard
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  )
}

export default Signup
