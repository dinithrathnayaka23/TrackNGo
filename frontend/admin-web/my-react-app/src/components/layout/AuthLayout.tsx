import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBus, faLocationDot } from '@fortawesome/free-solid-svg-icons'

type AuthLayoutProps = {
  children: ReactNode
}

function AuthLayout({ children }: AuthLayoutProps) {
  return (
    // Shared shell for login/signup screens with a branded left panel.
    <div className="min-h-screen bg-[#ececec] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="animate-auth-card mx-auto flex min-h-[660px] w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-[#1f2f8d]/60 bg-[#f7f7f7] shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <div className="animate-auth-left hidden w-[42%] flex-col items-center justify-center bg-gradient-to-b from-[#01050f] via-[#0f2059] to-[#2642a6] p-8 text-white md:flex">
          <div className="animate-auth-float mb-8 flex h-44 w-44 items-center justify-center rounded-full bg-[#04153f]/60">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white">
              <div className="flex h-18 w-18 items-center justify-center rounded bg-[#23429c]">
                <div className="relative">
                  <FontAwesomeIcon icon={faBus} className="text-2xl text-white" />
                  <FontAwesomeIcon
                    icon={faLocationDot}
                    className="absolute -bottom-1 -right-3 text-base text-white"
                  />
                </div>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TrackNGo</h1>
          <p className="mt-1.5 text-sm text-white/90">Your Journey, Simplified</p>
        </div>

        <div className="animate-auth-fade-up flex w-full items-center justify-center p-6 md:w-[58%] md:p-10">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
