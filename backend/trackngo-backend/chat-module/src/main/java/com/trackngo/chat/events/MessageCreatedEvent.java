
package com.trackngo.chat.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MessageCreatedEvent extends BaseEvent {
    private final Long id;
}

