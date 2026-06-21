package com.trackngo.payment.internal.repository;

import com.trackngo.payment.internal.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

// JPA repository gives built-in CRUD methods for Payment.
public interface PaymentRepository extends JpaRepository<Payment, Long> {
}
