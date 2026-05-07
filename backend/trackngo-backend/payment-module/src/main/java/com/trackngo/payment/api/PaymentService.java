package com.trackngo.payment.api;

import com.trackngo.payment.api.dto.PaymentDto;

import java.util.List;

// Contract for payment business operations used by controllers.
public interface PaymentService {
    // Create a new payment record.
    PaymentDto create(PaymentDto dto);

    // Fetch one payment by primary key.
    PaymentDto get(Long id);

    // Return all payments for listing screens.
    List<PaymentDto> getAll();

    // Update an existing payment.
    PaymentDto update(Long id, PaymentDto dto);

    // Delete a payment by id.
    void delete(Long id);
}
