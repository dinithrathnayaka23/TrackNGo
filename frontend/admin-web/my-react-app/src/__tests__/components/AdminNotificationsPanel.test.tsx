import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminNotificationsPanel from '../../components/AdminNotificationsPanel'
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  type AdminNotificationDto,
} from '../../services/adminNotificationService'
import type * as AdminNotificationServiceModule from '../../services/adminNotificationService'

vi.mock('../../services/adminNotificationService', async (importOriginal) => {
  const actual = await importOriginal<typeof AdminNotificationServiceModule>()
  return {
    ...actual,
    fetchAdminNotifications: vi.fn(),
    markAdminNotificationRead: vi.fn(),
    markAllAdminNotificationsRead: vi.fn(),
  }
})

const mockedFetch = vi.mocked(fetchAdminNotifications)
const mockedMarkRead = vi.mocked(markAdminNotificationRead)
const mockedMarkAllRead = vi.mocked(markAllAdminNotificationsRead)

function buildNotification(
  overrides: Partial<AdminNotificationDto> = {},
): AdminNotificationDto {
  return {
    id: 1,
    notificationType: 'complaint',
    title: 'New complaint',
    message: 'A passenger raised a complaint.',
    read: false,
    createdAt: new Date().toISOString(),
    passengerId: null,
    corporateUserId: null,
    driverId: null,
    adminId: 1,
    ...overrides,
  }
}

describe('AdminNotificationsPanel unread reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedMarkRead.mockResolvedValue()
    mockedMarkAllRead.mockResolvedValue()
  })

  /** The badge count is owned by the layout, so the panel must report the initial total. */
  it('reports the unread count once notifications load', async () => {
    mockedFetch.mockResolvedValue([
      buildNotification({ id: 1 }),
      buildNotification({ id: 2 }),
      buildNotification({ id: 3, read: true }),
    ])
    const onUnreadCountChange = vi.fn()

    render(
      <AdminNotificationsPanel
        open
        onClose={vi.fn()}
        onUnreadCountChange={onUnreadCountChange}
      />,
    )

    await waitFor(() => expect(onUnreadCountChange).toHaveBeenCalledWith(2))
  })

  /** Reading one notification previously left the badge stale until a refresh. */
  it('reports the lowered count as soon as a notification is read', async () => {
    mockedFetch.mockResolvedValue([
      buildNotification({ id: 1, title: 'First notice' }),
      buildNotification({ id: 2, title: 'Second notice' }),
    ])
    const onUnreadCountChange = vi.fn()

    render(
      <AdminNotificationsPanel
        open
        onClose={vi.fn()}
        onUnreadCountChange={onUnreadCountChange}
      />,
    )

    await waitFor(() => expect(onUnreadCountChange).toHaveBeenCalledWith(2))
    fireEvent.click(await screen.findByText('First notice'))

    await waitFor(() => expect(mockedMarkRead).toHaveBeenCalledWith(1))
    await waitFor(() => expect(onUnreadCountChange).toHaveBeenLastCalledWith(1))
  })

  /** "Mark all read" must clear the badge immediately too. */
  it('reports zero when every notification is marked read', async () => {
    mockedFetch.mockResolvedValue([
      buildNotification({ id: 1 }),
      buildNotification({ id: 2 }),
    ])
    const onUnreadCountChange = vi.fn()

    render(
      <AdminNotificationsPanel
        open
        onClose={vi.fn()}
        onUnreadCountChange={onUnreadCountChange}
      />,
    )

    await waitFor(() => expect(onUnreadCountChange).toHaveBeenCalledWith(2))
    fireEvent.click(screen.getByText('Mark all read'))

    await waitFor(() => expect(mockedMarkAllRead).toHaveBeenCalled())
    await waitFor(() => expect(onUnreadCountChange).toHaveBeenLastCalledWith(0))
  })

  /** A closed panel has no loaded data and must not blank a count it does not know. */
  it('does not report a count before notifications have loaded', () => {
    mockedFetch.mockResolvedValue([])
    const onUnreadCountChange = vi.fn()

    render(
      <AdminNotificationsPanel
        open={false}
        onClose={vi.fn()}
        onUnreadCountChange={onUnreadCountChange}
      />,
    )

    expect(onUnreadCountChange).not.toHaveBeenCalled()
  })
})
