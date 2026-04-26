import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchActiveEmergencyNumbers,
  fetchActiveSosAlerts,
  readApiResponse,
  updateSosAlertStatus,
} from '../../services/sosAlertService'

describe('sosAlertService', () => {
  /** Restores fetch state before each SOS service test. */
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /** Verifies that the SOS response parser unwraps valid JSON envelopes. */
  it('readApiResponse parses the backend SOS response envelope', async () => {
    const result = await readApiResponse<string[]>({
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          success: true,
          message: 'Fetched',
          data: ['ok'],
        }),
      ),
    } as unknown as Response)

    expect(result).toEqual({
      success: true,
      message: 'Fetched',
      data: ['ok'],
    })
  })

  /** Verifies that active SOS alerts are loaded from the admin alert endpoint. */
  it('fetchActiveSosAlerts returns the active SOS alert list', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, [{ sosId: 88, status: 'triggered' }]),
    )

    const result = await fetchActiveSosAlerts()

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8080/api/sos-alerts/active')
    expect(result).toEqual([{ sosId: 88, status: 'triggered' }])
  })

  /** Verifies that emergency-service number failures fall back to a null result. */
  it('fetchActiveEmergencyNumbers returns null when the backend response is unsuccessful', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, false, null, 'Unavailable'),
    )

    await expect(fetchActiveEmergencyNumbers()).resolves.toBeNull()
  })

  /** Verifies that SOS status updates call the selected resolve or dismiss endpoint with PUT. */
  it('updateSosAlertStatus sends a put request to the selected SOS action endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, null),
    )

    await updateSosAlertStatus(88, 'resolve')

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8080/api/sos-alerts/88/resolve', {
      method: 'PUT',
    })
  })

  /** Verifies that failed SOS status updates surface a readable error. */
  it('updateSosAlertStatus throws when the backend update fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(false, false, null, 'Failed'),
    )

    await expect(updateSosAlertStatus(88, 'dismiss')).rejects.toThrow('Failed to update SOS alert status')
  })

  /** Builds a fetch-like response object for SOS service tests. */
  function buildResponse(ok: boolean, success: boolean, data: unknown, message = 'OK'): Response {
    return {
      ok,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          success,
          message,
          data,
        }),
      ),
    } as unknown as Response
  }
})
