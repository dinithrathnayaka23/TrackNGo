import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Chat, {
  applyStatusUpdates,
  formatDay,
  getParticipantDisplayTitle,
  mergeMessage,
  normalizeUserType,
  previewText,
  resolveAssetUrl,
} from '../../../pages/dashboard/Chat'
import {
  fetchChatUserProfile,
  fetchConversationMessages,
  fetchPresenceSnapshot,
  fetchSupportConversations,
  markConversationRead,
  sendConversationMessage,
  type ChatMessage,
  type ConversationDto,
  type MessageStatusUpdate,
  type PresenceUpdate,
  type UserProfile,
} from '../../../services/chatAdminService'

// Only the network calls are stubbed; pure helpers such as getSupportUnread
// keep their real implementation so the page renders the counts it would in
// production.
vi.mock('../../../services/chatAdminService', async () => ({
  ...(await vi.importActual<typeof import('../../../services/chatAdminService')>(
    '../../../services/chatAdminService',
  )),
  fetchChatUserProfile: vi.fn(),
  fetchConversationMessages: vi.fn(),
  fetchPresenceSnapshot: vi.fn(),
  fetchSupportConversations: vi.fn(),
  markConversationRead: vi.fn(),
  sendConversationMessage: vi.fn(),
  uploadChatMedia: vi.fn(),
  deleteConversationMessage: vi.fn(),
}))

const mockedFetchSupportConversations = vi.mocked(fetchSupportConversations)
const mockedFetchPresenceSnapshot = vi.mocked(fetchPresenceSnapshot)
const mockedFetchChatUserProfile = vi.mocked(fetchChatUserProfile)
const mockedFetchConversationMessages = vi.mocked(fetchConversationMessages)
const mockedMarkConversationRead = vi.mocked(markConversationRead)
const mockedSendConversationMessage = vi.mocked(sendConversationMessage)

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  })

  constructor() {
    queueMicrotask(() => this.onopen?.(new Event('open')))
  }
}

