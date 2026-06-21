import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchComplaintDetail,
  fetchComplaints,
  updateComplaint,
} from '../../services/complaintService'

describe('complaintService', () => {
  /** Resets the global fetch mock before each complaint service test. */
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /** Verifies that the admin complaint list request targets the list endpoint and unwraps the response. */
  it('fetchComplaints returns the complaint list data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, [{ id: '#CP-0001', priority: 'High' }]),
    )

    const result = await fetchComplaints()

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/complaints')
    expect(result).toEqual([{ id: '#CP-0001', priority: 'High' }])
  })

  /** Verifies that complaint detail requests strip the display id prefix before calling the API. */
  it('fetchComplaintDetail strips the complaint prefix from the id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, { id: '#CP-0042', type: 'Safety Concern' }),
    )

    const result = await fetchComplaintDetail('#CP-0042')

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/complaints/0042')
    expect(result).toEqual({ id: '#CP-0042', type: 'Safety Concern' })
  })

  /** Verifies that complaint updates use PUT and send the normalized admin payload. */
  it('updateComplaint sends a put request with the serialized payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, null),
    )

    await updateComplaint('#CP-0042', {
      status: 'under_review',
      adminResponse: 'Investigating now.',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/complaints/0042', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'under_review',
        adminResponse: 'Investigating now.',
      }),
    })
  })

  /** Verifies that unsuccessful complaint responses surface the backend error message. */
  it('throws when the backend reports an unsuccessful complaint response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, false, null, 'Complaint not found'),
    )

    await expect(fetchComplaints()).rejects.toThrow('Complaint not found')
  })

  /** Builds a fetch-like response object for service tests. */
  function buildResponse(ok: boolean, success: boolean, data: unknown, message = 'OK'): Response {
    return {
      ok,
      json: vi.fn().mockResolvedValue({
        success,
        message,
        data,
      }),
    } as unknown as Response
  }
})
