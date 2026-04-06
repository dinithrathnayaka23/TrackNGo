package com.trackngo.admin.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AdminLogCreatedEvent extends BaseEvent {
    private final Long id;
}
