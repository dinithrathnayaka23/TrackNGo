import { useState } from 'react'
import { Link } from 'react-router-dom'
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

type FieldProps = {
  id: string
  label: string
  type?: string
  icon: typeof faUser
  placeholder?: string
}

function Field({ id, label, type = 'text', icon, placeholder }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-lg font-semibold text-[#4d5564]">
        {label}
      </label>
      <div className="flex h-14 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
        <FontAwesomeIcon icon={icon} className="mr-3 text-[#8b92a1]" />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          className="w-full bg-transparent text-[23px] text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none"
        />
      </div>
    </div>
  )
}

function Signup() {
  const [showPasswords, setShowPasswords] = useState(false)
  const [agreePolicy, setAgreePolicy] = useState(true)

  return (
    <AuthLayout>
      <div className="w-full max-w-[680px]">
        <h2 className="animate-auth-fade-up text-[52px] font-bold leading-tight text-[#121b33]">Admin Registration</h2>
        <p className="animate-auth-fade-up mt-2 text-[23px] text-[#5b6476]" style={{ animationDelay: '90ms' }}>
          Access your centralized transport control panel.
        </p>

        <form className="mt-8 space-y-6" onSubmit={(event) => event.preventDefault()}>
          <div className="animate-auth-fade-up grid grid-cols-1 gap-5 sm:grid-cols-2" style={{ animationDelay: '160ms' }}>
            <Field id="full-name" label="Full Name" icon={faUser} placeholder="John Doe" />
            <Field id="employee-id" label="Employee ID" icon={faFingerprint} placeholder="EMP-00123" />
            <Field
              id="signup-email"
              label="Email Address"
              icon={faEnvelope}
              type="email"
              placeholder="j.doe@smartbus.com"
            />
            <Field
              id="phone-number"
              label="Phone Number"
              icon={faPhone}
              type="tel"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="animate-auth-fade-up border-t border-[#dde0e7] pt-6" style={{ animationDelay: '240ms' }}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="signup-password" className="mb-2 block text-lg font-semibold text-[#4d5564]">
                  Password
                </label>
                <div className="flex h-14 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
                  <FontAwesomeIcon icon={faLock} className="mr-3 text-[#8b92a1]" />
                  <input
                    id="signup-password"
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Enter Password"
                    className="w-full bg-transparent text-[23px] text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((value) => !value)}
                    className="text-[#2b2b2b] transition-transform duration-200 hover:scale-110"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                </div>

                <div className="mt-3">
                  <div className="mb-2 grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <span
                        key={`security-${index}`}
                        className="h-1.5 rounded bg-[#12a39a]"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-[#93a0af]">Security Level</span>
                    <span className="text-[#12a39a]">Strong</span>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-lg font-semibold text-[#4d5564]"
                >
                  Confirm Password
                </label>
                <div className="flex h-14 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
                  <FontAwesomeIcon icon={faLock} className="mr-3 text-[#8b92a1]" />
                  <input
                    id="confirm-password"
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    className="w-full bg-transparent text-[23px] text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((value) => !value)}
                    className="text-[#2b2b2b] transition-transform duration-200 hover:scale-110"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <label className="animate-auth-fade-up flex cursor-pointer items-start gap-3 text-xl font-semibold text-[#4d5564]" style={{ animationDelay: '320ms' }}>
            <input
              type="checkbox"
              checked={agreePolicy}
              onChange={(event) => setAgreePolicy(event.target.checked)}
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

          <button
            type="submit"
            className="animate-auth-fade-up flex h-16 w-full items-center justify-center gap-4 rounded-xl bg-[#2342a6] text-[25px] font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#1f3a93] hover:shadow-[0_12px_26px_rgba(35,66,166,0.34)]"
            style={{ animationDelay: '380ms' }}
          >
            Submit Registration
            <FontAwesomeIcon icon={faArrowRight} />
          </button>

          <p className="animate-auth-fade-up text-center text-xl font-medium text-[#666f80]" style={{ animationDelay: '440ms' }}>
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
