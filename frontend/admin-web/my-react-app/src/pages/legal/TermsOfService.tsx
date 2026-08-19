import { Link } from 'react-router-dom'

function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#ececec] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[720px] rounded-[20px] border border-[#e5e7eb] bg-white p-8 shadow-[0_12px_35px_rgba(15,23,42,0.08)] sm:p-10">
        <Link to="/login" className="text-sm font-semibold text-[#129a8f]">
          &larr; Back to Login
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-[#121b33]">Terms of Service</h1>
        <p className="mt-2 text-sm text-[#5b6476]">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-[#4d5564]">
          <p>
            By accessing or using the TrackNGo admin panel, you agree to be bound by these Terms of
            Service. This panel is provided for authorized administrative staff of TrackNGo to manage
            routes, buses, bookings, and related operations.
          </p>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for
            all activity that occurs under your account. Access is limited to personnel explicitly
            granted administrative privileges.
          </p>
          <p>
            TrackNGo reserves the right to suspend or terminate access at any time for violations of
            these terms or for activity that compromises the security or integrity of the platform.
          </p>
          <p>
            These terms may be updated periodically. Continued use of the admin panel after changes are
            published constitutes acceptance of the revised terms.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TermsOfService
