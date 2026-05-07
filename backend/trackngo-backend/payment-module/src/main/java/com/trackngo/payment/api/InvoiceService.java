package com.trackngo.payment.api;

import com.trackngo.payment.api.dto.InvoiceDto;

import java.util.List;

// Contract for invoice business operations used by controllers.
public interface InvoiceService {
    // Create a new invoice record.
    InvoiceDto create(InvoiceDto dto);

    // Fetch one invoice by primary key.
    InvoiceDto get(Long id);

    // Return all invoices for listing screens.
    List<InvoiceDto> getAll();

    // Update an existing invoice.
    InvoiceDto update(Long id, InvoiceDto dto);

    // Delete an invoice by id.
    void delete(Long id);
}
