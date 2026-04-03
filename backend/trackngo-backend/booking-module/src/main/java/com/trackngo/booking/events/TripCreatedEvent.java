package com.trackngo.booking.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TripCreatedEvent extends BaseEvent {
    private final Long id;
}
