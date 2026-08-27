import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faCircleUser, faEnvelope, faPhone } from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'
import { fetchMyProfile, type AdminProfile } from '../services/profileService'
import adminProfileImage from '../assets/images/adminProfilePlaceholder.svg'

const ADMIN_PROFILE_PHOTO_KEY = 'adminProfilePhoto'
const ADMIN_PROFILE_PHOTO_UPDATED_EVENT = 'admin-profile-photo-updated'

function displayName(profile: AdminProfile | null) {
  if (profile?.fullName?.trim()) return profile.fullName.trim()
  const session = authService.getAdminProfile()
  return [session?.firstName, session?.lastName].filter(Boolean).join(' ') || session?.email || 'Admin User'
}

export default function AdminProfileCard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [photoOverride, setPhotoOverride] = useState<string | null>(() => localStorage.getItem(ADMIN_PROFILE_PHOTO_KEY))

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

  useEffect(() => {
    const handlePhotoUpdate = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail
      const cached = localStorage.getItem(ADMIN_PROFILE_PHOTO_KEY)
      setPhotoOverride(detail || cached)
      if (!detail && !cached) {
        // The photo was removed, so the profile loaded at mount has to drop it too,
        // otherwise its stale URL would keep the deleted picture on screen.
        setProfile((current) => (current ? { ...current, profilePhoto: null } : current))
      }
    }
    const handleStorageUpdate = () => {
      setPhotoOverride(localStorage.getItem(ADMIN_PROFILE_PHOTO_KEY))
    }

    window.addEventListener(ADMIN_PROFILE_PHOTO_UPDATED_EVENT, handlePhotoUpdate)
    window.addEventListener('storage', handleStorageUpdate)
    return () => {
      window.removeEventListener(ADMIN_PROFILE_PHOTO_UPDATED_EVENT, handlePhotoUpdate)
      window.removeEventListener('storage', handleStorageUpdate)
    }
  }, [])

  const name = displayName(profile)
  const photo = photoOverride || profile?.profilePhoto || adminProfileImage
  const handlePhotoError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = adminProfileImage
    localStorage.removeItem(ADMIN_PROFILE_PHOTO_KEY)
    setPhotoOverride(adminProfileImage)
  }

  return (
    <article className="flex h-full flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
            <FontAwesomeIcon icon={faCircleUser} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#111827]">Profile</h2>
            <p className="mt-1 text-sm text-[#64748b]">Manage your account details</p>
          </div>
        </div>
        <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold text-[#64748b]">Admin</span>
      </div>

      <div className="mt-5 flex flex-1 items-center gap-4 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#eef2ff] text-[#2642a6] shadow-[0_0_0_1px_#cfd8f5]">
          <img src={photo} alt="" onError={handlePhotoError} className="h-full w-full rounded-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[#111827]">{name}</h3>
          <p className="mt-1 flex min-w-0 items-center gap-2 truncate text-xs text-[#64748b]">
            <FontAwesomeIcon icon={faEnvelope} className="shrink-0 text-2xs" />
            <span className="truncate">{profile?.email || authService.getAdminProfile()?.email || 'Email unavailable'}</span>
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-[#64748b]">
            <FontAwesomeIcon icon={faPhone} className="shrink-0 text-2xs" />
            {profile?.phoneNumber || 'Phone not added'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/dashboard/settings/profile')}
        className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
      >
        View profile
        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
      </button>
    </article>
  )
}
