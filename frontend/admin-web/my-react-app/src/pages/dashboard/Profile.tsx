import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCheck, faFloppyDisk, faPen, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import ProfilePictureUpload from '../../components/ProfilePictureUpload.jsx'
import authService from '../../services/authService'
import { fetchMyProfile, updateMyProfile, type AdminProfile } from '../../services/profileService'
import adminProfileImage from '../../assets/images/adminProfilePlaceholder.svg'

type ProfileForm = {
  fullName: string
  phoneNumber: string
  email: string
}

const emptyForm: ProfileForm = { fullName: '', phoneNumber: '', email: '' }

function formFromProfile(profile: AdminProfile): ProfileForm {
  return {
    fullName: profile.fullName || '',
    phoneNumber: profile.phoneNumber || '',
    email: profile.email || '',
  }
}

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    void fetchMyProfile().then((data) => {
      if (!active) return
      setProfile(data)
      setForm(formFromProfile(data))
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load your profile.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  function beginEditing() {
    if (!profile) return
    setForm(formFromProfile(profile))
    setError('')
    setSuccess('')
    setEditing(true)
  }

  function cancelEditing() {
    if (profile) setForm(formFromProfile(profile))
    setError('')
    setEditing(false)
  }

  async function saveProfile() {
    if (!form.fullName.trim()) {
      setError('Full name is required.')
      return
    }
    if (!form.phoneNumber.trim()) {
      setError('Phone number is required for an admin profile.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const updated = await updateMyProfile({
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email,
      })
      setProfile(updated)
      setForm(formFromProfile(updated))
      setEditing(false)
      setSuccess('Profile details updated successfully.')

      const session = authService.getAdminProfile()
      if (session) {
        const nameParts = updated.fullName?.trim().split(/\s+/) ?? []
        localStorage.setItem('adminProfile', JSON.stringify({
          ...session,
          email: updated.email || session.email,
          firstName: nameParts[0] || null,
          lastName: nameParts.slice(1).join(' ') || null,
        }))
        window.dispatchEvent(new Event('admin-profile-updated'))
      }
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  const name = profile?.fullName || 'Admin User'
  const photo = profile?.profilePhoto || localStorage.getItem('adminProfilePhoto') || adminProfileImage
  const handlePhotoError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = adminProfileImage
    localStorage.removeItem('adminProfilePhoto')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate('/dashboard/settings')} className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#64748b] transition hover:text-[#2642a6]">
            <FontAwesomeIcon icon={faArrowLeft} /> Back to settings
          </button>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Profile</h1>
          <p className="mt-1 text-sm text-[#64748b]">View and manage your administrator account details.</p>
        </div>
        {!editing && profile ? (
          <button type="button" onClick={beginEditing} className="inline-flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-bold text-[#334155] transition hover:bg-[#f8fafc]">
            <FontAwesomeIcon icon={faPen} className="text-xs" /> Edit details
          </button>
        ) : null}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div> : null}
      {success ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><FontAwesomeIcon icon={faCheck} /> {success}</div> : null}

      {loading ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-white px-5 py-12 text-center text-sm font-semibold text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" /> Loading profile...</div>
      ) : profile ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ProfilePictureUpload
            currentImageUrl={photo || ''}
            onUploadSuccess={(url: string) => setProfile((current) => current ? { ...current, profilePhoto: url } : current)}
          />

          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <div className="flex items-start justify-between gap-4 border-b border-[#f1f5f9] pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94a3b8]">Account information</p>
                <h2 className="mt-1 text-lg font-extrabold text-[#111827]">{name}</h2>
              </div>
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#eef2ff] text-sm font-extrabold text-[#2642a6] shadow-[0_0_0_1px_#cfd8f5]">
                <img src={photo} alt="" onError={handlePhotoError} className="h-full w-full rounded-full object-cover" />
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[#334155] sm:col-span-2">
                Full name
                <input type="text" value={form.fullName} disabled={!editing} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm font-normal outline-none transition disabled:bg-[#f8fafc] disabled:text-[#64748b] focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]" />
              </label>
              <label className="text-sm font-semibold text-[#334155]">
                Phone number
                <input type="tel" value={form.phoneNumber} disabled={!editing} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm font-normal outline-none transition disabled:bg-[#f8fafc] disabled:text-[#64748b] focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]" />
              </label>
              <label className="text-sm font-semibold text-[#334155]">
                Email address
                <input type="email" value={form.email} readOnly className="mt-1 w-full cursor-not-allowed rounded-lg border border-[#d6dbe6] bg-[#f8fafc] px-3 py-2.5 text-sm font-normal text-[#64748b] outline-none" />
                <span className="mt-1 block text-xs font-normal text-[#94a3b8]">Email is managed as your sign-in identity.</span>
              </label>
            </div>

            {editing ? (
              <div className="mt-6 flex justify-end gap-3 border-t border-[#f1f5f9] pt-4">
                <button type="button" onClick={cancelEditing} disabled={saving} className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-bold text-[#334155] transition hover:bg-[#f8fafc] disabled:opacity-60">Cancel</button>
                <button type="button" onClick={() => void saveProfile()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-60">
                  <FontAwesomeIcon icon={saving ? faSpinner : faFloppyDisk} className={saving ? 'animate-spin' : ''} />
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  )
}
