
package com.trackngo.tracking.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TrackingUpdatedEvent extends BaseEvent {
    private final Long id;
}

