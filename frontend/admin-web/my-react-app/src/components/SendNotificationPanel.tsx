import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faCheck,
  faPaperPlane,
  faSpinner,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import {
  audienceLabels,
  categoryLabels,
  fetchAudienceCounts,
  sendBroadcast,
  type AudienceCounts,
  type BroadcastAudience,
  type BroadcastCategory,
  type BroadcastResult,
} from '../services/adminBroadcastService'

const TITLE_LIMIT = 255
const MESSAGE_LIMIT = 2000

const AUDIENCES: BroadcastAudience[] = ['passengers', 'drivers', 'corporate']
const CATEGORIES: BroadcastCategory[] = ['system_alert', 'promotion', 'journey']

export default function SendNotificationPanel() {
  const [counts, setCounts] = useState<AudienceCounts | null>(null)
  const [countsError, setCountsError] = useState('')
  const [audiences, setAudiences] = useState<BroadcastAudience[]>([])
  const [category, setCategory] = useState<BroadcastCategory>('system_alert')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BroadcastResult | null>(null)

  useEffect(() => {
    let active = true
    void fetchAudienceCounts()
      .then((loaded) => { if (active) setCounts(loaded) })
      .catch((loadError: unknown) => {
        // The counts are guidance, not a gate: a send still works without them.
        if (active) setCountsError(loadError instanceof Error ? loadError.message : 'Could not load audience sizes')
      })
    return () => { active = false }
  }, [])

  const recipientCount = useMemo(() => {
    if (!counts) return null
    return audiences.reduce((total, audience) => total + (counts[audience] ?? 0), 0)
  }, [audiences, counts])

  const validationError = useMemo(() => {
    if (audiences.length === 0) return 'Choose at least one audience.'
    if (!title.trim()) return 'Enter a title.'
    if (!message.trim()) return 'Enter a message.'
    return ''
  }, [audiences, title, message])

  function toggleAudience(audience: BroadcastAudience) {
    setResult(null)
    setConfirming(false)
    setAudiences((current) => current.includes(audience)
      ? current.filter((item) => item !== audience)
      : [...current, audience])
  }

  function beginConfirm() {
    setError('')
    if (validationError) {
      setError(validationError)
      return
    }
    setResult(null)
    setConfirming(true)
  }

  async function send() {
    try {
      setSending(true)
      setError('')
      const sent = await sendBroadcast({
        audiences,
        notificationType: category,
        title: title.trim(),
        message: message.trim(),
      })
      setResult(sent)
      setConfirming(false)
      setTitle('')
      setMessage('')
      setAudiences([])
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the notification')
      setConfirming(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Send to</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {AUDIENCES.map((audience) => {
            const selected = audiences.includes(audience)
            return (
              <button
                key={audience}
                type="button"
                onClick={() => toggleAudience(audience)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-[#2642a6] bg-[#eef2ff] shadow-[0_0_0_1px_#2642a6]'
                    : 'border-[#e5e7eb] bg-white hover:border-[#c7d2fe]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#111827]">{audienceLabels[audience]}</span>
                  <span className={`grid h-5 w-5 place-items-center rounded-md border ${
                    selected ? 'border-[#2642a6] bg-[#2642a6] text-white' : 'border-[#cbd5e1] text-transparent'
                  }`}>
                    <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
                  </span>
                </span>
                <span className="mt-1 block text-xs text-[#64748b]">
                  {counts ? `${counts[audience].toLocaleString()} active accounts` : 'Counting...'}
                </span>
              </button>
            )
          })}
        </div>
        {countsError ? (
          <p className="mt-2 text-xs font-semibold text-[#b45309]">{countsError}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
          Title
          <input
            value={title}
            maxLength={TITLE_LIMIT}
            onChange={(event) => { setTitle(event.target.value); setConfirming(false) }}
            placeholder="Service update for tomorrow"
            className="mt-1 block w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm font-medium text-[#334155] outline-none focus:border-[#2642a6]"
          />
          <span className="mt-1 block text-right text-[11px] font-medium normal-case text-[#94a3b8]">
            {title.length}/{TITLE_LIMIT}
          </span>
        </label>

        <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as BroadcastCategory)}
            className="mt-1 block w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm font-medium text-[#334155]"
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>{categoryLabels[value]}</option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] font-medium normal-case text-[#94a3b8]">
            Decides which tab it lands in.
          </span>
        </label>
      </div>

      <label className="block text-xs font-semibold uppercase tracking-wide text-[#64748b]">
        Message
        <textarea
          value={message}
          maxLength={MESSAGE_LIMIT}
          rows={5}
          onChange={(event) => { setMessage(event.target.value); setConfirming(false) }}
          placeholder="Buses on the Colombo - Kandy route will run 30 minutes later than scheduled tomorrow morning."
          className="mt-1 block w-full resize-y rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm font-medium leading-6 text-[#334155] outline-none focus:border-[#2642a6]"
        />
        <span className="mt-1 block text-right text-[11px] font-medium normal-case text-[#94a3b8]">
          {message.length}/{MESSAGE_LIMIT}
        </span>
      </label>

      {(title.trim() || message.trim()) ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Preview</p>
          <div className="mt-2 flex gap-3 rounded-lg border border-[#e5e7eb] bg-white p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
              <FontAwesomeIcon icon={faBell} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#111827]">{title.trim() || 'Untitled notification'}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-[#475569]">{message.trim()}</p>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-[#dc2626]">
          <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
          {error}
        </p>
      ) : null}

      {result ? (
        <p className="rounded-lg bg-[#ecfdf5] px-3 py-2 text-sm font-semibold text-[#0f766e]">
          <FontAwesomeIcon icon={faCheck} className="mr-2" />
          Sent to {result.total.toLocaleString()} recipients
          {` (${result.passengers} passengers, ${result.drivers} drivers, ${result.corporate} corporate).`}
        </p>
      ) : null}

      {/*
        A broadcast lands in thousands of feeds and cannot be recalled, so the send is
        held behind an explicit confirmation that states how many people it reaches.
      */}
      {confirming ? (
        <div className="rounded-xl border border-[#fcd34d] bg-[#fffbeb] p-4">
          <p className="text-sm font-bold text-[#92400e]">
            Send &ldquo;{title.trim()}&rdquo; to{' '}
            {recipientCount === null ? 'the selected audiences' : `${recipientCount.toLocaleString()} people`}?
          </p>
          <p className="mt-1 text-sm text-[#b45309]">
            {audiences.map((audience) => audienceLabels[audience]).join(', ')}. This cannot be undone.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#b45309] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#92400e] disabled:opacity-60"
            >
              <FontAwesomeIcon icon={sending ? faSpinner : faPaperPlane} className={sending ? 'animate-spin' : ''} />
              {sending ? 'Sending...' : 'Yes, send now'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={sending}
              className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={beginConfirm}
            disabled={sending || Boolean(validationError)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
            Review and send
          </button>
          <p className="text-sm text-[#64748b]">
            {validationError
              || (recipientCount === null
                ? 'Ready to send.'
                : `Reaches ${recipientCount.toLocaleString()} ${recipientCount === 1 ? 'person' : 'people'}.`)}
          </p>
        </div>
      )}
    </div>
  )
}
