package com.trackngo.notification.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class NotificationCreatedEvent extends BaseEvent {
    private final Long id;
}
