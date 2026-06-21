package com.trackngo.commons.events;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;

@Component
public class EventPublisher {
    private final ApplicationEventPublisher publisher;

    @Autowired
    public EventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(BaseEvent event) {
        publisher.publishEvent(event);
    }
}