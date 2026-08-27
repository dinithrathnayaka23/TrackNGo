import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faBullhorn,
  faCheckCircle,
  faClockRotateLeft,
  faGear,
  faHeadset,
  faPen,
  faPhoneVolume,
  faPlus,
  faSpinner,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  createEmergencyNumber,
  fetchEmergencyNumbers,
  updateEmergencyNumber,
  type EmergencyNumber,
  type SaveEmergencyNumberRequest,
} from '../../services/emergencyNumberService'
import {
  fetchSupportContact,
  updateSupportContact,
  type SaveSupportContactRequest,
  type SupportContact,
} from '../../services/supportContactService'
import AdminProfileCard from '../../components/AdminProfileCard'
import SosHistoryPanel from '../../components/SosHistoryPanel'
import SendNotificationPanel from '../../components/SendNotificationPanel'

const emptyForm: SaveEmergencyNumberRequest = {
  label: '',
  fireBrigade: '',
  ambulance: '',
  police: '',
  helpCenter: '',
  isActive: false,
}

function activeBadge(isActive: boolean) {
  return isActive ? 'bg-[#dcfce7] text-[#047857]' : 'bg-[#f1f5f9] text-[#64748b]'
}

const emptySupportContactForm: SaveSupportContactRequest = { name: '', role: '', phone: '' }

/** The full-screen shell the settings sections open into, so each one only writes its body. */
function SettingsModal({
  title,
  subtitle,
  icon,
  onClose,
  children,
}: {
  title: string
  subtitle: string
  icon: typeof faGear
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Wide enough that the history table fits every column without sideways scrolling. */}
        <div className="relative max-h-[90vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#334155]"
            aria-label={`Close ${title}`}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>

          <div className="max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center gap-3 pr-10">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
                <FontAwesomeIcon icon={icon} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#111827]">{title}</h2>
                <p className="text-sm text-[#64748b]">{subtitle}</p>
              </div>
            </div>

            <div className="mt-5">{children}</div>
          </div>
        </div>
      </div>
    </>
  )
}

