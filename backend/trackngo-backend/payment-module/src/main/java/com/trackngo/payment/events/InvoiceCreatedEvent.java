package com.trackngo.payment.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class InvoiceCreatedEvent extends BaseEvent {
    private final Long id;
}
