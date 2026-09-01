import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faArrowLeft,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons'
import AuthLayout from '../../components/layout/AuthLayout'
import authService from '../../services/authService'

type Step = 'identify' | 'otp' | 'password'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function ForgotPassword() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('identify')
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  // Step 1: identifier (email only — phone OTP isn't supported yet)
  const [identifier, setIdentifier] = useState('')
  const [identifierError, setIdentifierError] = useState('')

  // Step 2: OTP
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [maskedDestination, setMaskedDestination] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Step 3: reset token + new password
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({})

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    }
  }, [])

  const startCooldown = (seconds: number) => {
    setResendCooldown(seconds)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
          return 0
        }
        return current - 1
      })
    }, 1000)
  }

  const validateIdentifier = () => {
    const trimmed = identifier.trim()
    if (!trimmed) {
      setIdentifierError('Email is required.')
      return false
    }
    if (!isValidEmail(trimmed)) {
      setIdentifierError('Enter a valid email address.')
      return false
    }
    setIdentifierError('')
    return true
  }

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setApiError('')
    if (!validateIdentifier()) return

    setLoading(true)
    try {
      const response = await authService.forgotPassword({ identifier: identifier.trim(), channel: 'EMAIL', expectedUserType: 'admin' })
      setMaskedDestination(response.maskedDestination)
      startCooldown(response.resendCooldownSeconds)
      setOtp('')
      setOtpError('')
      setStep('otp')
    } catch (error: any) {
      setApiError(error.message || 'Failed to send verification code.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return
    setApiError('')
    setLoading(true)
    try {
      const response = await authService.resendOtp({ identifier: identifier.trim() })
      setMaskedDestination(response.maskedDestination)
      startCooldown(response.resendCooldownSeconds)
      setOtp('')
      setOtpError('')
    } catch (error: any) {
      setApiError(error.message || 'Failed to resend verification code.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    setApiError('')

    const trimmedOtp = otp.trim()
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setOtpError('Enter the 6-digit code.')
      return
    }
    setOtpError('')

    setLoading(true)
    try {
      const response = await authService.verifyOtp({ identifier: identifier.trim(), otp: trimmedOtp })
      setResetToken(response.resetToken)
      setStep('password')
    } catch (error: any) {
      setApiError(error.message || 'Failed to verify code.')
    } finally {
      setLoading(false)
    }
  }

  const validatePasswords = () => {
    const errors: { newPassword?: string; confirmPassword?: string } = {}
    if (!newPassword) {
      errors.newPassword = 'New password is required.'
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters.'
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.'
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setApiError('')
    if (!validatePasswords()) return

    setLoading(true)
    try {
      await authService.resetPassword({ resetToken, newPassword })
      navigate('/login', { replace: true, state: { passwordResetSuccess: true } })
    } catch (error: any) {
      setApiError(error.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[520px]">
        {step === 'identify' && (
          <>
            <h2 className="animate-auth-fade-up text-xl font-extrabold tracking-tight leading-tight text-[#121b33]">Recover Password</h2>
            <p className="animate-auth-fade-up mt-2 text-sm text-[#5b6476]" style={{ animationDelay: '90ms' }}>
              Enter your email address to receive a verification code.
            </p>

            {apiError && (
              <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">{apiError}</div>
            )}

            <form className="mt-6 space-y-5" onSubmit={handleSendCode} noValidate>
              <div className="animate-auth-fade-up" style={{ animationDelay: '180ms' }}>
                <label htmlFor="fp-identifier" className="mb-2 block text-sm font-semibold text-[#4d5564]">
                  Email Address
                </label>
                <div className="flex items-center rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 transition focus-within:border-[#2642a6] focus-within:ring-1 focus-within:ring-[#2642a6]">
                  <FontAwesomeIcon icon={faEnvelope} className="mr-3 text-[#8b92a1]" />
                  <input
                    id="fp-identifier"
                    type="email"
                    placeholder="admin@smartbus-system.com"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value)
                      setIdentifierError('')
                      setApiError('')
                    }}
                    onBlur={validateIdentifier}
                    disabled={loading}
                    aria-invalid={Boolean(identifierError)}
                    className="w-full bg-transparent text-sm text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none disabled:opacity-50"
                  />
                </div>
                {identifierError ? (
                  <p className="mt-2 text-sm font-medium text-[#dc2626]">{identifierError}</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="animate-auth-fade-up flex w-full items-center justify-center gap-2 rounded-lg bg-[#2642a6] py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96] hover:shadow-[0_12px_26px_rgba(38,66,166,0.34)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ animationDelay: '240ms' }}
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
                {!loading && <FontAwesomeIcon icon={faArrowRight} />}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <h2 className="animate-auth-fade-up text-xl font-extrabold tracking-tight leading-tight text-[#121b33]">Enter Verification Code</h2>
            <p className="animate-auth-fade-up mt-2 text-sm text-[#5b6476]" style={{ animationDelay: '90ms' }}>
              We sent a code to <span className="font-semibold text-[#20283a]">{maskedDestination}</span>
            </p>

            {apiError && (
              <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">{apiError}</div>
            )}

            <form className="mt-6 space-y-5" onSubmit={handleVerifyOtp} noValidate>
              <div className="animate-auth-fade-up" style={{ animationDelay: '150ms' }}>
                <label htmlFor="fp-otp" className="mb-2 block text-sm font-semibold text-[#4d5564]">
                  6-Digit Code
                </label>
                <div className="flex items-center rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 transition focus-within:border-[#2642a6] focus-within:ring-1 focus-within:ring-[#2642a6]">
                  <FontAwesomeIcon icon={faShieldHalved} className="mr-3 text-[#8b92a1]" />
                  <input
                    id="fp-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                      setOtpError('')
                      setApiError('')
                    }}
                    disabled={loading}
                    aria-invalid={Boolean(otpError)}
                    className="w-full bg-transparent text-sm tracking-[0.4em] text-[#20283a] placeholder:text-[#b3b8c3] placeholder:tracking-normal focus:placeholder:text-transparent outline-none disabled:opacity-50"
                  />
                </div>
                {otpError ? <p className="mt-2 text-sm font-medium text-[#dc2626]">{otpError}</p> : null}
              </div>

              <div className="animate-auth-fade-up flex items-center justify-between text-sm" style={{ animationDelay: '210ms' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep('identify')
                    setApiError('')
                  }}
                  disabled={loading}
                  className="flex items-center gap-2 font-semibold text-[#5b6476] disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
                  className="font-semibold text-[#2642a6] disabled:cursor-not-allowed disabled:text-[#a3a9b5]"
                >
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="animate-auth-fade-up flex w-full items-center justify-center gap-2 rounded-lg bg-[#2642a6] py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96] hover:shadow-[0_12px_26px_rgba(38,66,166,0.34)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ animationDelay: '270ms' }}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
                {!loading && <FontAwesomeIcon icon={faArrowRight} />}
              </button>
            </form>
          </>
        )}

        {step === 'password' && (
          <>
            <h2 className="animate-auth-fade-up text-xl font-extrabold tracking-tight leading-tight text-[#121b33]">Set New Password</h2>
            <p className="animate-auth-fade-up mt-2 text-sm text-[#5b6476]" style={{ animationDelay: '90ms' }}>
              Choose a new password for your admin account.
            </p>

            {apiError && (
              <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">{apiError}</div>
            )}

            <form className="mt-6 space-y-5" onSubmit={handleResetPassword} noValidate>
              <div className="animate-auth-fade-up" style={{ animationDelay: '150ms' }}>
                <label htmlFor="fp-new-password" className="mb-2 block text-sm font-semibold text-[#4d5564]">
                  New Password
                </label>
                <div className="flex items-center rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 transition focus-within:border-[#2642a6] focus-within:ring-1 focus-within:ring-[#2642a6]">
                  <FontAwesomeIcon icon={faLock} className="mr-3 text-[#8b92a1]" />
                  <input
                    id="fp-new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value)
                      setPasswordErrors((current) => ({ ...current, newPassword: undefined }))
                      setApiError('')
                    }}
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={Boolean(passwordErrors.newPassword)}
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
                {passwordErrors.newPassword ? (
                  <p className="mt-2 text-sm font-medium text-[#dc2626]">{passwordErrors.newPassword}</p>
                ) : null}
              </div>

              <div className="animate-auth-fade-up" style={{ animationDelay: '210ms' }}>
                <label htmlFor="fp-confirm-password" className="mb-2 block text-sm font-semibold text-[#4d5564]">
                  Confirm Password
                </label>
                <div className="flex items-center rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 transition focus-within:border-[#2642a6] focus-within:ring-1 focus-within:ring-[#2642a6]">
                  <FontAwesomeIcon icon={faLock} className="mr-3 text-[#8b92a1]" />
                  <input
                    id="fp-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      setPasswordErrors((current) => ({ ...current, confirmPassword: undefined }))
                      setApiError('')
                    }}
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={Boolean(passwordErrors.confirmPassword)}
                    className="w-full bg-transparent text-sm text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none disabled:opacity-50"
                  />
                </div>
                {passwordErrors.confirmPassword ? (
                  <p className="mt-2 text-sm font-medium text-[#dc2626]">{passwordErrors.confirmPassword}</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="animate-auth-fade-up flex w-full items-center justify-center gap-2 rounded-lg bg-[#2642a6] py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96] hover:shadow-[0_12px_26px_rgba(38,66,166,0.34)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ animationDelay: '270ms' }}
              >
                {loading ? 'Updating...' : 'Update Password'}
                {!loading && <FontAwesomeIcon icon={faArrowRight} />}
              </button>
            </form>
          </>
        )}

        <div className="animate-auth-fade-up mt-8 border-t border-[#dde0e7] pt-8 text-center" style={{ animationDelay: '420ms' }}>
          <p className="text-sm font-semibold text-[#4d5564]">
            Remembered your password?{' '}
            <Link to="/login" className="text-[#2642a6]">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

export default ForgotPassword
