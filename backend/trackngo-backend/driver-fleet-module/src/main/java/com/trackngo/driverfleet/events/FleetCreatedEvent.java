package com.trackngo.driverfleet.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class FleetCreatedEvent extends BaseEvent {
    private final Long id;
}
