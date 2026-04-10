import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  faBook,
  faBus,
  faChartColumn,
  faChartSimple,
  faComment,
  faFaceSmile,
  faLocationDot,
  faMicrophone,
  faPaperPlane,
  faPlus,
  faTriangleExclamation,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import Navbar from '../../components/layout/Navbar'
import Sidebar, { type SidebarMenuItem } from '../../components/layout/Sidebar'
import { logoutToLogin } from '../../utils/authSession'

type ChatPreview = {
  id: string
  name: string
  status: 'online' | 'offline'
  avatar: string
}

type ChatMessage = {
  id: string
  text: string
  time: string
  mine?: boolean
}

type Conversation = {
  user: ChatPreview
  messages: ChatMessage[]
}

function ReadReceipt() {
  return (
    <svg
      viewBox="0 0 18 12"
      aria-hidden="true"
      className="h-3.5 w-4.5 text-[#2f63e6]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.8 6.6 L4.5 9.3 L9.3 3.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.1 6.6 L9.8 9.3 L14.6 3.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const mainMenu: SidebarMenuItem[] = [
  { label: 'Dashboard', icon: faChartSimple },
  { label: 'Users', icon: faUsers, path: '/dashboard/users' },
  { label: 'Buses', icon: faBus, path: '/dashboard/buses' },
  { label: 'Routes', icon: faLocationDot, path: '/dashboard/routes' },
  { label: 'Bookings', icon: faBook },
]

const systemMenu: SidebarMenuItem[] = [
  { label: 'Complaints', icon: faTriangleExclamation },
  { label: 'Analytics', icon: faChartColumn, path: '/dashboard/analytics' },
  { label: 'Chat', icon: faComment, active: true, path: '/dashboard/chat' },
]

const initialConversations: Conversation[] = [
  {
    user: {
      id: 'janani',
      name: 'Sunil Perera',
      status: 'online',
      avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=120&q=80',
    },
    messages: [
      {
        id: 'm1',
        text: "Hello Admin, I'm currently stuck at traffic near central station on Route 402. Expecting a 15-minute delay.",
        time: '10:42 AM',
      },
      {
        id: 'm2',
        text: 'Copy that, Sunil. I will update the status on the public dashboard so passengers are aware. Are there any passengers currently on board?',
        time: '10:44 AM',
        mine: true,
      },
      {
        id: 'm3',
        text: 'Yes, about 12 passengers. Everything is calm.',
        time: '10:45 AM',
      },
    ],
  },
  {
    user: {
      id: 'amal',
      name: 'Amal Perera',
      status: 'offline',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    },
    messages: [
      { id: 'a1', text: 'The dispatcher mentioned the delay on Route 305.', time: 'Yesterday' },
      { id: 'a2', text: 'Understood. Keep me posted if timing changes again.', time: 'Yesterday', mine: true },
    ],
  },
  {
    user: {
      id: 'saman',
      name: 'Saman Edirisingha',
      status: 'online',
      avatar: 'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=120&q=80',
    },
    messages: [{ id: 's1', text: 'Maintenance check completed.', time: 'Mar 12' }],
  },
]

const formatTime = () =>
  new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

function Chat() {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeChatId, setActiveChatId] = useState(initialConversations[0].user.id)
  const [searchText, setSearchText] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((conversation) => {
      const latestMessage = conversation.messages[conversation.messages.length - 1]?.text ?? ''
      return (
        conversation.user.name.toLowerCase().includes(query) ||
        latestMessage.toLowerCase().includes(query)
      )
    })
  }, [conversations, searchText])

  const activeConversation =
    conversations.find((conversation) => conversation.user.id === activeChatId) ?? conversations[0]

  useEffect(() => {
    if (!activeConversation) return
    if (!filteredConversations.some((conversation) => conversation.user.id === activeConversation.user.id)) {
      setActiveChatId(filteredConversations[0]?.user.id ?? '')
    }
  }, [activeConversation, filteredConversations])

  useEffect(() => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [activeChatId, conversations])

  const handleSendMessage = () => {
    const normalized = draftMessage.trim()
    if (!normalized || !activeConversation) return

    setConversations((current) =>
      current.map((conversation) =>
        conversation.user.id === activeConversation.user.id
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  id: `local-${Date.now()}`,
                  text: normalized,
                  time: formatTime(),
                  mine: true,
                },
              ],
            }
          : conversation,
      ),
    )
    setDraftMessage('')
  }

  const onComposerEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="h-screen bg-[#efeff4]" style={{ fontFamily: 'Manrope, Segoe UI, sans-serif' }}>
      <Sidebar mainMenu={mainMenu} systemMenu={systemMenu} />

      <div className="ml-[314px] flex h-screen flex-col">
        <Navbar breadcrumbs={['Home', 'Chat']} onLogout={() => logoutToLogin(navigate)} unreadCount={1} />

        <main className="flex min-h-0 flex-1">
          <section className="flex w-[420px] min-w-[360px] flex-col border-r border-[#dce0e9] bg-[#f3f4f8]">
            <div className="border-b border-[#e1e5ee] px-4 py-4">
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="h-12 w-full rounded-xl bg-[#e8ebf2] px-4 text-sm text-[#2f374b] outline-none placeholder:text-[#7a8397]"
                placeholder="Search messages..."
              />
            </div>

            <div className="overflow-y-auto px-3 py-3">
              {filteredConversations.map((conversation) => {
                const latestMessage = conversation.messages[conversation.messages.length - 1]
                const isSelected = conversation.user.id === activeConversation?.user.id

                return (
                  <button
                    key={conversation.user.id}
                    type="button"
                    onClick={() => setActiveChatId(conversation.user.id)}
                    className={[
                      'mb-3 flex w-full items-start gap-3 rounded-none border border-transparent px-3 py-3 text-left transition',
                      isSelected ? 'border-r-[3px] border-r-[#2f63e6] bg-[#e9edf5]' : 'bg-transparent hover:bg-[#eef1f7]',
                    ].join(' ')}
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#d7dce8] bg-[#eeeeee] shadow-[0_4px_10px_rgba(38,53,87,0.12)]">
                      <img
                        src={conversation.user.avatar}
                        alt={`${conversation.user.name} profile`}
                        className="h-full w-full object-cover"
                      />
                      <div
                        className={[
                          'absolute bottom-1 right-1 h-3 w-3 rounded-full border border-white',
                          conversation.user.status === 'online' ? 'bg-[#2bc562]' : 'bg-[#b0b8c6]',
                        ].join(' ')}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[34px] font-extrabold leading-none text-[#1f2737]">
                          {conversation.user.name}
                        </p>
                        <span className="whitespace-nowrap text-xs text-[#7f8798]">{latestMessage?.time ?? ''}</span>
                      </div>
                      <p
                        className={[
                          'mt-1 truncate text-[14px]',
                          isSelected ? 'font-bold text-[#2f63e6]' : 'text-[#707b90]',
                        ].join(' ')}
                      >
                        {latestMessage?.text ?? 'No messages yet.'}
                      </p>
                    </div>
                  </button>
                )
              })}
              {filteredConversations.length === 0 ? (
                <p className="rounded-lg border border-[#d8dde8] bg-[#eef1f7] px-3 py-3 text-sm text-[#6f7a90]">
                  No chats found.
                </p>
              ) : null}
            </div>
          </section>

          <section className="flex min-w-0 flex-1 flex-col bg-[#eef0f5]">
            <div className="flex h-[76px] items-center justify-between border-b border-[#dce0e9] bg-[#f7f8fb] px-7">
              <div className="flex items-center gap-4">
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[#d7dce8] bg-[#d8d1b4] shadow-[0_3px_8px_rgba(38,53,87,0.12)]">
                  <img
                    src={activeConversation?.user.avatar}
                    alt={`${activeConversation?.user.name ?? 'Selected user'} profile`}
                    className="h-full w-full object-cover"
                  />
                  <div
                    className={[
                      'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white',
                      activeConversation?.user.status === 'online' ? 'bg-[#31c85f]' : 'bg-[#b0b8c6]',
                    ].join(' ')}
                  />
                </div>
                <div>
                  <p className="text-[34px] font-extrabold leading-none text-[#1f2737]">
                    {activeConversation?.user.name ?? 'No chat selected'}
                  </p>
                  <p className="mt-1 text-sm text-[#657089]">
                    <span
                      className={[
                        'mr-2 inline-block h-2 w-2 rounded-full',
                        activeConversation?.user.status === 'online' ? 'bg-[#32c760]' : 'bg-[#b0b8c6]',
                      ].join(' ')}
                    />
                    {activeConversation?.user.status === 'online' ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
              <div className="mb-4 flex justify-center">
                <span className="rounded-full bg-[#dce1eb] px-4 py-1 text-xs font-semibold text-[#66728c]">TODAY</span>
              </div>

              <div ref={messagesContainerRef} className="space-y-4 overflow-y-auto">
                {activeConversation?.messages.map((message) => (
                  <div key={message.id} className={message.mine ? 'ml-auto max-w-[64%]' : 'max-w-[56%]'}>
                    <div className={message.mine ? 'rounded-3xl rounded-br-xl bg-[#2f63e6] px-5 py-4 text-white' : 'rounded-3xl rounded-bl-xl border border-[#dce1eb] bg-[#f8f9fc] px-5 py-4 text-[#2f374b]'}>
                      <p className="text-[29px] leading-relaxed">{message.text}</p>
                    </div>
                    <div className={['mt-2 flex items-center gap-2 text-xs text-[#8a93a5]', message.mine ? 'justify-end' : 'justify-start'].join(' ')}>
                      <span>{message.time}</span>
                      {message.mine ? <ReadReceipt /> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#dce0e9] bg-[#f3f4f8] px-4 py-3">
              <div className="flex h-14 items-center gap-3 rounded-2xl border border-[#d7dce7] bg-[#e9ecf3] px-4">
                <button type="button" className="text-xl text-[#8290a8]">
                  <FontAwesomeIcon icon={faPlus} />
                </button>
                <input
                  type="text"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  onKeyDown={onComposerEnter}
                  placeholder="Type a message..."
                  className="w-full bg-transparent text-[15px] text-[#2e374a] outline-none placeholder:text-[#8a93a6]"
                />
                <button
                  type="button"
                  onClick={() => setDraftMessage((current) => `${current}🙂`)}
                  className="text-xl text-[#8390a8]"
                >
                  <FontAwesomeIcon icon={faFaceSmile} />
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMessage("I'm checking and will update in a minute.")}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#1f78f0] text-white"
                >
                  <FontAwesomeIcon icon={faMicrophone} />
                </button>
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="grid h-10 w-14 place-items-center rounded-xl bg-[#2f63e6] text-xl text-white"
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default Chat
