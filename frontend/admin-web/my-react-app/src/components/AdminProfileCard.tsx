import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faCircleUser, faEnvelope, faPhone } from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'
import { fetchMyProfile, type AdminProfile } from '../services/profileService'

function displayName(profile: AdminProfile | null) {
  if (profile?.fullName?.trim()) return profile.fullName.trim()
  const session = authService.getAdminProfile()
  return [session?.firstName, session?.lastName].filter(Boolean).join(' ') || session?.email || 'Admin User'
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AD'
}

export default function AdminProfileCard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AdminProfile | null>(null)

  useEffect(() => {
    let active = true
    void fetchMyProfile().then((data) => {
      if (active) setProfile(data)
    }).catch(() => {
      // The settings card still renders the cached session identity if the API is unavailable.
    })
    return () => {
      active = false
    }
  }, [])

  const name = displayName(profile)
  const photo = profile?.profilePhoto || localStorage.getItem('adminProfilePhoto')

  return (
    <article className="dashboard-card flex h-full flex-col rounded-xl border border-[#e5e7eb] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
            <FontAwesomeIcon icon={faCircleUser} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#111827]">Profile</h2>
            <p className="mt-0.5 text-xs font-medium text-[#64748b]">Manage your account details</p>
          </div>
        </div>
        <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-bold text-[#64748b]">Admin</span>
      </div>

      <div className="mt-5 flex flex-1 items-center gap-4 rounded-xl border border-[#edf0f5] bg-[#f8fafc] p-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#eef2ff] text-[#2642a6] shadow-[0_0_0_1px_#cfd8f5]">
          {photo ? <img src={photo} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="text-lg font-extrabold">{initials(name)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-extrabold text-[#111827]">{name}</h3>
          <p className="mt-1 flex min-w-0 items-center gap-2 truncate text-xs text-[#64748b]">
            <FontAwesomeIcon icon={faEnvelope} className="shrink-0 text-[10px]" />
            <span className="truncate">{profile?.email || authService.getAdminProfile()?.email || 'Email unavailable'}</span>
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-[#64748b]">
            <FontAwesomeIcon icon={faPhone} className="shrink-0 text-[10px]" />
            {profile?.phoneNumber || 'Phone not added'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/dashboard/settings/profile')}
        className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
      >
        View profile
        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
      </button>
    </article>
  )
}
