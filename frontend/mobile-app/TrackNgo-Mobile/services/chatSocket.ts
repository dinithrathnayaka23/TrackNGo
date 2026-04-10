import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL, SOCKJS_ENDPOINT, STOMP_APP_PREFIX, STOMP_TOPIC_PREFIX } from "../config/env";
import type {
  ChatMessage,
  MessageDeleteEvent,
  MessageStatusUpdate,
  TypingIndicator
} from "../types/chat";

type Unsubscribe = () => void;

export class ChatSocketClient {
  private client: Client;
  private isConnected = false;
  private pendingSubscriptions: Array<() => void> = [];

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL}${SOCKJS_ENDPOINT}`),
      reconnectDelay: 1500
    });

    this.client.onConnect = () => {
      this.isConnected = true;
      this.pendingSubscriptions.forEach((subscribe) => subscribe());
      this.pendingSubscriptions = [];
    };

    this.client.onDisconnect = () => {
      this.isConnected = false;
    };
  }

  connect() {
    if (!this.client.active) {
      this.client.activate();
    }
  }

  disconnect() {
    if (this.client.active) {
      this.client.deactivate();
    }
  }

  publishMessage(payload: ChatMessage) {
    this.client.publish({
      destination: `${STOMP_APP_PREFIX}/sendMessage`,
      body: JSON.stringify(payload)
    });
  }

  publishTyping(payload: TypingIndicator) {
    this.client.publish({
      destination: `${STOMP_APP_PREFIX}/typing`,
      body: JSON.stringify(payload)
    });
  }

  subscribeConversation(
    conversationId: number,
    handlers: {
      onMessage: (message: ChatMessage) => void;
      onTyping: (typing: TypingIndicator) => void;
      onStatus: (status: MessageStatusUpdate[]) => void;
      onDeleted: (event: MessageDeleteEvent) => void;
    }
  ): Unsubscribe {
    const subscriptions: StompSubscription[] = [];

    const subscribeNow = () => {
      subscriptions.push(
        this.subscribeJson(
          `${STOMP_TOPIC_PREFIX}/conversations/${conversationId}`,
          handlers.onMessage
        )
      );
      subscriptions.push(
        this.subscribeJson(
          `${STOMP_TOPIC_PREFIX}/conversations/${conversationId}/typing`,
          handlers.onTyping
        )
      );
      subscriptions.push(
        this.subscribeJson(
          `${STOMP_TOPIC_PREFIX}/conversations/${conversationId}/status`,
          handlers.onStatus
        )
      );
      subscriptions.push(
        this.subscribeJson(
          `${STOMP_TOPIC_PREFIX}/conversations/${conversationId}/deleted`,
          handlers.onDeleted
        )
      );
    };

    if (this.isConnected) {
      subscribeNow();
    } else {
      this.pendingSubscriptions.push(subscribeNow);
    }

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }

  private subscribeJson<T>(
    destination: string,
    callback: (payload: T) => void
  ): StompSubscription {
    return this.client.subscribe(destination, (frame: IMessage) => {
      callback(JSON.parse(frame.body) as T);
    });
  }
}

export const chatSocket = new ChatSocketClient();
