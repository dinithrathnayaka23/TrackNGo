import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendChatQuery,
  deleteConversationMessage,
  fetchChatUserProfile,
  fetchConversationMessages,
  fetchPresenceSnapshot,
  fetchSupportConversations,
  markConversationRead,
  openSupportConversation,
  sendConversationMessage,
  uploadChatMedia,
} from '../../services/chatAdminService'

describe('chatAdminService', () => {
  /** Resets the global fetch mock before each admin chat service test. */
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /** Verifies that query-string helper values are appended while empty inputs are skipped. */
  it('appendChatQuery builds query strings for admin chat requests', () => {
    expect(
      appendChatQuery('/api/admin/support/conversations', {
        supportAdminId: 1,
        page: 0,
        q: '',
      }),
    ).toBe('/api/admin/support/conversations?supportAdminId=1&page=0')
  })

  /** Verifies that the support inbox request targets the conversation list endpoint with the admin id. */
  it('fetchSupportConversations loads the admin support inbox', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildJsonResponse(true, { content: [] }),
    )

    await fetchSupportConversations({ page: 2, size: 20, q: 'driver' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/support/conversations?supportAdminId=1&page=2&size=20&q=driver',
      {
        headers: {
          Accept: 'application/json',
        },
      },
    )
  })

  it('opens or creates a support conversation for a selected user', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildJsonResponse(true, { conversationId: 88 }),
    )

    await openSupportConversation(44, 'CORPORATE_USER')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/conversations?user1Id=1&user1Type=ADMIN&user2Id=44&user2Type=CORPORATE_USER',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      },
    )
  })

  /** Verifies that message loading and read updates target the selected conversation endpoints. */
  it('fetchConversationMessages and markConversationRead hit the selected thread endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(buildJsonResponse(true, { content: [] }))
      .mockResolvedValueOnce(buildJsonResponse(true, []))

    await fetchConversationMessages(77)
    await markConversationRead(77)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/conversations/77/messages?page=0&size=80',
      {
        headers: {
          Accept: 'application/json',
        },
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/conversations/77/read?userId=1',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      },
    )
  })

  /** Verifies that send, delete, presence, and profile requests use the expected admin chat routes. */
  it('sends messages and loads supporting chat resources through the correct endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(buildJsonResponse(true, { messageId: 1 }))
      .mockResolvedValueOnce(buildJsonResponse(true, { messageId: 1 }))
      .mockResolvedValueOnce(buildJsonResponse(true, { onlineUserIds: [22] }))
      .mockResolvedValueOnce(buildJsonResponse(true, { userId: 22, fullName: 'Kasun' }))

    await sendConversationMessage(77, {
      senderId: 1,
      content: 'Hello',
      mediaUrl: null,
      compressedMediaUrl: null,
      fileName: null,
      mediaMimeType: null,
      mediaSizeBytes: null,
      compressedSizeBytes: null,
      durationSeconds: null,
      latitude: null,
      longitude: null,
    })
    await deleteConversationMessage(15)
    await fetchPresenceSnapshot()
    await fetchChatUserProfile(22)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/conversations/77/messages',
      {
        method: 'POST',
        body: JSON.stringify({
          senderId: 1,
          content: 'Hello',
          mediaUrl: null,
          compressedMediaUrl: null,
          fileName: null,
          mediaMimeType: null,
          mediaSizeBytes: null,
          compressedSizeBytes: null,
          durationSeconds: null,
          latitude: null,
          longitude: null,
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/messages/15?userId=1',
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/chat/presence', {
      headers: {
        Accept: 'application/json',
      },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/users/22/profile', {
      headers: {
        Accept: 'application/json',
      },
    })
  })

  /** Verifies that media uploads use multipart form submission and backend failures surface clearly. */
  it('uploads chat media and throws readable request errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(buildJsonResponse(true, { mediaUrl: '/uploads/chat.jpg' }))
      .mockResolvedValueOnce(buildTextResponse(false, 'Chat backend unavailable'))

    await uploadChatMedia(new File(['chat'], 'chat.jpg', { type: 'image/jpeg' }))
    await expect(fetchPresenceSnapshot()).rejects.toThrow('Chat backend unavailable')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/media/upload',
      {
        method: 'POST',
        body: expect.any(FormData),
      },
    )
  })

  /** Builds a fetch-like JSON response object for service tests. */
  function buildJsonResponse(ok: boolean, data: unknown): Response {
    return {
      ok,
      json: vi.fn().mockResolvedValue(data),
      text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
    } as unknown as Response
  }

  /** Builds a fetch-like plain-text error response for failing requests. */
  function buildTextResponse(ok: boolean, text: string): Response {
    return {
      ok,
      json: vi.fn().mockResolvedValue(text),
      text: vi.fn().mockResolvedValue(text),
    } as unknown as Response
  }
})
