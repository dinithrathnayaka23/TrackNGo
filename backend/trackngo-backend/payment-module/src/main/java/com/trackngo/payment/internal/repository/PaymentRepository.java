package com.trackngo.payment.internal.repository;

import com.trackngo.payment.internal.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
}