describe('Chat page', () => {
  /** Resets admin chat mocks, websocket behavior, and browser helpers before each test. */
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    window.scrollTo = vi.fn()
    Element.prototype.scrollTo = vi.fn()

    mockedFetchSupportConversations.mockResolvedValue(buildConversationPage())
    mockedFetchPresenceSnapshot.mockResolvedValue({
      userId: 1,
      online: true,
      onlineUserIds: [22],
    } as PresenceUpdate)
    mockedFetchChatUserProfile.mockImplementation(async (userId: number) => {
      return buildProfiles()[userId]
    })
    mockedFetchConversationMessages.mockImplementation(async (conversationId: number) => {
      if (conversationId === 202) {
        return {
          content: [
            buildMessage({
              messageId: 9002,
              conversationId: 202,
              senderId: 33,
              senderType: 'PASSENGER',
              content: 'Please confirm the pickup point.',
              createdAt: '2026-04-26T09:15:00Z',
            }),
          ],
          page: 0,
          size: 80,
          totalElements: 1,
          totalPages: 1,
          last: true,
        }
      }

      return {
        content: [
          buildMessage({
            messageId: 9001,
            conversationId: 201,
            senderId: 22,
            senderType: 'DRIVER',
            content: 'I am close to the station.',
            createdAt: '2026-04-26T08:45:00Z',
          }),
        ],
        page: 0,
        size: 80,
        totalElements: 1,
        totalPages: 1,
        last: true,
      }
    })
    mockedMarkConversationRead.mockResolvedValue([] as MessageStatusUpdate[])
    mockedSendConversationMessage.mockImplementation(async (_conversationId, message) => {
      return {
        ...message,
        messageId: 9999,
        createdAt: '2026-04-26T10:00:00Z',
      }
    })
  })

  /** Restores global browser stubs after each admin chat page test. */
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Verifies that the support inbox loads conversations, profiles, and the first message thread. */
  it('loads the support inbox and displays the initial active conversation', async () => {
    render(<Chat />)

    expect(screen.getByText('Loading chats...')).toBeInTheDocument()

    await waitFor(() => expect(mockedFetchSupportConversations).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockedFetchConversationMessages).toHaveBeenCalledWith(201))

    expect(screen.getByPlaceholderText('Search messages...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
    expect(screen.getAllByText('Kasun Driver - Driver').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ayesha Passenger - Passenger').length).toBeGreaterThan(0)
    expect(screen.getAllByText('I am close to the station.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Photo').length).toBeGreaterThan(0)
  })

  /** Verifies that the search box narrows the visible conversations to matching participant data. */
  it('filters visible conversations using the admin search input', async () => {
    render(<Chat />)

    await waitFor(() => expect(mockedFetchSupportConversations).toHaveBeenCalled())

    fireEvent.change(screen.getByPlaceholderText('Search messages...'), {
      target: { value: 'ayesha' },
    })

    expect(screen.getAllByText('Ayesha Passenger - Passenger').length).toBeGreaterThan(0)
    expect(screen.queryByText('Kasun Driver - Driver')).not.toBeInTheDocument()
  })

  /** Verifies that selecting another conversation loads its messages and marks it as read. */
  it('switches conversations and loads the selected message thread', async () => {
    render(<Chat />)

    await waitFor(() => expect(mockedFetchConversationMessages).toHaveBeenCalledWith(201))

    fireEvent.click(screen.getByText('Ayesha Passenger - Passenger'))

    await waitFor(() => expect(mockedFetchConversationMessages).toHaveBeenCalledWith(202))
    await waitFor(() => expect(mockedMarkConversationRead).toHaveBeenCalledWith(202))
    expect(screen.getByText('Please confirm the pickup point.')).toBeInTheDocument()
  })

  /** Verifies that typing and sending a message posts the admin payload and clears the composer. */
  it('sends a new support message through the active conversation', async () => {
    render(<Chat />)

    await waitFor(() => expect(mockedFetchConversationMessages).toHaveBeenCalledWith(201))

    fireEvent.change(screen.getByPlaceholderText('Type a message...'), {
      target: { value: 'Support is reviewing this now.' },
    })
    fireEvent.click(screen.getByLabelText('Send message'))

    await waitFor(() =>
      expect(mockedSendConversationMessage).toHaveBeenCalledWith(
        201,
        expect.objectContaining({
          conversationId: 201,
          senderId: 1,
          recipientId: 22,
          senderType: 'ADMIN',
          content: 'Support is reviewing this now.',
          messageType: 'TEXT',
          status: 'SENT',
        }),
      ),
    )
    expect(screen.getByPlaceholderText('Type a message...')).toHaveValue('')
  })

  /** Verifies that helper utilities keep admin chat formatting and merge behavior predictable. */
  it('maps admin chat helper values correctly', () => {
    expect(normalizeUserType('CORPORATE')).toBe('CORPORATE_USER')
    expect(
      getParticipantDisplayTitle(33, 'PASSENGER', {
        ...buildProfiles()[33],
      }),
    ).toBe('Ayesha Passenger - Passenger')
    expect(
      previewText(
        buildConversation({
          lastMessage: 'voice-note.webm',
          lastMessageType: 'VOICE',
        }),
      ),
    ).toBe('Voice message')
    expect(resolveAssetUrl('/uploads/chat-image.jpg')).toBe('http://localhost:8080/uploads/chat-image.jpg')
    expect(formatDay(new Date().toISOString())).toBe('Today')

    expect(
      mergeMessage(
        [buildMessage({ clientMessageId: 'admin-1', content: 'pending' })],
        buildMessage({ messageId: 55, clientMessageId: 'admin-1', content: 'saved' }),
      )[0].content,
    ).toBe('saved')

    expect(
      applyStatusUpdates(
        [buildMessage({ messageId: 10, status: 'SENT' })],
        [{ conversationId: 201, messageId: 10, status: 'READ' }],
      )[0].status,
    ).toBe('READ')
  })

  /** Builds a stable support-conversation page used across admin chat tests. */
  function buildConversationPage() {
    return {
      content: [
        buildConversation({
          conversationId: 201,
          participant2Id: 22,
          participant2Type: 'DRIVER',
          participant1Unread: 2,
          lastMessage: 'I am close to the station.',
          lastMessageType: 'TEXT',
          lastMessageTimestamp: '2026-04-26T08:45:00Z',
        }),
        buildConversation({
          conversationId: 202,
          participant2Id: 33,
          participant2Type: 'PASSENGER',
          participant1Unread: 0,
          lastMessage: 'trip-photo.jpg',
          lastMessageType: 'IMAGE',
          lastMessageTimestamp: '2026-04-25T16:00:00Z',
        }),
      ],
      page: 0,
      size: 60,
      totalElements: 2,
      totalPages: 1,
      last: true,
    }
  }

  /** Builds representative support-conversation records for the inbox list. */
  function buildConversation(
    overrides: Partial<ConversationDto>,
  ): ConversationDto {
    return {
      conversationId: 201,
      participant1Id: 1,
      participant2Id: 22,
      participant1Type: 'ADMIN',
      participant2Type: 'DRIVER',
      participant1Unread: 0,
      participant2Unread: 0,
      lastMessage: 'Hello',
      lastMessageType: 'TEXT',
      lastMessageTimestamp: '2026-04-26T08:45:00Z',
      ...overrides,
    }
  }

  /** Builds representative chat messages for admin message-list assertions. */
  function buildMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      messageId: 1,
      conversationId: 201,
      senderId: 1,
      recipientId: 22,
      senderType: 'ADMIN',
      content: 'Hello from support',
      messageType: 'TEXT',
      status: 'SENT',
      clientMessageId: 'admin-1',
      mediaUrl: null,
      compressedMediaUrl: null,
      fileName: null,
      mediaMimeType: null,
      mediaSizeBytes: null,
      compressedSizeBytes: null,
      durationSeconds: null,
      latitude: null,
      longitude: null,
      createdAt: '2026-04-26T08:50:00Z',
      ...overrides,
    }
  }

  /** Builds participant profiles used to label support conversations in the admin inbox. */
  function buildProfiles(): Record<number, UserProfile> {
    return {
      22: {
        userId: 22,
        fullName: 'Kasun Driver',
        phoneNumber: '0771234567',
        email: 'kasun.driver@example.com',
        profilePhoto: null,
        userType: 'DRIVER',
      },
      33: {
        userId: 33,
        fullName: 'Ayesha Passenger',
        phoneNumber: '0711234567',
        email: 'ayesha.passenger@example.com',
        profilePhoto: null,
        userType: 'PASSENGER',
      },
    }
  }
})
