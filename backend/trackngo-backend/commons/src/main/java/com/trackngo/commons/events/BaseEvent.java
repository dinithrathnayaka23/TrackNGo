
package com.trackngo.commons.events;

import java.time.Instant;

public abstract class BaseEvent {
    private final Instant occurredAt = Instant.now();

    public Instant getOccurredAt() {
        return occurredAt;
    }
}

