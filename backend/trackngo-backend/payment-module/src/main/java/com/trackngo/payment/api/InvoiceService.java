package com.trackngo.payment.api;

import com.trackngo.payment.api.dto.InvoiceDto;

import java.util.List;

public interface InvoiceService {
    InvoiceDto create(InvoiceDto dto);
    InvoiceDto get(Long id);
    List<InvoiceDto> getAll();
    InvoiceDto update(Long id, InvoiceDto dto);
    void delete(Long id);
}
