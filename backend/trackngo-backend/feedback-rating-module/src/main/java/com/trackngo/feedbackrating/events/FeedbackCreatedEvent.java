package com.trackngo.feedbackrating.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class FeedbackCreatedEvent extends BaseEvent {
    private final Long id;
}
