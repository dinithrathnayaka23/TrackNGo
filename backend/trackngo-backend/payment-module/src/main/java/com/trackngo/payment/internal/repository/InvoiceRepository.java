package com.trackngo.payment.internal.repository;

import com.trackngo.payment.internal.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

// JPA repository gives built-in CRUD methods for Invoice.
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
}
