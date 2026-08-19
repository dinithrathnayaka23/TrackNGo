import { useEffect, useRef, useState } from 'react'
import { fetchSupportUnreadTotal } from '../services/chatAdminService'

/**
 * Unread messages waiting in the admin support inbox, refreshed on a timer.
 *
 * The admin app has no chat socket subscription outside the Chat page, so the
 * sidebar badge polls the support inbox the same way the mobile tab bars poll
 * their conversation lists.
 */
const POLL_INTERVAL_MS = 15000

export function useUnreadSupportCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true

    const refresh = async () => {
      try {
        const total = await fetchSupportUnreadTotal()
        if (activeRef.current) setUnreadCount(total)
      } catch {
        // A dropped poll says nothing about the inbox, so the previous count
        // stays put rather than blinking the badge off on a flaky connection.
      }
    }

    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)

    return () => {
      activeRef.current = false
      window.clearInterval(timer)
    }
  }, [])

  return unreadCount
}
