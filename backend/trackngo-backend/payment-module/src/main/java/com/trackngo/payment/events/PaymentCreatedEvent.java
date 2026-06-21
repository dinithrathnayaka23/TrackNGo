package com.trackngo.payment.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PaymentCreatedEvent extends BaseEvent {
    // Identifier of the payment that was just persisted.
    private final Long id;
}
