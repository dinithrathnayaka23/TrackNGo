package com.trackngo.app.dto;

import java.math.BigDecimal;

public record CorporateAdvancePaymentDto(
    String transactionId,
    String paymentMethod,
    BigDecimal amount
) {}
