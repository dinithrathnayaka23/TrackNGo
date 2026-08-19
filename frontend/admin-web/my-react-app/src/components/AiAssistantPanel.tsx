import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRobot,
  faX,
  faPaperPlane,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import {
  sendChatMessage,
  type ChatMessage,
} from "../services/aiAssistantService";

export interface AiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

type InlineSegment = {
  text: string;
  bold: boolean;
};

function parseInlineMarkdown(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}

function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((segment, index) => (
        <span key={`${segment.text}-${index}`} className={segment.bold ? "font-bold" : undefined}>
          {segment.text}
        </span>
      ))}
    </>
  );
}

function AssistantMessageContent({ content }: { content: string }) {
  return (
    <div className="space-y-1 break-words text-sm leading-relaxed">
      {content.split(/\r?\n/).map((rawLine, index) => {
        const line = rawLine.trim();
        const bullet = line.match(/^[-*]\s+(.+)$/);
        const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);

        if (!line) {
          return <div key={`space-${index}`} className="h-1" />;
        }

        if (bullet || numbered) {
          return (
            <div key={`${line}-${index}`} className="flex items-start gap-2">
              <span className="mt-[1px] w-5 shrink-0 font-bold text-[#2642a6]">
                {bullet ? "•" : `${numbered?.[1]}.`}
              </span>
              <p className="min-w-0 flex-1">
                <InlineMarkdown text={bullet?.[1] ?? numbered?.[2] ?? line} />
              </p>
            </div>
          );
        }

        return (
          <p key={`${line}-${index}`}>
            <InlineMarkdown text={line} />
          </p>
        );
      })}
    </div>
  );
}

export default function AiAssistantPanel({
  open,
  onClose,
}: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! I am **TrackNGo Admin AI**. I can summarize operations, surface urgent complaints, identify high-risk buses/drivers, and help you decide what to review next.\n\nTry: **admin dashboard summary**, **safety complaints**, or **high priority complaints**.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatId = useRef(`admin-chat-${Date.now()}`);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const reply = await sendChatMessage(input, chatId.current);
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Close AI assistant"
        className="absolute inset-0 h-full w-full bg-black/30"
        onClick={onClose}
      />
      <div className="fixed right-4 top-1/2 z-[141] w-[min(92vw,420px)] -translate-y-1/2 transform rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_25px_75px_rgba(15,23,42,0.3)]">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-gradient-to-r from-[#2642a6] to-[#1a2d7a] px-4 py-4 text-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faRobot} className="text-lg" />
            <div>
              <p className="font-semibold">TrackNGo Admin AI</p>
              <p className="text-xs opacity-90">Operations Co-pilot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-lg transition hover:opacity-75"
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faX} />
          </button>
        </div>

        <div className="h-[400px] overflow-y-auto bg-[#fafbfc] px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-[#6b7280]">
              No messages yet
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((msg) => (
                <li key={msg.id} className="flex gap-2">
                  {msg.role === "user" ? (
                    <div className="flex w-full justify-end">
                      <div className="max-w-[80%] rounded-xl bg-[#2642a6] px-3 py-2 text-sm text-white">
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <span className="mt-1 block text-xs opacity-75">
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8eefc] text-[#2642a6]">
                        <FontAwesomeIcon icon={faRobot} className="text-xs" />
                      </div>
                      <div className="max-w-[80%] rounded-xl bg-white px-3 py-2 text-[#111827]">
                        <AssistantMessageContent content={msg.content} />
                        <span className="mt-1 block text-xs text-[#9ca3af]">
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {loading && (
                <li className="flex gap-2">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8eefc] text-[#2642a6]">
                    <FontAwesomeIcon
                      icon={faSpinner}
                      className="animate-spin text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm text-[#6b7280]">
                    <span>AI is thinking</span>
                    <span className="animate-pulse">...</span>
                  </div>
                </li>
              )}
              <div ref={messagesEndRef} />
            </ul>
          )}
        </div>

        <form
          onSubmit={handleSendMessage}
          className="border-t border-[#e5e7eb] bg-white px-4 py-3 rounded-b-2xl"
        >
          {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask about operations, complaints, buses..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#9ca3af] focus:border-[#2642a6]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-[#2642a6] px-3 py-2 text-white transition disabled:opacity-50 hover:bg-[#203b96]"
              aria-label="Send message"
            >
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          </div>
          <p className="mt-2 text-xs text-[#6b7280]">
            Try: "admin dashboard summary", "safety complaints", or "high priority complaints"
          </p>
        </form>
      </div>
    </div>,
    document.body,
  );
}
