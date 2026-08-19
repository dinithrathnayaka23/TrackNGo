import { Link } from 'react-router-dom'

function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#ececec] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[720px] rounded-[20px] border border-[#e5e7eb] bg-white p-8 shadow-[0_12px_35px_rgba(15,23,42,0.08)] sm:p-10">
        <Link to="/login" className="text-sm font-semibold text-[#129a8f]">
          &larr; Back to Login
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-[#111827]">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[#64748b]">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-[#334155]">
          <p>
            TrackNGo collects administrative account information such as your name, email address, and
            employee ID in order to authenticate access to the admin panel and attribute actions taken
            within the system.
          </p>
          <p>
            Operational data you access through the panel &mdash; including routes, bus locations,
            bookings, and complaints &mdash; is used solely to support day-to-day transport management
            and is not shared with third parties outside of TrackNGo's operational needs.
          </p>
          <p>
            If you enable &ldquo;Remember Device&rdquo; on the login screen, your email address is stored
            locally in your browser to streamline future sign-ins on that device. This information is
            never transmitted to third parties.
          </p>
          <p>
            You may request removal of your administrative account and associated data at any time by
            contacting your system administrator.
          </p>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
