import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass,
  faMicrophone,
  faPause,
  faPaperPlane,
  faPlay,
  faPlus,
  faStop,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteConversationMessage,
  fetchChatUserProfile,
  fetchConversationMessages,
  fetchPresenceSnapshot,
  fetchSupportConversations,
  markConversationRead,
  sendConversationMessage,
  uploadChatMedia,
} from '../../services/chatAdminService'
import type {
  ChatMessage,
  ConversationDto,
  MessageDeleteEvent,
  MessageStatus,
  MessageStatusUpdate,
  MessageType,
  PresenceUpdate,
  TypingIndicator,
  UserProfile,
  UserType,
} from '../../services/chatAdminService'

type WsEnvelope =
  | { event: 'NEW_MESSAGE'; data: ChatMessage }
  | { event: 'SUPPORT_INBOX_UPDATED'; data: ChatMessage }
  | { event: 'TYPING'; data: { conversationId: number; userId: number; typing: boolean } }
  | { event: 'PRESENCE'; data: PresenceUpdate }
  | { event: 'STATUS_UPDATE'; data: MessageStatusUpdate[] }
  | { event: 'MESSAGE_DELETED'; data: MessageDeleteEvent }
  | { event: 'ERROR'; data: { message?: string } }
  | { event: string; data: unknown }

type MessageListItem =
  | { type: 'date'; key: string; label: string }
  | { type: 'message'; key: string; message: ChatMessage }

type DeleteMenuState = {
  message: ChatMessage
  x: number
  y: number
} | null

const SUPPORT_ADMIN_ID = Number(import.meta.env.VITE_ADMIN_SUPPORT_USER_ID ?? '1')
const CONTEXT_MENU_WIDTH = 150
const CONTEXT_MENU_HEIGHT = 46
const CONTEXT_MENU_MARGIN = 8
const ADMIN_FORCE_OFFLINE_EVENT = 'trackngo:admin-force-offline'
const OFFLINE_SOCKET_CLOSE_DELAY_MS = 120
const WAVEFORM_BARS = [10, 22, 12, 38, 18, 54, 26, 44, 14, 62, 34, 48, 20, 56, 28, 40, 16, 30]

function getContextMenuPosition(clientX: number, clientY: number) {
  const maxX = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN)
  const maxY = Math.max(CONTEXT_MENU_MARGIN, window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN)
  return {
    x: Math.min(Math.max(clientX, CONTEXT_MENU_MARGIN), maxX),
    y: Math.min(Math.max(clientY, CONTEXT_MENU_MARGIN), maxY),
  }
}

// Resolves the backend origin used for media links and websocket fallbacks.
export function getBackendOrigin() {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()
  if (configured) return configured.replace(/\/$/, '')
  if (window.location.port && window.location.port !== '8080') {
    return `${window.location.protocol}//${window.location.hostname}:8080`
  }
  return window.location.origin
}

// Builds the websocket URL for the admin chat connection.
function getWsUrl() {
  const explicit = String(import.meta.env.VITE_CHAT_WS_URL ?? '').trim()
  if (explicit) return explicit
  const origin = getBackendOrigin().replace(/^http/i, 'ws')
  return `${origin}/ws/chat`
}

// Expands relative media paths into absolute URLs that the admin UI can render.
export function resolveAssetUrl(url?: string | null) {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed
  return new URL(trimmed, getBackendOrigin()).toString()
}

// Normalizes legacy corporate user values into the single dashboard-friendly variant.
export function normalizeUserType(userType: UserType): Exclude<UserType, 'CORPORATE'> {
  return userType === 'CORPORATE' ? 'CORPORATE_USER' : userType
}

// Maps participant roles into the labels shown beside admin chat names.
function roleLabel(userType: UserType) {
  const normalized = normalizeUserType(userType)
  if (normalized === 'CORPORATE_USER') return 'Corporate User'
  if (normalized === 'PASSENGER') return 'Passenger'
  if (normalized === 'DRIVER') return 'Driver'
  return 'Admin'
}

// Returns the non-admin participant for the selected support conversation.
export function getOtherParticipant(conversation: ConversationDto) {
  const participant1IsSupport =
    conversation.participant1Id === SUPPORT_ADMIN_ID &&
    normalizeUserType(conversation.participant1Type) === 'ADMIN'

  if (participant1IsSupport) {
    return {
      userId: conversation.participant2Id,
      userType: normalizeUserType(conversation.participant2Type),
    }
  }

  return {
    userId: conversation.participant1Id,
    userType: normalizeUserType(conversation.participant1Type),
  }
}

// Reads the unread count that belongs to the support-admin side of the conversation.
function getSupportUnread(conversation: ConversationDto) {
  if (conversation.participant1Id === SUPPORT_ADMIN_ID) {
    return conversation.participant1Unread
  }
  return conversation.participant2Unread
}

// Chooses the best human-readable participant name from profile data.
function getParticipantName(userId: number, profile?: UserProfile) {
  return profile?.contactPersonName?.trim() || profile?.fullName?.trim() || `User ${userId}`
}

// Builds the participant title shown in the chat list and active-chat header.
export function getParticipantDisplayTitle(userId: number, userType: UserType, profile?: UserProfile) {
  const resolvedType = normalizeUserType(profile?.userType ?? userType)
  return `${getParticipantName(userId, profile)} - ${roleLabel(resolvedType)}`
}

// Chooses the fallback avatar initial when a profile photo is unavailable.
function avatarFallback(userType: UserType, profile?: UserProfile) {
  const resolvedType = normalizeUserType(profile?.userType ?? userType)
  if (resolvedType === 'DRIVER') return 'D'
  if (resolvedType === 'CORPORATE_USER') return 'C'
  if (resolvedType === 'ADMIN') return 'A'
  return 'P'
}

