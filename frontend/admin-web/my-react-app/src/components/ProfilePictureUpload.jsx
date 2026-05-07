import { useMemo, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'

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

export default function ProfilePictureUpload({ currentImageUrl = '', onUploadSuccess }) {
  const fileInputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [sizeInfo, setSizeInfo] = useState('')
  const [previewUrl, setPreviewUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || currentImageUrl)

  const effectivePreview = useMemo(() => previewUrl || currentImageUrl, [previewUrl, currentImageUrl])

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
        onUploadSuccess(publicUrl, data)
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload profile picture.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full border border-[#dbe2ea] bg-[#f1f5f9]">
          {effectivePreview ? (
            <img src={effectivePreview} alt="Admin profile" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs font-semibold text-[#64748b]">No Photo</div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[#111827]">Profile Picture</h3>
          <p className="text-xs text-[#64748b]">JPEG, PNG, or WebP. Processed to high-quality WebP before upload.</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center rounded-lg bg-[#2642a6] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? 'Processing...' : 'Upload New Photo'}
          </button>
        </div>
      </div>

      {sizeInfo ? <p className="mt-3 text-xs font-medium text-[#0f766e]">{sizeInfo}</p> : null}
      {error ? <p className="mt-3 text-xs font-medium text-[#dc2626]">{error}</p> : null}
    </div>
  )
}