/** One entry tile in the settings grid. */
function SettingsCard({
  icon,
  tag,
  title,
  description,
  onOpen,
}: {
  icon: typeof faGear
  tag: string
  title: string
  description: string
  onOpen: () => void
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
          <FontAwesomeIcon icon={icon} />
        </div>
        <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold text-[#64748b]">{tag}</span>
      </div>

      <div className="mt-5 flex-1">
        <h2 className="text-lg font-extrabold text-[#111827]">{title}</h2>
        <p className="mt-1 text-sm text-[#64748b]">{description}</p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
      >
        Go
        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
      </button>
    </article>
  )
}

function Settings() {
  const location = useLocation()
  const [modalOpen, setModalOpen] = useState(false)
  const [sosHistoryOpen, setSosHistoryOpen] = useState(false)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [rows, setRows] = useState<EmergencyNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<SaveEmergencyNumberRequest>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [supportContact, setSupportContact] = useState<SupportContact | null>(null)
  const [supportContactModalOpen, setSupportContactModalOpen] = useState(false)
  const [supportContactForm, setSupportContactForm] = useState<SaveSupportContactRequest>(emptySupportContactForm)
  const [supportContactLoading, setSupportContactLoading] = useState(false)
  const [supportContactError, setSupportContactError] = useState('')
  const [supportContactSaving, setSupportContactSaving] = useState(false)
  const [supportContactSaveError, setSupportContactSaveError] = useState('')

  const loadSupportContact = useCallback(async () => {
    try {
      setSupportContactLoading(true)
      setSupportContactError('')
      const data = await fetchSupportContact()
      setSupportContact(data)
    } catch (err) {
      setSupportContactError(err instanceof Error ? err.message : 'Failed to load support contact')
    } finally {
      setSupportContactLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSupportContact()
  }, [loadSupportContact])

  function openSupportContactModal() {
    setSupportContactForm({
      name: supportContact?.name ?? '',
      role: supportContact?.role ?? '',
      phone: supportContact?.phone ?? '',
    })
    setSupportContactSaveError('')
    setSupportContactModalOpen(true)
  }

  async function saveSupportContact() {
    if (!supportContactForm.name.trim() || !supportContactForm.role.trim() || !supportContactForm.phone.trim()) {
      setSupportContactSaveError('Name, role and phone are all required.')
      return
    }
    try {
      setSupportContactSaving(true)
      setSupportContactSaveError('')
      const updated = await updateSupportContact({
        name: supportContactForm.name.trim(),
        role: supportContactForm.role.trim(),
        phone: supportContactForm.phone.trim(),
      })
      setSupportContact(updated)
      setSupportContactModalOpen(false)
    } catch (err) {
      setSupportContactSaveError(err instanceof Error ? err.message : 'Failed to save support contact')
    } finally {
      setSupportContactSaving(false)
    }
  }

  const activeRow = rows.find((row) => row.isActive)
  const activeRowText = activeRow
    ? `Active: ${activeRow.label}`
    : loading && rows.length === 0
      ? 'Loading active row...'
      : error
        ? 'Unable to load active row'
        : 'No active row found'

  const loadRows = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchEmergencyNumbers()
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emergency numbers')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    if (location.hash !== '#profile-section') return
    window.requestAnimationFrame(() => {
      document.getElementById('profile-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }, [location.hash])

  function openModal() {
    setModalOpen(true)
    setFormOpen(false)
    setSaveError('')
    void loadRows()
  }

  function closeModal() {
    setModalOpen(false)
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setSaveError('')
    setSaving(false)
  }

  function openAddForm() {
    setEditingId(null)
    setForm({
      ...emptyForm,
      isActive: rows.length === 0 || !rows.some((row) => row.isActive),
    })
    setSaveError('')
    setFormOpen(true)
  }

  function openEditForm(row: EmergencyNumber) {
    setEditingId(row.emergencyId)
    setForm({
      label: row.label,
      fireBrigade: row.fireBrigade,
      ambulance: row.ambulance,
      police: row.police,
      helpCenter: row.helpCenter,
      isActive: row.isActive,
    })
    setSaveError('')
    setFormOpen(true)
  }

  function updateField<K extends keyof SaveEmergencyNumberRequest>(key: K, value: SaveEmergencyNumberRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function validateForm() {
    if (!form.label.trim() || !form.fireBrigade.trim() || !form.ambulance.trim() || !form.police.trim() || !form.helpCenter.trim()) {
      return 'All emergency number fields are required.'
    }
    return ''
  }

  async function saveForm() {
    const validationError = validateForm()
    if (validationError) {
      setSaveError(validationError)
      return
    }

    const payload: SaveEmergencyNumberRequest = {
      label: form.label.trim(),
      fireBrigade: form.fireBrigade.trim(),
      ambulance: form.ambulance.trim(),
      police: form.police.trim(),
      helpCenter: form.helpCenter.trim(),
      isActive: form.isActive,
    }

    try {
      setSaving(true)
      setSaveError('')

      if (editingId) {
        await updateEmergencyNumber(editingId, payload)
      } else {
        await createEmergencyNumber(payload)
      }

      setFormOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await loadRows()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save emergency number')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="animate-dash-in flex flex-wrap items-center justify-between gap-4" style={{ animationDelay: '80ms' }}>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Settings</h1>
        </div>

        <section className="animate-dash-in grid gap-4 sm:grid-cols-2 xl:grid-cols-3" style={{ animationDelay: '100ms' }}>
          <article className="h-full rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
                <FontAwesomeIcon icon={faPhoneVolume} />
              </div>
              <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold text-[#64748b]">
                SOS
              </span>
            </div>

            <div className="mt-5">
              <h2 className="text-lg font-extrabold text-[#111827]">Configure Emergency Numbers</h2>
              <p className="mt-1 text-sm text-[#64748b]">
                {activeRowText}
              </p>
            </div>

            <button
              type="button"
              onClick={openModal}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
            >
              Go
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </button>
          </article>

          <SettingsCard
            icon={faClockRotateLeft}
            tag="SOS"
            title="SOS Alert History"
            description="Review every alert ever raised and export the report."
            onOpen={() => setSosHistoryOpen(true)}
          />

          <SettingsCard
            icon={faBullhorn}
            tag="Notify"
            title="Send Notification"
            description="Write a notice and send it to passengers, drivers, or corporate users."
            onOpen={() => setBroadcastOpen(true)}
          />

          <article className="dashboard-card h-full rounded-xl border border-[#e5e7eb] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
                <FontAwesomeIcon icon={faHeadset} />
              </div>
              <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-bold text-[#64748b]">
                Corporate
              </span>
            </div>

            <div className="mt-5">
              <h2 className="text-lg font-extrabold text-[#111827]">Corporate Support Contact</h2>
              <p className="mt-1 text-sm text-[#64748b]">
                {supportContactLoading
                  ? 'Loading...'
                  : supportContactError
                    ? 'Unable to load contact'
                    : supportContact
                      ? `${supportContact.name} · ${supportContact.role}`
                      : 'Not configured'}
              </p>
            </div>

            <button
              type="button"
              onClick={openSupportContactModal}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
            >
              Edit
              <FontAwesomeIcon icon={faPen} className="text-xs" />
            </button>
          </article>

          <div id="profile-section" className="h-full scroll-mt-24">
            <AdminProfileCard />
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#334155]"
              aria-label="Close emergency numbers"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>

            <div className="max-h-[90vh] overflow-y-auto p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pr-10">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
                    <FontAwesomeIcon icon={faGear} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-[#111827]">Emergency Numbers</h2>
                    <p className="text-sm text-[#64748b]">{rows.length} rows</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openAddForm}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#203b96]"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  Add New
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-[#e5e7eb]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e5e7eb] bg-[#f8fafc] text-left text-xs font-semibold uppercase text-[#64748b] tracking-wide">
                        <th className="px-4 py-3">Label</th>
                        <th className="px-4 py-3">Fire Brigade</th>
                        <th className="px-4 py-3">Ambulance</th>
                        <th className="px-4 py-3">Police</th>
                        <th className="px-4 py-3">Help Center</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-[#64748b]">
                            <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                            Loading emergency numbers...
                          </td>
                        </tr>
                      )}

                      {!loading && error && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-[#dc2626]">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
                            {error}
                          </td>
                        </tr>
                      )}

                      {!loading && !error && rows.map((row) => (
                        <tr key={row.emergencyId} className="border-b border-[#f1f5f9] last:border-b-0">
                          <td className="px-4 py-3 font-bold text-[#111827]">{row.label}</td>
                          <td className="px-4 py-3 text-[#334155]">{row.fireBrigade}</td>
                          <td className="px-4 py-3 text-[#334155]">{row.ambulance}</td>
                          <td className="px-4 py-3 text-[#334155]">{row.police}</td>
                          <td className="px-4 py-3 text-[#334155]">{row.helpCenter}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${activeBadge(row.isActive)}`}>
                              {row.isActive && <FontAwesomeIcon icon={faCheckCircle} className="text-2xs" />}
                              {row.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEditForm(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d6dbe6] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
                            >
                              <FontAwesomeIcon icon={faPen} className="text-2xs" />
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}

                      {!loading && !error && rows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-[#64748b]">
                            No emergency numbers found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {formOpen && (
                <div className="mt-5 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-[#111827]">
                      {editingId ? 'Edit Emergency Row' : 'Add Emergency Row'}
                    </h3>
                    <label className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#334155]">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) => updateField('isActive', event.target.checked)}
                        className="h-4 w-4 accent-[#2642a6]"
                      />
                      Active
                    </label>
                  </div>

                  {saveError && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      {saveError}
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-sm font-semibold text-[#334155]">
                      Label
                      <input
                        type="text"
                        value={form.label}
                        onChange={(event) => updateField('label', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                      />
                    </label>
                    <label className="text-sm font-semibold text-[#334155]">
                      Fire Brigade
                      <input
                        type="text"
                        value={form.fireBrigade}
                        onChange={(event) => updateField('fireBrigade', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                      />
                    </label>
                    <label className="text-sm font-semibold text-[#334155]">
                      Ambulance
                      <input
                        type="text"
                        value={form.ambulance}
                        onChange={(event) => updateField('ambulance', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                      />
                    </label>
                    <label className="text-sm font-semibold text-[#334155]">
                      Police
                      <input
                        type="text"
                        value={form.police}
                        onChange={(event) => updateField('police', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                      />
                    </label>
                    <label className="text-sm font-semibold text-[#334155] sm:col-span-2">
                      Help Center
                      <input
                        type="text"
                        value={form.helpCenter}
                        onChange={(event) => updateField('helpCenter', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFormOpen(false)
                        setEditingId(null)
                        setSaveError('')
                      }}
                      className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveForm()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />}
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {sosHistoryOpen && (
        <SettingsModal
          icon={faClockRotateLeft}
          title="SOS Alert History"
          subtitle="Every alert raised by a passenger or driver, with the report export."
          onClose={() => setSosHistoryOpen(false)}
        >
          <SosHistoryPanel />
        </SettingsModal>
      )}

      {broadcastOpen && (
        <SettingsModal
          icon={faBullhorn}
          title="Send Notification"
          subtitle="Compose a notice and deliver it to whole audiences at once."
          onClose={() => setBroadcastOpen(false)}
        >
          <SendNotificationPanel />
        </SettingsModal>
      )}

      {supportContactModalOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" />
      )}

      {supportContactModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setSupportContactModalOpen(false)}
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#334155]"
              aria-label="Close support contact editor"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>

            <div className="p-6">
              <div className="flex items-center gap-3 pr-10">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
                  <FontAwesomeIcon icon={faHeadset} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#111827]">Corporate Support Contact</h2>
                  <p className="text-sm text-[#64748b]">
                    Shown to corporate clients while their contract request is under review.
                  </p>
                </div>
              </div>

              {supportContactSaveError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {supportContactSaveError}
                </div>
              )}

              <div className="mt-4 space-y-4">
                <label className="block text-sm font-semibold text-[#334155]">
                  Name
                  <input
                    type="text"
                    value={supportContactForm.name}
                    onChange={(event) => setSupportContactForm((cur) => ({ ...cur, name: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  />
                </label>
                <label className="block text-sm font-semibold text-[#334155]">
                  Role / Title
                  <input
                    type="text"
                    value={supportContactForm.role}
                    onChange={(event) => setSupportContactForm((cur) => ({ ...cur, role: event.target.value }))}
                    placeholder="e.g. Corporate Support Manager"
                    className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  />
                </label>
                <label className="block text-sm font-semibold text-[#334155]">
                  Phone
                  <input
                    type="tel"
                    value={supportContactForm.phone}
                    onChange={(event) => setSupportContactForm((cur) => ({ ...cur, phone: event.target.value }))}
                    placeholder="+94..."
                    className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSupportContactModalOpen(false)}
                  className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-bold text-[#334155] transition hover:bg-[#f1f5f9]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveSupportContact()}
                  disabled={supportContactSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {supportContactSaving && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />}
                  {supportContactSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Settings