// Formats message timestamps into short time labels for the admin chat UI.
export function formatTime(iso?: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Formats voice-message durations into the mm:ss label used by the player.
export function formatDuration(seconds?: number | null) {
  const totalSeconds = Math.max(0, Math.round(seconds ?? 0))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

// Picks the most compatible browser recording MIME type for voice messages.
function getRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return (
    [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
  )
}

// Converts a recording MIME type into the uploaded audio filename extension.
function getAudioExtension(mimeType: string) {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

// Maps timestamps into Today, Yesterday, or a calendar date label for chat rows.
export function formatDay(iso?: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

// Builds the list-preview text shown beneath each support conversation title.
export function previewText(conversation: ConversationDto) {
  if (conversation.lastMessageType === 'IMAGE') return 'Photo'
  if (conversation.lastMessageType === 'VOICE') return 'Voice message'
  if (conversation.lastMessageType === 'LOCATION') return 'Shared location'
  return conversation.lastMessage || 'No messages yet'
}

// Filters out empty conversations that have never produced a previewable message.
function hasMessages(conversation: ConversationDto) {
  return Boolean(
    conversation.lastMessageTimestamp ||
    conversation.lastMessageType ||
    conversation.lastMessage?.trim(),
  )
}

// Converts timestamps into sortable numeric values when conversation previews update.
function timestampValue(timestamp?: string | null) {
  if (!timestamp) return null
  const value = new Date(timestamp).getTime()
  return Number.isNaN(value) ? null : value
}

// Converts incoming message payloads into the preview text used by the inbox list.
function messagePreviewText(message: ChatMessage) {
  if (message.deleted) return 'Message deleted'
  if (message.messageType === 'IMAGE') return 'Photo'
  if (message.messageType === 'VOICE') return 'Voice message'
  if (message.messageType === 'LOCATION') return 'Shared location'
  return message.content || 'No messages yet'
}

// Inserts or replaces a message using backend ids or optimistic client ids.
export function mergeMessage(existing: ChatMessage[], incoming: ChatMessage) {
  const index = existing.findIndex((item) => {
    if (incoming.messageId && item.messageId === incoming.messageId) return true
    return Boolean(incoming.clientMessageId && item.clientMessageId === incoming.clientMessageId)
  })

  if (index >= 0) {
    const next = [...existing]
    next[index] = { ...next[index], ...incoming }
    return next
  }
  return [incoming, ...existing]
}

// Applies delivery and read-status updates to the currently loaded message list.
export function applyStatusUpdates(messages: ChatMessage[], updates: MessageStatusUpdate[]) {
  if (updates.length === 0) return messages
  const statusById = new Map(updates.map((update) => [update.messageId, update.status]))
  return messages.map((message) => {
    if (!message.messageId) return message
    const status = statusById.get(message.messageId)
    return status ? { ...message, status } : message
  })
}

function ReadReceipt({ status }: { status?: MessageStatus }) {
  const isRead = status === 'READ'
  const isDouble = status === 'READ' || status === 'DELIVERED'
  const tickColor = isRead ? '#60A5FA' : '#9AA4B2'

  return (
    <span className="inline-flex h-3.5 w-5 shrink-0 items-center" aria-label={isDouble ? 'Message delivered' : 'Message sent'}>
      {isDouble ? (
        <svg viewBox="0 0 22 14" className="h-3.5 w-5" fill="none" aria-hidden="true">
          <path
            d="M1.5 7.3 5.1 10.9 12 3"
            stroke={tickColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.2 7.3 11.8 10.9 20.5 1.8"
            stroke={tickColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="M2 7.3 5.6 10.9 12.5 3"
            stroke={tickColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

function LocationPreview({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <div className="w-[220px] max-w-full overflow-hidden rounded-[14px] bg-[#dde5f0] shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
      <div className="relative h-[130px] overflow-hidden bg-[#172331]">
        <div className="absolute inset-0 bg-[#172331]" />
        <div className="absolute left-[-26px] top-[28px] h-3 w-[280px] rotate-[-13deg] rounded-full bg-[#334456] shadow-[0_0_0_1px_rgba(15,23,42,0.24)]" />
        <div className="absolute left-[-14px] top-[84px] h-3 w-[260px] rotate-[8deg] rounded-full bg-[#334456] shadow-[0_0_0_1px_rgba(15,23,42,0.24)]" />
        <div className="absolute left-[70px] top-[-28px] h-[190px] w-3 rotate-[23deg] rounded-full bg-[#3b4b5d] shadow-[0_0_0_1px_rgba(15,23,42,0.22)]" />
        <div className="absolute left-[154px] top-[-24px] h-[180px] w-3 rotate-[-9deg] rounded-full bg-[#304153] shadow-[0_0_0_1px_rgba(15,23,42,0.22)]" />
        <div className="absolute left-7 top-5 h-12 w-16 rounded-xl border border-[#34475a] bg-[#223141]/75" />
        <div className="absolute bottom-7 right-5 h-12 w-20 rounded-xl border border-[#34475a] bg-[#223141]/75" />
        <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
          <svg viewBox="0 0 48 64" className="h-12 w-9 drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]" aria-hidden="true">
            <path
              d="M24 62C19 52 6 39 6 24C6 14.1 14.1 6 24 6S42 14.1 42 24C42 39 29 52 24 62Z"
              fill="#EF4444"
            />
            <circle cx="24" cy="24" r="8" fill="#FFFFFF" />
          </svg>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 bg-[#dde5f0] px-2.5 py-2 text-[10px] font-semibold text-[#465468]">
        <span>Shared location</span>
        <span className="whitespace-nowrap text-[9px]">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>
      </div>
    </div>
  )
}

function Chat() {
  const [conversations, setConversations] = useState<ConversationDto[]>([])
  const [profiles, setProfiles] = useState<Record<number, UserProfile>>({})
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [searchText, setSearchText] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socketReady, setSocketReady] = useState(false)
  const [deleteMenu, setDeleteMenu] = useState<DeleteMenuState>(null)
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null)
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({})
  const [recordingActive, setRecordingActive] = useState(false)
  const [recordingBusy, setRecordingBusy] = useState(false)
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const [onlineByUserId, setOnlineByUserId] = useState<Record<number, boolean>>({})
  const [presenceLoaded, setPresenceLoaded] = useState(false)
  const [typingByConversationId, setTypingByConversationId] = useState<Record<number, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingStartedAtRef = useRef(0)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const activeConversationIdRef = useRef<number | null>(null)
  const profilesRef = useRef<Record<number, UserProfile>>({})
  const typingClearTimersRef = useRef<Record<number, number>>({})
  const localTypingActiveRef = useRef(false)
  const localTypingConversationIdRef = useRef<number | null>(null)
  const localTypingTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])

  useEffect(() => {
    if (!recordingActive) return undefined

    const timer = window.setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
    }, 250)

    return () => window.clearInterval(timer)
  }, [recordingActive])

  useEffect(() => () => {
    Object.values(typingClearTimersRef.current).forEach((timer) => window.clearTimeout(timer))
    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current)
    }
  }, [])

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationId === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )

  const activeParticipant = activeConversation ? getOtherParticipant(activeConversation) : null
  const activeProfile = activeParticipant ? profiles[activeParticipant.userId] : undefined
  const activeParticipantTyping = activeConversationId ? typingByConversationId[activeConversationId] === true : false

  const loadProfiles = useCallback(async (items: ConversationDto[]) => {
    const missingIds = items
      .map((conversation) => getOtherParticipant(conversation).userId)
      .filter((id, index, ids) => ids.indexOf(id) === index)
      .filter((id) => !profilesRef.current[id])

    if (missingIds.length === 0) return

    const fetched = await Promise.all(
      missingIds.map(async (id) => {
        try {
          return await fetchChatUserProfile(id)
        } catch {
          return null
        }
      }),
    )

    setProfiles((current) => {
      const next = { ...current }
      fetched.forEach((profile) => {
        if (profile) next[profile.userId] = profile
      })
      return next
    })
  }, [])

  // Loads the support inbox and keeps the current thread selection in sync.
  const loadConversations = useCallback(async () => {
    setLoadingConversations(true)
    try {
      const response = await fetchSupportConversations({
        page: 0,
        size: 60,
      })
      const visibleConversations = response.content.filter(hasMessages)
      setConversations(visibleConversations)
      setError(null)
      await loadProfiles(visibleConversations)
      setActiveConversationId((current) => {
        if (current && visibleConversations.some((item) => item.conversationId === current)) {
          return current
        }
        return visibleConversations[0]?.conversationId ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support chats')
    } finally {
      setLoadingConversations(false)
    }
  }, [loadProfiles])

  // Applies presence snapshots and websocket deltas to the online badge map.
  const applyPresenceUpdate = useCallback((presence: PresenceUpdate) => {
    if (Array.isArray(presence.onlineUserIds)) {
      const onlineUsers = presence.onlineUserIds.reduce<Record<number, boolean>>((next, userId) => {
        next[userId] = true
        return next
      }, {})
      setOnlineByUserId(onlineUsers)
      setPresenceLoaded(true)
      return
    }

    setOnlineByUserId((current) => {
      if (presence.online) {
        return current[presence.userId] ? current : { ...current, [presence.userId]: true }
      }

      if (!current[presence.userId]) return current
      const next = { ...current }
      delete next[presence.userId]
      return next
    })
  }, [])

  // Tracks temporary typing state for visible support conversations.
  const setConversationTyping = useCallback((conversationId: number, typing: boolean) => {
    const existingTimer = typingClearTimersRef.current[conversationId]
    if (existingTimer) {
      window.clearTimeout(existingTimer)
      delete typingClearTimersRef.current[conversationId]
    }

    setTypingByConversationId((current) => {
      if (typing) {
        return current[conversationId] ? current : { ...current, [conversationId]: true }
      }
      if (!current[conversationId]) return current
      const next = { ...current }
      delete next[conversationId]
      return next
    })

    if (typing) {
      typingClearTimersRef.current[conversationId] = window.setTimeout(() => {
        setTypingByConversationId((current) => {
          if (!current[conversationId]) return current
          const next = { ...current }
          delete next[conversationId]
          return next
        })
        delete typingClearTimersRef.current[conversationId]
      }, 3500)
    }
  }, [])

  // Ignores self-typing events and updates the inbox typing badge state.
  const handleTypingEvent = useCallback((typing: TypingIndicator) => {
    if (typing.userId === SUPPORT_ADMIN_ID || !typing.conversationId) return
    setConversationTyping(typing.conversationId, typing.typing)
  }, [setConversationTyping])

  // Sends typing updates for the active admin conversation over the websocket.
  const sendTypingState = useCallback((conversationId: number, typing: boolean) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({
      action: 'TYPING',
      data: {
        conversationId,
        userId: SUPPORT_ADMIN_ID,
        typing,
      },
    }))
  }, [])

  // Converts composer changes into typing start and stop events.
  const pushLocalTypingState = useCallback((typing: boolean) => {
    if (!activeConversationId) return

    sendTypingState(activeConversationId, typing)
    localTypingActiveRef.current = typing
    localTypingConversationIdRef.current = typing ? activeConversationId : null
  }, [activeConversationId, sendTypingState])

  useEffect(() => () => {
    if (localTypingActiveRef.current && localTypingConversationIdRef.current) {
      sendTypingState(localTypingConversationIdRef.current, false)
      localTypingActiveRef.current = false
      localTypingConversationIdRef.current = null
    }
    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current)
      localTypingTimeoutRef.current = null
    }
  }, [activeConversationId, sendTypingState])

  // Clears the unread badge for the currently opened support conversation.
  const resetSupportUnread = useCallback((conversationId: number) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.conversationId === conversationId
          ? {
              ...conversation,
              participant1Unread:
                conversation.participant1Id === SUPPORT_ADMIN_ID ? 0 : conversation.participant1Unread,
              participant2Unread:
                conversation.participant2Id === SUPPORT_ADMIN_ID ? 0 : conversation.participant2Unread,
            }
          : conversation,
      ),
    )
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return conversations

    return conversations.filter((conversation) => {
      const other = getOtherParticipant(conversation)
      const profile = profiles[other.userId]
      const searchable = [
        getParticipantName(other.userId, profile),
        getParticipantDisplayTitle(other.userId, other.userType, profile),
        roleLabel(other.userType),
        profile?.email,
        profile?.phoneNumber,
        previewText(conversation),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [conversations, profiles, searchText])

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setActiveConversationId(null)
      return
    }
    if (!activeConversationId || !filteredConversations.some((item) => item.conversationId === activeConversationId)) {
      setActiveConversationId(filteredConversations[0].conversationId)
    }
  }, [activeConversationId, filteredConversations])

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    setLoadingMessages(true)
    void fetchConversationMessages(activeConversationId)
      .then((response) => {
        setMessages(response.content)
        return markConversationRead(activeConversationId)
      })
      .then((updates) => {
        setMessages((current) => applyStatusUpdates(current, updates))
        resetSupportUnread(activeConversationId)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
        setMessages([])
      })
      .finally(() => setLoadingMessages(false))
  }, [activeConversationId, resetSupportUnread])

  const updateConversationPreview = useCallback((message: ChatMessage) => {
    if (!message.conversationId) return
    setConversations((current) => {
      const existing = current.find((item) => item.conversationId === message.conversationId)
      if (!existing) {
        void loadConversations()
        return current
      }

      const messageTime = timestampValue(message.createdAt)
      const currentTime = timestampValue(existing.lastMessageTimestamp)
      const shouldReplacePreview =
        currentTime === null || messageTime === null || messageTime >= currentTime

      if (!shouldReplacePreview) {
        return current
      }

      const shouldIncrementUnread =
        message.senderId !== SUPPORT_ADMIN_ID &&
        message.conversationId !== activeConversationIdRef.current &&
        (currentTime === null || (messageTime !== null && messageTime > currentTime))
      const nextItem: ConversationDto = {
        ...existing,
        lastMessage: messagePreviewText(message),
        lastMessageType: message.messageType ?? 'TEXT',
        lastMessageTimestamp: message.createdAt ?? new Date().toISOString(),
        participant1Unread:
          shouldIncrementUnread && existing.participant1Id === SUPPORT_ADMIN_ID
            ? existing.participant1Unread + 1
            : existing.participant1Unread,
        participant2Unread:
          shouldIncrementUnread && existing.participant2Id === SUPPORT_ADMIN_ID
            ? existing.participant2Unread + 1
            : existing.participant2Unread,
      }

      return [nextItem, ...current.filter((item) => item.conversationId !== message.conversationId)]
    })
  }, [loadConversations])

  useEffect(() => {
    const closeMenu = () => setDeleteMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [])

  const conversationIdsKey = useMemo(
    () =>
      conversations
        .map((conversation) => conversation.conversationId)
        .sort((a, b) => a - b)
        .join(','),
    [conversations],
  )
  const conversationIdsRef = useRef<number[]>([])
  const subscribedConversationIdsRef = useRef<Set<number>>(new Set())
  const applyPresenceUpdateRef = useRef(applyPresenceUpdate)
  const updateConversationPreviewRef = useRef(updateConversationPreview)
  const loadConversationsRef = useRef(loadConversations)
  const resetSupportUnreadRef = useRef(resetSupportUnread)
  const handleTypingEventRef = useRef(handleTypingEvent)

  useEffect(() => {
    applyPresenceUpdateRef.current = applyPresenceUpdate
    updateConversationPreviewRef.current = updateConversationPreview
    loadConversationsRef.current = loadConversations
    resetSupportUnreadRef.current = resetSupportUnread
    handleTypingEventRef.current = handleTypingEvent
  }, [applyPresenceUpdate, handleTypingEvent, loadConversations, resetSupportUnread, updateConversationPreview])

  useEffect(() => {
    void fetchPresenceSnapshot()
      .then(applyPresenceUpdate)
      .catch(() => {
        // The websocket will continue receiving live presence updates if the snapshot request fails.
      })
  }, [applyPresenceUpdate])

  useEffect(() => {
    const socket = new WebSocket(getWsUrl())
    socketRef.current = socket
    let closing = false
    setSocketReady(false)

    const sendPresence = (online: boolean) => {
      if (socket.readyState !== WebSocket.OPEN) return
      socket.send(JSON.stringify({
        action: 'PRESENCE',
        data: { userId: SUPPORT_ADMIN_ID, online },
      }))
    }

    const goOffline = () => {
      if (closing) return
      closing = true
      sendPresence(false)
      if (socket.readyState === WebSocket.OPEN) {
        subscribedConversationIdsRef.current.forEach((conversationId) => {
          socket.send(JSON.stringify({ action: 'UNSUBSCRIBE', conversationId }))
        })
      }
      subscribedConversationIdsRef.current.clear()
      window.setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSING && socket.readyState !== WebSocket.CLOSED) {
          socket.close()
        }
      }, OFFLINE_SOCKET_CLOSE_DELAY_MS)
    }

    socket.onopen = () => {
      if (closing) {
        socket.close()
        return
      }
      setSocketReady(true)
      sendPresence(true)
      conversationIdsRef.current.forEach((conversationId) => {
        socket.send(JSON.stringify({ action: 'SUBSCRIBE', conversationId }))
        subscribedConversationIdsRef.current.add(conversationId)
      })
    }

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as WsEnvelope
      if (payload.event === 'NEW_MESSAGE') {
        const message = payload.data as ChatMessage
        updateConversationPreviewRef.current(message)
        if (message.senderId !== SUPPORT_ADMIN_ID && message.conversationId) {
          setConversationTyping(message.conversationId, false)
        }
        if (message.conversationId === activeConversationIdRef.current) {
          setMessages((current) => mergeMessage(current, message))
          if (message.senderId !== SUPPORT_ADMIN_ID && message.conversationId) {
            void markConversationRead(message.conversationId).then(() =>
              resetSupportUnreadRef.current(message.conversationId as number),
            )
          }
        }
      }

      if (payload.event === 'SUPPORT_INBOX_UPDATED') {
        const message = payload.data as ChatMessage
        updateConversationPreviewRef.current(message)
        if (message.senderId !== SUPPORT_ADMIN_ID && message.conversationId) {
          setConversationTyping(message.conversationId, false)
        }
        void loadConversationsRef.current()
        if (message.conversationId === activeConversationIdRef.current) {
          setMessages((current) => mergeMessage(current, message))
          if (message.senderId !== SUPPORT_ADMIN_ID && message.conversationId) {
            void markConversationRead(message.conversationId).then(() =>
              resetSupportUnreadRef.current(message.conversationId as number),
            )
          }
        }
      }

      if (payload.event === 'TYPING') {
        handleTypingEventRef.current(payload.data as TypingIndicator)
      }

      if (payload.event === 'PRESENCE') {
        applyPresenceUpdateRef.current(payload.data as PresenceUpdate)
      }

      if (payload.event === 'STATUS_UPDATE') {
        setMessages((current) => applyStatusUpdates(current, payload.data as MessageStatusUpdate[]))
      }

      if (payload.event === 'MESSAGE_DELETED') {
        const deleted = payload.data as MessageDeleteEvent
        setMessages((current) =>
          current.map((message) =>
            message.messageId === deleted.messageId
              ? {
                  ...message,
                  deleted: true,
                  content: 'Message deleted',
                  mediaUrl: null,
                  compressedMediaUrl: null,
                  fileName: null,
                  mediaMimeType: null,
                  mediaSizeBytes: null,
                  compressedSizeBytes: null,
                  durationSeconds: null,
                }
              : message,
          ),
        )
        void loadConversationsRef.current()
      }
    }

    socket.onerror = () => setSocketReady(false)
    socket.onclose = () => setSocketReady(false)

    window.addEventListener(ADMIN_FORCE_OFFLINE_EVENT, goOffline)

    return () => {
      window.removeEventListener(ADMIN_FORCE_OFFLINE_EVENT, goOffline)
      goOffline()
    }
  }, [])

  useEffect(() => {
    const conversationIds = conversationIdsKey
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
    conversationIdsRef.current = conversationIds

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    const nextIds = new Set(conversationIds)
    subscribedConversationIdsRef.current.forEach((conversationId) => {
      if (!nextIds.has(conversationId)) {
        socket.send(JSON.stringify({ action: 'UNSUBSCRIBE', conversationId }))
        subscribedConversationIdsRef.current.delete(conversationId)
      }
    })

    conversationIds.forEach((conversationId) => {
      if (!subscribedConversationIdsRef.current.has(conversationId)) {
        socket.send(JSON.stringify({ action: 'SUBSCRIBE', conversationId }))
        subscribedConversationIdsRef.current.add(conversationId)
      }
    })
  }, [conversationIdsKey])

  const buildOutgoingMessage = useCallback(
    (content: string, type: MessageType, media?: {
      mediaUrl: string
      fileName: string
      mediaMimeType: string
      mediaSizeBytes: number
      durationSeconds?: number
    }): ChatMessage | null => {
      if (!activeConversation || !activeParticipant) return null
      return {
        conversationId: activeConversation.conversationId,
        senderId: SUPPORT_ADMIN_ID,
        recipientId: activeParticipant.userId,
        senderType: 'ADMIN',
        content,
        messageType: type,
        status: 'SENT',
        clientMessageId: `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        mediaUrl: media?.mediaUrl ?? null,
        compressedMediaUrl: null,
        fileName: media?.fileName ?? null,
        mediaMimeType: media?.mediaMimeType ?? null,
        mediaSizeBytes: media?.mediaSizeBytes ?? null,
        compressedSizeBytes: null,
        durationSeconds: media?.durationSeconds ?? null,
        latitude: null,
        longitude: null,
        createdAt: new Date().toISOString(),
      }
    },
    [activeConversation, activeParticipant],
  )

  // Inserts the optimistic outgoing message and reconciles it with the saved backend copy.
  const sendMessage = useCallback(async (message: ChatMessage) => {
    if (!activeConversation) return
    setSending(true)
    setMessages((current) => mergeMessage(current, message))
    try {
      const saved = await sendConversationMessage(activeConversation.conversationId, message)
      setMessages((current) => mergeMessage(current, saved))
      updateConversationPreview(saved)
    } catch (err) {
      setMessages((current) => current.filter((item) => item.clientMessageId !== message.clientMessageId))
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }, [activeConversation, updateConversationPreview])

  // Updates the composer value and manages local typing timeouts.
  const handleDraftChange = useCallback((value: string) => {
    setDraftMessage(value)

    const hasText = value.trim().length > 0
    if (hasText && !localTypingActiveRef.current) {
      pushLocalTypingState(true)
    }
    if (!hasText && localTypingActiveRef.current) {
      pushLocalTypingState(false)
    }

    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current)
      localTypingTimeoutRef.current = null
    }
    if (hasText) {
      localTypingTimeoutRef.current = window.setTimeout(() => {
        pushLocalTypingState(false)
        localTypingTimeoutRef.current = null
      }, 2000)
    }
  }, [pushLocalTypingState])

  // Sends the current text draft as a plain support-chat message.
  const handleSendText = useCallback(() => {
    const text = draftMessage.trim()
    if (!text || sending) return
    const message = buildOutgoingMessage(text, 'TEXT')
    if (!message) return
    pushLocalTypingState(false)
    setDraftMessage('')
    void sendMessage(message)
  }, [buildOutgoingMessage, draftMessage, pushLocalTypingState, sendMessage, sending])

  // Uploads attachments and sends them as image or voice chat messages.
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || sending) return

    try {
      setSending(true)
      const uploaded = await uploadChatMedia(file)
      const type: MessageType = uploaded.mimeType?.startsWith('image/') ? 'IMAGE' : 'VOICE'
      const message = buildOutgoingMessage('', type, {
        mediaUrl: uploaded.mediaUrl,
        fileName: uploaded.fileName,
        mediaMimeType: uploaded.mimeType,
        mediaSizeBytes: uploaded.sizeBytes,
      })
      if (message) {
        await sendMessage(message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSending(false)
    }
  }

  const cleanupRecording = useCallback(() => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    recordingStreamRef.current = null
    mediaRecorderRef.current = null
    recordingChunksRef.current = []
  }, [])

  const startRecording = useCallback(async () => {
    if (recordingActive || recordingBusy || sending) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser')
      return
    }

    setRecordingBusy(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      recordingChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data)
        }
      }

      recordingStreamRef.current = stream
      mediaRecorderRef.current = recorder
      recordingStartedAtRef.current = Date.now()
      setRecordingElapsed(0)
      setRecordingActive(true)
      setError(null)
      recorder.start()
    } catch (err) {
      cleanupRecording()
      setError(err instanceof Error ? err.message : 'Could not start voice recording')
    } finally {
      setRecordingBusy(false)
    }
  }, [cleanupRecording, recordingActive, recordingBusy, sending])

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }
    cleanupRecording()
    setRecordingActive(false)
    setRecordingBusy(false)
    setRecordingElapsed(0)
  }, [cleanupRecording])

  const stopRecordingAndSend = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recordingActive || recordingBusy || sending || !recorder) return

    setRecordingBusy(true)
    try {
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
      })

      if (recorder.state !== 'inactive') {
        recorder.stop()
        await stopped
      }

      const mimeType = recorder.mimeType || getRecordingMimeType() || 'audio/webm'
      const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000))
      const audioBlob = new Blob(recordingChunksRef.current, { type: mimeType })
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      recordingStreamRef.current = null
      setRecordingActive(false)

      if (audioBlob.size <= 0) {
        throw new Error('Recording is empty')
      }

      const file = new File(
        [audioBlob],
        `voice-${Date.now()}.${getAudioExtension(mimeType)}`,
        { type: mimeType },
      )
      const uploaded = await uploadChatMedia(file)
      const message = buildOutgoingMessage('', 'VOICE', {
        mediaUrl: uploaded.mediaUrl,
        fileName: uploaded.fileName,
        mediaMimeType: uploaded.mimeType || mimeType,
        mediaSizeBytes: uploaded.sizeBytes,
        durationSeconds,
      })

      if (message) {
        await sendMessage(message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice recording failed')
    } finally {
      cleanupRecording()
      setRecordingActive(false)
      setRecordingBusy(false)
      setRecordingElapsed(0)
    }
  }, [buildOutgoingMessage, cleanupRecording, recordingActive, recordingBusy, sendMessage, sending])

  const handleComposerAction = useCallback(() => {
    if (recordingActive) {
      void stopRecordingAndSend()
      return
    }

    if (draftMessage.trim()) {
      handleSendText()
      return
    }

    void startRecording()
  }, [draftMessage, handleSendText, recordingActive, startRecording, stopRecordingAndSend])

  // Deletes a support-admin message and restores it locally if the request fails.
  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!message.messageId || message.senderId !== SUPPORT_ADMIN_ID || message.deleted) return
    setDeleteMenu(null)

    const original = message
    setMessages((current) =>
      current.map((item) =>
        item.messageId === message.messageId
          ? { ...item, deleted: true, content: 'Message deleted', mediaUrl: null }
          : item,
      ),
    )

    try {
      await deleteConversationMessage(message.messageId)
    } catch (err) {
      setMessages((current) =>
        current.map((item) => (item.messageId === original.messageId ? original : item)),
      )
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const toggleVoicePlayback = (key: string) => {
    const audio = audioRefs.current[key]
    if (!audio) return

    Object.entries(audioRefs.current).forEach(([itemKey, itemAudio]) => {
      if (itemKey !== key) {
        itemAudio?.pause()
      }
    })

    if (playingAudioKey === key) {
      audio.pause()
      setPlayingAudioKey(null)
      return
    }

    void audio.play()
    setPlayingAudioKey(key)
  }

  const onComposerEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSendText()
    }
  }

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages])
  const messageItems = useMemo<MessageListItem[]>(() => {
    const items: MessageListItem[] = []
    let lastLabel = ''

    orderedMessages.forEach((message, index) => {
      const messageKey = String(message.messageId ?? message.clientMessageId ?? `${message.senderId}-${message.createdAt}-${index}`)
      const label = formatDay(message.createdAt) || 'Unknown date'

      if (label !== lastLabel) {
        items.push({
          type: 'date',
          key: `date-${label}-${messageKey}`,
          label,
        })
        lastLabel = label
      }

      items.push({
        type: 'message',
        key: `message-${messageKey}`,
        message,
      })
    })

    return items
  }, [orderedMessages])

  useEffect(() => {
    if (loadingMessages || !activeConversationId || messageItems.length === 0) return

    const frame = window.requestAnimationFrame(() => {
      const container = messagesContainerRef.current
      if (!container) return
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'auto',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeConversationId, loadingMessages, messageItems.length])

  return (
    <div className="-m-5 flex min-h-0 flex-1 overflow-hidden bg-[#f7f9fc]" style={{ height: 'calc(100vh - 4rem)' }}>
      <style>
        {`
          .chat-scrollbar-hidden {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .chat-scrollbar-hidden::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
      <section className="flex w-[390px] min-w-[320px] flex-col border-r border-[#e5e7eb] bg-[#f7f9fc]">
        <div className="px-4 py-4">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-sm text-[#94a3b8]" />
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#1f2937] outline-none placeholder:text-[#a6b0c3]"
              placeholder="Search messages..."
            />
          </div>
        </div>

        <div className="chat-scrollbar-hidden min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5">
          {loadingConversations ? (
            <p className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-4 text-[13px] font-semibold text-[#7b8495]">Loading chats...</p>
          ) : filteredConversations.length === 0 ? (
            <p className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-4 text-[13px] text-[#6f7a90]">
              No support chats found.
            </p>
          ) : (
            filteredConversations.map((conversation) => {
              const other = getOtherParticipant(conversation)
              const profile = profiles[other.userId]
              const selected = conversation.conversationId === activeConversationId
              const avatarUrl = resolveAssetUrl(profile?.profilePhoto)
              const unread = getSupportUnread(conversation)
              const isOnline = onlineByUserId[other.userId]
              const isTyping = typingByConversationId[conversation.conversationId] === true

              return (
                <button
                  key={conversation.conversationId}
                  type="button"
                  onClick={() => setActiveConversationId(conversation.conversationId)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
                    selected
                      ? 'border-[#bcd3ff] bg-[#eef5ff] shadow-[0_8px_18px_rgba(26,115,232,0.10)]'
                      : 'border-[#e5e7eb] bg-white hover:border-[#cfd9e8]',
                  ].join(' ')}
                >
                  <div className="relative h-11 w-11 shrink-0">
                    <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#dde5f0] text-sm font-extrabold text-[#475569]">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{avatarFallback(other.userType, profile)}</span>
                      )}
                    </div>
                    {isOnline ? (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#22c55e]" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-extrabold leading-5 text-[#1f2937]">
                        {getParticipantDisplayTitle(other.userId, other.userType, profile)}
                      </p>
                      <span className="whitespace-nowrap text-[10px] font-semibold text-[#8993a5]">
                        {formatDay(conversation.lastMessageTimestamp) === 'Today'
                          ? formatTime(conversation.lastMessageTimestamp)
                          : formatDay(conversation.lastMessageTimestamp)}
                      </span>
                    </div>
                    <p
                      className={[
                        'mt-2 truncate text-[11px]',
                        isTyping || unread > 0 ? 'font-extrabold text-[#1a73e8]' : 'font-semibold text-[#8a94a6]',
                      ].join(' ')}
                    >
                      {isTyping ? 'typing...' : previewText(conversation)}
                    </p>
                  </div>
                  {unread > 0 ? (
                    <span className="grid min-w-5 place-items-center rounded-full bg-[#1a73e8] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col bg-[#f4f6fa]">
        <div className="flex h-14 items-center justify-between border-b border-[#e5e7eb] bg-[#f7f9fc] px-4">
          {activeParticipant ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-9 w-9 shrink-0">
                <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#dde5f0] text-sm font-extrabold text-[#475569]">
                  {resolveAssetUrl(activeProfile?.profilePhoto) ? (
                    <img
                      src={resolveAssetUrl(activeProfile?.profilePhoto) ?? ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{avatarFallback(activeParticipant.userType, activeProfile)}</span>
                  )}
                </div>
                {onlineByUserId[activeParticipant.userId] ? (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#f1f5f9] bg-[#22c55e]" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold leading-5 text-[#1f2937]">
                  {getParticipantDisplayTitle(activeParticipant.userId, activeParticipant.userType, activeProfile)}
                </p>
                <p
                  className={[
                    'mt-1 text-[11px] font-semibold',
                    activeParticipantTyping ? 'text-[#1a73e8]' : onlineByUserId[activeParticipant.userId] ? 'text-[#22c55e]' : 'text-[#94a3b8]',
                  ].join(' ')}
                >
                  {activeParticipantTyping
                    ? 'typing...'
                    : onlineByUserId[activeParticipant.userId]
                      ? 'Online'
                      : presenceLoaded || socketReady
                        ? 'Offline'
                        : 'Connecting'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-extrabold text-[#1f2737]">No chat selected</p>
          )}
        </div>

        {error ? (
          <div className="border-b border-[#f0c5c5] bg-[#fff5f5] px-5 py-2 text-sm font-semibold text-[#b42318]">
            {error}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-0">
          <div ref={messagesContainerRef} className="chat-scrollbar-hidden min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 pt-3">
            {loadingMessages ? (
              <p className="text-[13px] font-semibold text-[#6f7a90]">Loading messages...</p>
            ) : messageItems.length === 0 ? (
              <p className="text-[13px] font-semibold text-[#6f7a90]">No messages yet.</p>
            ) : (
              messageItems.map((item) => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} className="flex justify-center">
                      <div className="rounded-xl bg-[#e9eef7] px-3.5 py-1">
                        <span className="text-[11px] font-bold text-[#8a94a6]">{item.label}</span>
                      </div>
                    </div>
                  )
                }

                const message = item.message
                const mine = message.senderId === SUPPORT_ADMIN_ID
                const isDeleted = message.deleted === true
                const imageUrl = resolveAssetUrl(message.mediaUrl)
                const isImage = !isDeleted && message.messageType === 'IMAGE' && !!imageUrl
                const isVoice = !isDeleted && message.messageType === 'VOICE' && !!imageUrl
                const isLocation =
                  !isDeleted &&
                  message.messageType === 'LOCATION' &&
                  message.latitude != null &&
                  message.longitude != null
                const showRowAvatar = !mine
                const audioPlaying = playingAudioKey === item.key
                const voiceDuration = audioDurations[item.key] ?? message.durationSeconds

                return (
                  <div
                    key={item.key}
                    className={mine ? 'ml-auto max-w-[64%]' : 'max-w-[64%]'}
                  >
                    <div className={mine ? 'flex justify-end' : 'flex items-end gap-2'}>
                      {showRowAvatar ? (
                        <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#dde5f0] text-[10px] font-extrabold text-[#475569]">
                          {resolveAssetUrl(activeProfile?.profilePhoto) ? (
                            <img
                              src={resolveAssetUrl(activeProfile?.profilePhoto) ?? ''}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{activeParticipant ? avatarFallback(activeParticipant.userType, activeProfile) : 'P'}</span>
                          )}
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div
                          className={[
                            isImage || isVoice || isLocation
                              ? ''
                              : mine
                                ? 'inline-block rounded-[14px] rounded-tr bg-[#1a73e8] px-3 py-2.5 text-white'
                                : 'inline-block rounded-[14px] rounded-tl border border-[#e5e7eb] bg-white px-3 py-2.5 text-[#4b5563]',
                            isDeleted ? 'italic opacity-75' : '',
                          ].join(' ')}
                          onContextMenu={(event) => {
                            if (!mine || !message.messageId || isDeleted) return
                            event.preventDefault()
                            const position = getContextMenuPosition(event.clientX, event.clientY)
                            setDeleteMenu({
                              message,
                              x: position.x,
                              y: position.y,
                            })
                          }}
                        >
                          {isDeleted ? (
                            <p className="text-[12px] font-semibold leading-relaxed">Message deleted</p>
                          ) : isImage ? (
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block w-[220px] overflow-hidden rounded-[14px]"
                            >
                              <img
                                src={imageUrl}
                                alt="Chat attachment"
                                className="h-[130px] w-full object-cover"
                              />
                            </a>
                          ) : isLocation ? (
                            <a
                              href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <LocationPreview latitude={message.latitude!} longitude={message.longitude!} />
                            </a>
                          ) : isVoice ? (
                            <div
                              className={[
                                'inline-flex max-w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.10)]',
                                mine ? 'bg-[#1a73e8] text-white' : 'border border-[#e5e7eb] bg-white text-[#1f2937]',
                              ].join(' ')}
                            >
                              <button
                                type="button"
                                onClick={() => toggleVoicePlayback(item.key)}
                                className={[
                                  'grid h-8 w-8 shrink-0 place-items-center rounded-full transition',
                                  mine ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-[#e7eef8] text-[#1a73e8] hover:bg-[#d9e7fb]',
                                ].join(' ')}
                                aria-label={audioPlaying ? 'Pause voice message' : 'Play voice message'}
                              >
                                <FontAwesomeIcon icon={audioPlaying ? faPause : faPlay} className="text-sm" />
                              </button>
                              <div className="min-w-0">
                                <div className="flex h-8 w-[126px] items-center gap-1">
                                  {WAVEFORM_BARS.map((height, index) => (
                                    <span
                                      key={`${item.key}-bar-${index}`}
                                      className={[
                                        'rounded-full',
                                        mine ? 'bg-white/45' : 'bg-[#8aa7bd]',
                                        audioPlaying && index % 3 === 0 ? 'opacity-100' : 'opacity-70',
                                      ].join(' ')}
                                      style={{ height: `${height}%`, width: 3 }}
                                    />
                                  ))}
                                </div>
                                <p className={['mt-1 text-[11px] font-semibold', mine ? 'text-white/75' : 'text-[#788598]'].join(' ')}>
                                  {formatDuration(voiceDuration)}
                                </p>
                              </div>
                              <audio
                                ref={(element) => {
                                  audioRefs.current[item.key] = element
                                }}
                                src={imageUrl}
                                preload="metadata"
                                className="hidden"
                                onLoadedMetadata={(event) => {
                                  const duration = event.currentTarget.duration
                                  if (Number.isFinite(duration) && duration > 0) {
                                    setAudioDurations((current) => ({
                                      ...current,
                                      [item.key]: duration,
                                    }))
                                  }
                                }}
                                onEnded={() => setPlayingAudioKey((current) => (current === item.key ? null : current))}
                                onPause={() => setPlayingAudioKey((current) => (current === item.key ? null : current))}
                              />
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-[12px] font-semibold leading-relaxed">
                              {message.content || ' '}
                            </p>
                          )}
                        </div>
                        <div
                          className={[
                            'mt-1 flex min-h-4 items-center gap-1 text-[10px] font-semibold text-[#9aa4b2]',
                            mine ? 'justify-end pr-1' : 'justify-start pl-1',
                          ].join(' ')}
                        >
                          <span>{formatTime(message.createdAt)}</span>
                          {mine ? <ReadReceipt status={message.status} /> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )} 
          </div>
        </div>

        {deleteMenu ? (
          <div
            className="fixed z-50 w-[150px] rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_14px_30px_rgba(15,23,42,0.16)]"
            style={{
              left: deleteMenu.x,
              top: deleteMenu.y,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => void handleDeleteMessage(deleteMenu.message)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-[#b42318] hover:bg-[#fff5f5]"
            >
              <FontAwesomeIcon icon={faTrash} />
              Delete
            </button>
          </div>
        ) : null}

        <div className="border-t border-[#e5e7eb] bg-[#f7f9fc] px-3 py-3">
          {recordingActive ? (
            <div className="mb-2 flex items-center justify-between rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ef4444] text-white">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-[#ef4444]/35" />
                  <FontAwesomeIcon icon={faMicrophone} className="relative text-xs" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-[#b42318]">Recording voice</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#64748b]">{formatDuration(recordingElapsed)}</span>
                    <div className="flex h-4 items-center gap-0.5">
                      {WAVEFORM_BARS.slice(0, 12).map((height, index) => (
                        <span
                          key={`recording-wave-${index}`}
                          className="w-0.5 rounded-full bg-[#ef4444]/70"
                          style={{ height: `${Math.max(20, height)}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelRecording}
                disabled={recordingBusy}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#b42318] transition hover:bg-white disabled:opacity-40"
                aria-label="Cancel recording"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!activeConversation || sending || recordingActive || recordingBusy}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e5e7eb] bg-white text-[#64748b] transition hover:text-[#1a73e8] disabled:opacity-40"
              aria-label="Attach media"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
            <div className="flex h-10 min-w-0 flex-1 items-center rounded-full border border-[#e5e7eb] bg-white px-3">
            <input
              type="text"
              value={draftMessage}
              onChange={(event) => handleDraftChange(event.target.value)}
              onKeyDown={onComposerEnter}
              placeholder={recordingActive ? 'Recording voice...' : 'Type a message...'}
              disabled={!activeConversation || sending || recordingActive}
              className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#1f2937] outline-none placeholder:text-[#a6b0c3] disabled:opacity-50"
            />
            </div>
            <button
              type="button"
              onClick={handleComposerAction}
              disabled={!activeConversation || sending || recordingBusy}
              className={[
                'grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm text-white transition disabled:opacity-50',
                recordingActive ? 'bg-[#ef4444] hover:bg-[#dc2626]' : 'bg-[#1a73e8] hover:bg-[#1764cf]',
              ].join(' ')}
              aria-label={recordingActive ? 'Stop and send recording' : draftMessage.trim() ? 'Send message' : 'Record voice'}
            >
              <FontAwesomeIcon icon={recordingActive ? faStop : draftMessage.trim() ? faPaperPlane : faMicrophone} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Chat
