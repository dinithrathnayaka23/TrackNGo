import { useEffect, useMemo, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faTrash, faUser } from '@fortawesome/free-solid-svg-icons'
import adminProfileImage from '../assets/images/adminProfilePlaceholder.svg'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const TARGET_DIMENSION = 800
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const FINAL_TARGET_BYTES = 200 * 1024
const STORAGE_KEY = 'adminProfilePhoto'

function ensureWebpName(fileName) {
  const withoutExt = fileName.replace(/\.[^.]+$/, '')
  return `${withoutExt || 'profile-picture'}.webp`
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to read the selected image.'))
    }

    image.src = objectUrl
  })
}

function canvasToWebpBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to convert canvas output.'))
          return
        }
        resolve(blob)
      },
      'image/webp',
      0.92,
    )
  })
}

async function resizeWithCanvas(file) {
  const image = await loadImageFromFile(file)
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
  const scale = longestSide > TARGET_DIMENSION ? TARGET_DIMENSION / longestSide : 1

  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale))
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is not available in this browser.')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

  const webpBlob = await canvasToWebpBlob(canvas)
  return new File([webpBlob], ensureWebpName(file.name), {
    type: 'image/webp',
    lastModified: Date.now(),
  })
}

async function processImageForUpload(file) {
  const resized = await resizeWithCanvas(file)

  const compressed = await imageCompression(resized, {
    maxSizeMB: 1,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.9,
  })

  if (compressed.size <= FINAL_TARGET_BYTES) {
    return new File([compressed], ensureWebpName(file.name), {
      type: 'image/webp',
      lastModified: Date.now(),
    })
  }

  const tightened = await imageCompression(compressed, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.88,
  })

  return new File([tightened], ensureWebpName(file.name), {
    type: 'image/webp',
    lastModified: Date.now(),
  })
}

export default function ProfilePictureUpload({ currentImageUrl = '', onUploadSuccess, onRemoveSuccess }) {
  const fileInputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')
  const [sizeInfo, setSizeInfo] = useState('')
  const [previewUrl, setPreviewUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || currentImageUrl || adminProfileImage)

  const effectivePreview = useMemo(() => previewUrl || currentImageUrl || adminProfileImage, [previewUrl, currentImageUrl])
  // Keyed to what is stored rather than to what renders, so a photo whose URL no longer
  // loads can still be cleared instead of being stuck behind the placeholder.
  const storedPhoto = localStorage.getItem(STORAGE_KEY) || currentImageUrl
  const hasPhoto = Boolean(storedPhoto) && storedPhoto !== adminProfileImage

  useEffect(() => {
    setPreviewUrl(localStorage.getItem(STORAGE_KEY) || currentImageUrl || adminProfileImage)
  }, [currentImageUrl])

  async function handleFileChange(event) {
    const selected = event.target.files?.[0]
    event.target.value = ''

    if (!selected) return
    if (!ALLOWED_TYPES.has(selected.type)) {
      setError('Please select a JPEG, PNG, or WebP image.')
      return
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setError('Please select an image smaller than 10MB.')
      return
    }

    setError('')
    setSizeInfo('')
    setIsUploading(true)

    try {
      const processedFile = await processImageForUpload(selected)

      const formData = new FormData()
      formData.append('file', processedFile)

      const token = localStorage.getItem('jwtToken')
      const response = await fetch('/api/profile/picture', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = payload?.message || 'Failed to upload profile picture.'
        throw new Error(message)
      }

      const data = payload?.data ?? payload
      const publicUrl = data?.originalUrl || data?.imageUrl || data?.thumbnailUrl || data?.url
      if (!publicUrl) {
        throw new Error('Upload completed but no image URL was returned.')
      }

      const displayUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
      localStorage.setItem(STORAGE_KEY, displayUrl)
      window.dispatchEvent(new CustomEvent('admin-profile-photo-updated', { detail: displayUrl }))
      setPreviewUrl(displayUrl)
      setSizeInfo(`Uploaded ${Math.round(processedFile.size / 1024)} KB`)

      if (typeof onUploadSuccess === 'function') {
        onUploadSuccess(displayUrl, data)
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload profile picture.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove your profile picture? This cannot be undone.')) return

    setError('')
    setSizeInfo('')
    setIsRemoving(true)

    try {
      const token = localStorage.getItem('jwtToken')
      const response = await fetch('/api/profile/picture', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to remove profile picture.')
      }

      // The header avatar reads the same cached URL, so it is cleared and told to refresh.
      localStorage.removeItem(STORAGE_KEY)
      window.dispatchEvent(new CustomEvent('admin-profile-photo-updated', { detail: null }))
      setPreviewUrl(adminProfileImage)
      setSizeInfo('Profile picture removed')

      if (typeof onRemoveSuccess === 'function') {
        onRemoveSuccess()
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove profile picture.')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#2642a6]">
            <FontAwesomeIcon icon={faUser} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#111827]">Profile Picture</h2>
            <p className="mt-1 text-sm text-[#64748b]">Keep your admin profile up to date</p>
          </div>
        </div>
        <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold text-[#64748b]">Admin</span>
      </div>

      <div className="mt-5 flex flex-1 items-center gap-5 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#eef2ff] object-cover shadow-[0_0_0_1px_#cfd8f5,0_6px_14px_rgba(38,66,166,0.12)]">
          <img
            src={effectivePreview}
            alt="Admin profile"
            onError={(event) => {
              event.currentTarget.onerror = null
              event.currentTarget.src = adminProfileImage
              localStorage.removeItem(STORAGE_KEY)
              setPreviewUrl(adminProfileImage)
            }}
            className="h-full w-full rounded-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111827]">Your profile photo</p>
          <p className="mt-1 text-xs leading-5 text-[#64748b]">JPEG, PNG, or WebP. Images are optimized automatically.</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isUploading || isRemoving}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FontAwesomeIcon icon={faCamera} className="text-xs" />
              {isUploading ? 'Processing...' : 'Upload New Photo'}
            </button>

            {hasPhoto ? (
              <button
                type="button"
                disabled={isUploading || isRemoving}
                onClick={handleRemove}
                className="inline-flex items-center gap-2 rounded-lg border border-[#fecaca] bg-white px-4 py-2 text-sm font-semibold text-[#dc2626] transition hover:-translate-y-0.5 hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faTrash} className="text-xs" />
                {isRemoving ? 'Removing...' : 'Remove Photo'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {sizeInfo ? <p className="mt-3 rounded-lg bg-[#ecfdf5] px-3 py-2 text-xs font-semibold text-[#0f766e]">{sizeInfo}</p> : null}
      {error ? <p className="mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-xs font-semibold text-[#dc2626]">{error}</p> : null}
    </div>
  )
}
