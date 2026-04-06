package com.trackngo.payment.api;

import com.trackngo.payment.api.dto.PaymentDto;

import java.util.List;

public interface PaymentService {
    PaymentDto create(PaymentDto dto);
    PaymentDto get(Long id);
    List<PaymentDto> getAll();
    PaymentDto update(Long id, PaymentDto dto);
    void delete(Long id);
}
