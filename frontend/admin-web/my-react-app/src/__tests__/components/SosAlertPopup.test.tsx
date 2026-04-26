import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SosAlertPopup, {
  formatTime,
  parseGps,
} from '../../components/SosAlertPopup'
import {
  fetchActiveEmergencyNumbers,
  fetchActiveSosAlerts,
  updateSosAlertStatus,
  type EmergencyServiceNumbers,
  type SosAlertData,
} from '../../services/sosAlertService'

vi.mock('../../services/sosAlertService', () => ({
  SOS_API_BASE: 'http://127.0.0.1:8080',
  fetchActiveSosAlerts: vi.fn(),
  fetchActiveEmergencyNumbers: vi.fn(),
  updateSosAlertStatus: vi.fn(),
}))

const mockedFetchActiveSosAlerts = vi.mocked(fetchActiveSosAlerts)
const mockedFetchActiveEmergencyNumbers = vi.mocked(fetchActiveEmergencyNumbers)
const mockedUpdateSosAlertStatus = vi.mocked(updateSosAlertStatus)

describe('SosAlertPopup', () => {
  /** Resets SOS popup mocks and applies default alert plus emergency-number fixtures. */
  beforeEach(() => {
    vi.clearAllMocks()
    mockedFetchActiveSosAlerts.mockResolvedValue([buildAlert(), buildAlert({ sosId: 89, passengerName: 'Bimal Fernando' })])
    mockedFetchActiveEmergencyNumbers.mockResolvedValue(buildEmergencyNumbers())
    mockedUpdateSosAlertStatus.mockResolvedValue()
  })

  /** Verifies that the popup loads SOS details and emergency-service shortcuts for the active alert. */
  it('loads SOS alerts and renders the primary alert details', async () => {
    render(<SosAlertPopup />)

    await waitFor(() => expect(mockedFetchActiveSosAlerts).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockedFetchActiveEmergencyNumbers).toHaveBeenCalledTimes(1))

    expect(screen.getByText('SOS ALERT - EMERGENCY')).toBeInTheDocument()
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0)
    expect(screen.getByText(/Passenger:/)).toBeInTheDocument()
    expect(screen.getByText('NB-17 / Colombo to Kandy')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ambulance 1990' })).toHaveAttribute('href', 'tel:1990')
    expect(screen.getByRole('link', { name: '0711111111' })).toHaveAttribute('href', 'tel:0711111111')
  })

  /** Verifies that the popup can be minimized into a badge and reopened again. */
  it('minimizes and expands the SOS popup', async () => {
    render(<SosAlertPopup />)

    await waitFor(() => expect(screen.getByTitle('Minimize alert')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Minimize alert'))

    expect(screen.getByRole('button', { name: /Click to expand/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Click to expand/i }))

    expect(screen.getByText('SOS ALERT - EMERGENCY')).toBeInTheDocument()
  })

  /** Verifies that resolving an SOS alert calls the update service and removes that alert from the popup list. */
  it('updates SOS status and removes the handled alert from the popup', async () => {
    mockedFetchActiveSosAlerts.mockResolvedValueOnce([buildAlert()])

    render(<SosAlertPopup />)

    await waitFor(() => expect(screen.getByLabelText('SOS status action')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('SOS status action'), {
      target: { value: 'resolve' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(mockedUpdateSosAlertStatus).toHaveBeenCalledWith(88, 'resolve'))
    await waitFor(() => expect(screen.queryByText('SOS ALERT - EMERGENCY')).not.toBeInTheDocument())
  })

  /** Verifies that helper utilities keep GPS parsing and SOS time formatting stable. */
  it('maps SOS helper values correctly', () => {
    expect(parseGps('6.927079, 79.861244 - Logged user location')).toEqual({
      lat: 6.927079,
      lng: 79.861244,
      label: 'Logged user location',
    })
    expect(parseGps('location unavailable')).toBeNull()
    expect(formatTime('2026-04-26T09:30:00')).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  /** Builds the SOS alert fixture used across popup component tests. */
  function buildAlert(overrides: Partial<SosAlertData> = {}): SosAlertData {
    return {
      sosId: 88,
      sharedLocation: '6.927079, 79.861244 - Logged user location',
      status: 'triggered',
      triggeredAt: '2026-04-26T09:30:00',
      resolvedAt: null,
      passengerId: 15,
      driverId: 90,
      triggeredByType: 'passenger',
      name: 'Jane Doe',
      phoneNumber: '0712345678',
      profilePhoto: null,
      routeName: 'Colombo-Kandy Express',
      busNumber: 'NB-17',
      startLocation: 'Colombo',
      endLocation: 'Kandy',
      passengerName: 'Jane Doe',
      passengerPhoneNumber: '0712345678',
      driverName: 'Nimal Silva',
      driverPhoneNumber: '0771234567',
      emergencyContacts: [
        {
          contactId: 1,
          name: 'Alice',
          teleNumber: '0711111111',
          relationship: 'Sister',
        },
      ],
      ...overrides,
    }
  }

  /** Builds the emergency-number fixture used for SOS shortcut rendering. */
  function buildEmergencyNumbers(): Partial<EmergencyServiceNumbers> {
    return {
      ambulance: '1990',
      police: '119',
      fireBrigade: '110',
    }
  }
})
