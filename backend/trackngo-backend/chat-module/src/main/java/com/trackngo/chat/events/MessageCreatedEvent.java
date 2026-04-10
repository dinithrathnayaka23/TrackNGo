
package com.trackngo.chat.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.Getter;

/**
 * Domain event published when a new chat message is created.
 * Other modules can listen for this event to trigger side effects
 * such as push notifications or analytics.
 */
@Getter
public class MessageCreatedEvent extends BaseEvent {

    private final Long messageId;
    private final Long conversationId;

    public MessageCreatedEvent(Long messageId, Long conversationId) {
        this.messageId = messageId;
        this.conversationId = conversationId;
    }
}

