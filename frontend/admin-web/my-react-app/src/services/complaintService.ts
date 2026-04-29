const API_BASE = '/api/admin/complaints'

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body: ApiResponse<T> = await res.json()
  if (!res.ok || !body.success) {
    throw new Error(body.message || 'Request failed')
  }
  return body.data
}

export type AdminComplaint = {
  id: string
  priority: 'High' | 'Medium' | 'Low' | string
  type: string
  passengerName: string
  passengerInitials: string
  description: string
  bookingId: string
  busId: string
  driverName: string
  hasImages: boolean
  imageType: 'camera' | 'gallery' | 'none'
  status: 'Pending' | 'Under Review' | 'Resolved' | 'Rejected' | string
  created: string
  createdAt: string | null
  createdSort: number
}

export type AdminComplaintDetail = {
  id: string
  priority: 'High' | 'Medium' | 'Low' | string
  type: string
  status: 'Pending' | 'Under Review' | 'Resolved' | 'Rejected' | string
  created: string
  createdAt: string | null
  description: string
  bookingId: string
  busId: string
  passengerName: string
  passengerPhoneNumber: string
  driverName: string
  driverPhoneNumber: string
  adminResponse: string
  images: string[]
}

/** Loads the complaint list shown on the admin dashboard. */
export async function fetchComplaints(): Promise<AdminComplaint[]> {
  const res = await fetch(API_BASE)
  return handleResponse<AdminComplaint[]>(res)
}

/** Loads the detail view for a single complaint after stripping its display prefix. */
export async function fetchComplaintDetail(complaintId: string): Promise<AdminComplaintDetail> {
  const numericId = complaintId.replace(/^\D+/, '')
  const res = await fetch(`${API_BASE}/${numericId}`)
  return handleResponse<AdminComplaintDetail>(res)
}

/** Sends an admin complaint status update and optional response to the backend. */
export async function updateComplaint(
  complaintId: string,
  payload: { status: string; adminResponse: string },
): Promise<void> {
  const numericId = complaintId.replace(/^\D+/, '')
  const res = await fetch(`${API_BASE}/${numericId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  await handleResponse<null>(res)
}
