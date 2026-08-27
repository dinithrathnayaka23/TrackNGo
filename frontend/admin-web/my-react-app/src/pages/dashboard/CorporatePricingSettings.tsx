import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCircleInfo, faFloppyDisk, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchCorporatePricingSettings,
  updateCorporatePricingSettings,
  type CorporatePricingSettings,
} from '../../services/corporateService'

type FormState = Record<keyof Omit<CorporatePricingSettings, 'updatedAt'>, string>

const FIELDS: Array<{
  key: keyof FormState
  label: string
  hint: string
  suffix?: string
  step?: string
}> = [
  { key: 'standardBusRatePerKm', label: 'Standard Bus rate per km', hint: 'Base rate per km for Standard Bus contracts (includes fuel, driver, maintenance).', suffix: 'Rs / km', step: '0.01' },
  { key: 'miniBusRatePerKm', label: 'Mini Rosa Bus rate per km', hint: 'Base rate per km for Mini Rosa Bus contracts (includes fuel, driver, maintenance).', suffix: 'Rs / km', step: '0.01' },
  { key: 'acSurchargePercent', label: 'AC surcharge', hint: 'Percentage surcharge added to the monthly transport cost for AC contracts.', suffix: '%', step: '0.01' },
  { key: 'platformFeePercent', label: 'Platform / service fee', hint: 'Platform fee percentage added to the subtotal.', suffix: '%', step: '0.01' },
  { key: 'taxPercent', label: 'Tax', hint: 'Tax percentage applied to (subtotal + platform fee). Set to 0 if not applicable.', suffix: '%', step: '0.01' },
  { key: 'weekdaysPerMonth', label: 'Weekdays per month', hint: 'Service days used for contracts running Monday–Friday.', suffix: 'days', step: '1' },
  { key: 'allDaysPerMonth', label: 'All-days per month', hint: 'Service days used for contracts running every day.', suffix: 'days', step: '1' },
]

function toForm(settings: CorporatePricingSettings): FormState {
  return {
    standardBusRatePerKm: String(settings.standardBusRatePerKm),
    miniBusRatePerKm: String(settings.miniBusRatePerKm),
    acSurchargePercent: String(settings.acSurchargePercent),
    platformFeePercent: String(settings.platformFeePercent),
    taxPercent: String(settings.taxPercent),
    weekdaysPerMonth: String(settings.weekdaysPerMonth),
    allDaysPerMonth: String(settings.allDaysPerMonth),
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Never'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function CorporatePricingSettingsPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setLoadError(null)
    fetchCorporatePricingSettings()
      .then((settings) => {
        setForm(toForm(settings))
        setUpdatedAt(settings.updatedAt)
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load pricing settings.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        standardBusRatePerKm: Number(form.standardBusRatePerKm),
        miniBusRatePerKm: Number(form.miniBusRatePerKm),
        acSurchargePercent: Number(form.acSurchargePercent),
        platformFeePercent: Number(form.platformFeePercent),
        taxPercent: Number(form.taxPercent),
        weekdaysPerMonth: Number(form.weekdaysPerMonth),
        allDaysPerMonth: Number(form.allDaysPerMonth),
      }
      if (Object.values(payload).some((v) => !Number.isFinite(v))) {
        throw new Error('All fields must be valid numbers.')
      }
      const updated = await updateCorporatePricingSettings(payload)
      setForm(toForm(updated))
      setUpdatedAt(updated.updatedAt)
      setToastMessage('Pricing settings saved. New contracts will use the updated rates immediately.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save pricing settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[820px]">
      <button
        type="button"
        onClick={() => navigate('/dashboard/corporate/contracts')}
        className="mb-5 grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] bg-white text-[#334155] transition hover:bg-[#f1f5f9]"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
      </button>

      <header className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Corporate Pricing Settings</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          These rates drive the standard monthly billing formula for corporate employee transportation in Sri Lanka.
        </p>
      </header>

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] p-4">
        <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 text-[#2563eb]" />
        <div className="text-sm text-[#1e3a8a]">
          <p className="font-semibold">Pricing Formula</p>
          <p className="mt-1 leading-relaxed text-xs">
            1. <strong>Monthly Transport Cost</strong> = Rate per km (Standard / Mini Rosa) × Daily Distance × Service Days per Month<br />
            2. <strong>Subtotal</strong> = Monthly Transport Cost + (AC Surcharge % if AC)<br />
            3. <strong>Platform Fee</strong> = Subtotal × Platform Fee %<br />
            4. <strong>Tax</strong> = (Subtotal + Platform Fee) × Tax %<br />
            5. <strong>Final Amount</strong> = Subtotal + Platform Fee + Tax
          </p>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-16 text-center text-sm text-[#64748b]">
          <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
          Loading pricing settings...
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-2xl border border-red-200 bg-white px-4 py-12 text-center">
          <p className="text-sm font-semibold text-red-700">{loadError}</p>
          <button type="button" onClick={load} className="mt-3 text-sm font-semibold text-[#2642a6] hover:text-[#203b96]">
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && form && (
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-sm font-semibold text-[#334155]">{field.label}</span>
                <div className="flex items-center gap-2 rounded-xl border border-[#d6dbe6] px-3 focus-within:border-[#2642a6] focus-within:ring-2 focus-within:ring-[#2642a6]/20">
                  <input
                    type="number"
                    step={field.step}
                    min="0"
                    value={form[field.key]}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className="w-full bg-transparent py-2.5 text-sm outline-none"
                  />
                  {field.suffix && <span className="shrink-0 text-xs font-medium text-[#94a3b8]">{field.suffix}</span>}
                </div>
                <p className="mt-1 text-xs text-[#94a3b8]">{field.hint}</p>
              </label>
            ))}
          </div>

          {saveError && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{saveError}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#f1f5f9] pt-5">
            <p className="text-xs text-[#94a3b8]">Last updated: {formatDate(updatedAt)}</p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2642a6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#203b96] disabled:cursor-wait disabled:opacity-60"
            >
              <FontAwesomeIcon icon={saving ? faSpinner : faFloppyDisk} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-[#d6dbe6] bg-white px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-[#334155]">{toastMessage}</p>
          <button type="button" onClick={() => setToastMessage(null)} className="text-[#64748b]">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default CorporatePricingSettingsPage
