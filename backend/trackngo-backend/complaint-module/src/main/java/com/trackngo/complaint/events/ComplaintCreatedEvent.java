package com.trackngo.complaint.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ComplaintCreatedEvent extends BaseEvent {
    private final Long id;
}
