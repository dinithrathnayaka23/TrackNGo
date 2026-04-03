package com.trackngo.feedbackrating.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class RatingCreatedEvent extends BaseEvent {
    private final Long id;
}
