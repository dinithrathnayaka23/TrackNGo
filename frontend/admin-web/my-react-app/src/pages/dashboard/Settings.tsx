import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faCheckCircle,
  faGear,
  faPen,
  faPhoneVolume,
  faPlus,
  faSpinner,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import {
  createEmergencyNumber,
  fetchEmergencyNumbers,
  updateEmergencyNumber,
  type EmergencyNumber,
  type SaveEmergencyNumberRequest,
} from '../../services/emergencyNumberService'

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

function Settings() {
  const [modalOpen, setModalOpen] = useState(false)
  const [rows, setRows] = useState<EmergencyNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<SaveEmergencyNumberRequest>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const activeRow = rows.find((row) => row.isActive)

  async function loadRows() {
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
  }

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
          <article className="dashboard-card rounded-xl border border-[#e5e7eb] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
                <FontAwesomeIcon icon={faPhoneVolume} />
              </div>
              <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-bold text-[#64748b]">
                SOS
              </span>
            </div>

            <div className="mt-5">
              <h2 className="text-lg font-extrabold text-[#111827]">Configure Emergency Numbers</h2>
              <p className="mt-1 text-sm text-[#64748b]">
                {activeRow ? `Active: ${activeRow.label}` : 'No active row loaded'}
              </p>
            </div>

            <button
              type="button"
              onClick={openModal}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
            >
              Go
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </button>
          </article>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
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
                    <h2 className="text-xl font-extrabold text-[#111827]">Emergency Numbers</h2>
                    <p className="text-sm text-[#64748b]">{rows.length} rows</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openAddForm}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#203b96]"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  Add New
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-[#e5e7eb]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e5e7eb] bg-[#f8fafc] text-left text-xs font-bold uppercase text-[#64748b]">
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
                          <td className="px-4 py-3 text-[#475569]">{row.fireBrigade}</td>
                          <td className="px-4 py-3 text-[#475569]">{row.ambulance}</td>
                          <td className="px-4 py-3 text-[#475569]">{row.police}</td>
                          <td className="px-4 py-3 text-[#475569]">{row.helpCenter}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${activeBadge(row.isActive)}`}>
                              {row.isActive && <FontAwesomeIcon icon={faCheckCircle} className="text-[10px]" />}
                              {row.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEditForm(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d6dbe6] bg-white px-3 py-1.5 text-xs font-bold text-[#334155] transition hover:bg-[#f1f5f9]"
                            >
                              <FontAwesomeIcon icon={faPen} className="text-[10px]" />
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
                <div className="mt-5 rounded-xl border border-[#d6dbe6] bg-[#f8fafc] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-extrabold text-[#111827]">
                      {editingId ? 'Edit Emergency Row' : 'Add Emergency Row'}
                    </h3>
                    <label className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#334155]">
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
                      className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-bold text-[#334155] transition hover:bg-[#f1f5f9]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveForm()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-60"
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
    </>
  )
}

export default Settings
