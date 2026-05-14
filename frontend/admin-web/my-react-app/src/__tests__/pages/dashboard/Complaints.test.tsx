import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Complaints, {
  formatCreatedDate,
  resolveImageUrl,
  toApiStatus,
  toEditableStatus,
} from '../../../pages/dashboard/Complaints'
import {
  fetchComplaintDetail,
  fetchComplaints,
  updateComplaint,
  type AdminComplaint,
  type AdminComplaintDetail,
} from '../../../services/complaintService'

vi.mock('../../../services/complaintService', () => ({
  fetchComplaints: vi.fn(),
  fetchComplaintDetail: vi.fn(),
  updateComplaint: vi.fn(),
}))

vi.mock('jspdf', () => ({
  default: vi.fn(() => ({
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
  })),
}))

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}))

const mockedFetchComplaints = vi.mocked(fetchComplaints)
const mockedFetchComplaintDetail = vi.mocked(fetchComplaintDetail)
const mockedUpdateComplaint = vi.mocked(updateComplaint)

describe('Complaints page', () => {
  /** Resets complaint page mocks and applies the default complaint list before each test. */
  beforeEach(() => {
    vi.clearAllMocks()
    mockedFetchComplaints.mockResolvedValue(buildComplaintList())
    mockedFetchComplaintDetail.mockResolvedValue(buildComplaintDetail())
    mockedUpdateComplaint.mockResolvedValue()
  })

  /** Verifies that the complaints dashboard loads list data and shows complaint summary metrics. */
  it('loads complaints and displays dashboard counts', async () => {
    render(<Complaints />)

    expect(screen.getByText('Loading complaints...')).toBeInTheDocument()

    await waitFor(() => expect(mockedFetchComplaints).toHaveBeenCalledTimes(1))

    expect(screen.getByText('Complaints Management')).toBeInTheDocument()
    expect(screen.getByText('1 high priority')).toBeInTheDocument()
    expect(screen.getByText(/Showing/i)).toHaveTextContent('Showing 1-3 of 3 complaints')
    expect(screen.getByText('#CP-0001')).toBeInTheDocument()
    expect(screen.getByText('Alice Perera')).toBeInTheDocument()
  })

  /** Verifies that complaint filters narrow the visible results and keep matching rows only. */
  it('filters complaints by passenger name and status', async () => {
    render(<Complaints />)

    await waitFor(() => expect(mockedFetchComplaints).toHaveBeenCalled())

    fireEvent.change(screen.getAllByPlaceholderText('Passenger Name...')[0], {
      target: { value: 'Alice' },
    })
    fireEvent.change(screen.getByDisplayValue('All Statuses'), {
      target: { value: 'Pending' },
    })

    expect(screen.getByText('#CP-0001')).toBeInTheDocument()
    expect(screen.queryByText('#CP-0002')).not.toBeInTheDocument()
    expect(screen.getByText(/Showing/i)).toHaveTextContent('Showing 1-1 of 1 complaints')
  })

  /** Verifies that opening complaint detail loads the modal content and resolves relative image paths. */
  it('opens complaint detail and renders evidence images', async () => {
    render(<Complaints />)

    await waitFor(() => expect(mockedFetchComplaints).toHaveBeenCalled())

    fireEvent.click(screen.getAllByText('#CP-0001')[0])

    await waitFor(() => expect(mockedFetchComplaintDetail).toHaveBeenCalledWith('#CP-0001'))

    expect(screen.getByText('Complaint Description')).toBeInTheDocument()
    expect(screen.getByText('Bus door remained open.')).toBeInTheDocument()
    const evidenceLink = screen.getByLabelText('Open evidence image 1 in a new tab')
    expect(evidenceLink).toHaveAttribute('href', 'http://localhost:8080/uploads/evidence-1.jpg')
  })

  /** Verifies that saving a complaint triggers the update request and reloads the complaint data. */
  it('updates a complaint and refreshes the complaint data after saving', async () => {
    mockedFetchComplaints
      .mockResolvedValueOnce(buildComplaintList())
      .mockResolvedValueOnce(buildComplaintList())
    mockedFetchComplaintDetail
      .mockResolvedValueOnce(buildComplaintDetail())
      .mockResolvedValueOnce(buildComplaintDetail())

    render(<Complaints />)

    await waitFor(() => expect(mockedFetchComplaints).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getAllByText('#CP-0001')[0])

    await waitFor(() => expect(mockedFetchComplaintDetail).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() =>
      expect(mockedUpdateComplaint).toHaveBeenCalledWith('#CP-0001', {
        status: 'pending',
        adminResponse: '',
      }),
    )
    await waitFor(() => expect(mockedFetchComplaints).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockedFetchComplaintDetail).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Complaint Description')).toBeInTheDocument()
  })

  /** Verifies that helper utilities keep complaint formatting and status mapping predictable. */
  it('maps complaint helper values correctly', () => {
    expect(toEditableStatus('Resolved')).toBe('Resolved')
    expect(toEditableStatus('random')).toBe('Pending')
    expect(toApiStatus('Under Review')).toBe('under_review')
    expect(toApiStatus('Rejected')).toBe('rejected')
    expect(resolveImageUrl('/uploads/photo.jpg')).toBe('http://localhost:8080/uploads/photo.jpg')
    expect(resolveImageUrl('https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg')
    expect(formatCreatedDate(null)).toBe('--')
    expect(formatCreatedDate('not-a-date')).toBe('not-a-date')
    expect(formatCreatedDate('2026-04-21T09:00:00')).toContain('09:00')
  })

  /** Builds the complaint list fixture used across complaint page tests. */
  function buildComplaintList(firstStatus: AdminComplaint['status'] = 'Pending'): AdminComplaint[] {
    return [
      {
        id: '#CP-0001',
        priority: 'High',
        type: 'Safety Concern',
        passengerName: 'Alice Perera',
        passengerInitials: 'AP',
        description: 'Door issue on the bus.',
        bookingId: 'BK-1001',
        busId: 'NB-21',
        driverName: 'Nimal Silva',
        hasImages: true,
        imageType: 'gallery',
        status: firstStatus,
        created: 'Apr 21, 09:00 AM',
        createdAt: '2026-04-21T09:00:00',
        createdSort: 20260421090000,
      },
      {
        id: '#CP-0002',
        priority: 'Medium',
        type: 'Late Arrival',
        passengerName: 'Bimal Fernando',
        passengerInitials: 'BF',
        description: 'Bus came late.',
        bookingId: 'BK-1002',
        busId: 'NB-22',
        driverName: 'Kasun Perera',
        hasImages: false,
        imageType: 'none',
        status: 'Under Review',
        created: 'Apr 20, 08:30 AM',
        createdAt: '2026-04-20T08:30:00',
        createdSort: 20260420083000,
      },
      {
        id: '#CP-0003',
        priority: 'Low',
        type: 'Other',
        passengerName: 'Chathuri Silva',
        passengerInitials: 'CS',
        description: 'Minor concern.',
        bookingId: 'BK-1003',
        busId: 'NB-23',
        driverName: '--',
        hasImages: false,
        imageType: 'none',
        status: 'Resolved',
        created: 'Apr 19, 07:15 AM',
        createdAt: '2026-04-19T07:15:00',
        createdSort: 20260419071500,
      },
    ]
  }

  /** Builds the complaint detail fixture used by the complaint modal tests. */
  function buildComplaintDetail(): AdminComplaintDetail {
    return {
      id: '#CP-0001',
      priority: 'High',
      type: 'Safety Concern',
      status: 'Pending',
      created: 'Apr 21, 09:00 AM',
      createdAt: '2026-04-21T09:00:00',
      description: 'Bus door remained open.',
      bookingId: 'BK-1001',
      busId: 'NB-21',
      passengerName: 'Alice Perera',
      passengerPhoneNumber: '0712345678',
      driverName: 'Nimal Silva',
      driverPhoneNumber: '0771234567',
      adminResponse: '--',
      images: ['/uploads/evidence-1.jpg'],
    }
  }
})
