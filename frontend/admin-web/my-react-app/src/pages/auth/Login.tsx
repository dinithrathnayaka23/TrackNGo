import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
} from '@fortawesome/free-solid-svg-icons'
import AuthLayout from '../../components/layout/AuthLayout'

function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)

  return (
    <AuthLayout>
      <div className="w-full max-w-[520px]">
        <h2 className="animate-auth-fade-up text-[52px] font-bold leading-tight text-[#121b33]">Admin Login</h2>
        <p className="animate-auth-fade-up mt-2 text-[23px] text-[#5b6476]" style={{ animationDelay: '90ms' }}>
          Access your centralized transport control panel.
        </p>

        <form className="mt-10 space-y-6" onSubmit={(event) => event.preventDefault()}>
          <div className="animate-auth-fade-up" style={{ animationDelay: '160ms' }}>
            <label htmlFor="login-email" className="mb-2 block text-lg font-semibold text-[#4d5564]">
              Email Address
            </label>
            <div className="flex h-14 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
              <FontAwesomeIcon icon={faEnvelope} className="mr-3 text-[#8b92a1]" />
              <input
                id="login-email"
                type="email"
                placeholder="admin@smartbus-system.com"
                className="w-full bg-transparent text-[23px] text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none"
              />
            </div>
          </div>

          <div className="animate-auth-fade-up" style={{ animationDelay: '230ms' }}>
            <label
              htmlFor="login-password"
              className="mb-2 block text-lg font-semibold text-[#4d5564]"
            >
              Password
            </label>
            <div className="flex h-14 items-center rounded-xl border border-[#d9dce4] bg-[#f7f7f9] px-4 transition-all duration-200 focus-within:border-[#2342a6] focus-within:shadow-[0_0_0_3px_rgba(35,66,166,0.14)]">
              <FontAwesomeIcon icon={faLock} className="mr-3 text-[#8b92a1]" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter Password"
                className="w-full bg-transparent text-[23px] text-[#20283a] placeholder:text-[#b3b8c3] focus:placeholder:text-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="text-[#2b2b2b] transition-transform duration-200 hover:scale-110"
              >
                <FontAwesomeIcon icon={showPassword ? faEye : faEyeSlash} />
              </button>
            </div>
          </div>

          <div className="animate-auth-fade-up flex items-center justify-between text-lg" style={{ animationDelay: '300ms' }}>
            <label className="flex cursor-pointer items-center gap-2 text-[#4d5564]">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                className="h-5 w-5 rounded border-[#d4d8e3] text-[#2342a6] focus:ring-[#2342a6]"
              />
              <span className="font-semibold">Remember Device</span>
            </label>
            <a href="#" className="font-semibold text-[#129a8f]">
              Recovery Password?
            </a>
          </div>

          <button
            type="submit"
            className="animate-auth-fade-up flex h-16 w-full items-center justify-center gap-4 rounded-xl bg-[#2342a6] text-[25px] font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#1f3a93] hover:shadow-[0_12px_26px_rgba(35,66,166,0.34)]"
            style={{ animationDelay: '360ms' }}
          >
            Login to Dashboard
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </form>

        <div className="animate-auth-fade-up mt-14 border-t border-[#dde0e7] pt-8 text-center" style={{ animationDelay: '420ms' }}>
          <p className="text-xl font-semibold text-[#4d5564]">
            New administrator profile required?{' '}
            <Link to="/signup" className="text-[#129a8f]">
              Request Access
            </Link>
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
