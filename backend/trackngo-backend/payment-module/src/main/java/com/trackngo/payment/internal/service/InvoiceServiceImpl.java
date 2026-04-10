package com.trackngo.payment.internal.service;

import com.trackngo.payment.api.InvoiceService;
import com.trackngo.payment.api.dto.InvoiceDto;
import com.trackngo.payment.events.InvoiceCreatedEvent;
import com.trackngo.payment.internal.entity.Invoice;
import com.trackngo.payment.internal.repository.InvoiceRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InvoiceServiceImpl implements InvoiceService {
    private final InvoiceRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public InvoiceDto create(InvoiceDto dto) {
        Invoice entity = new Invoice();
        entity.setName(dto.getName());
        Invoice saved = repository.save(entity);
        eventPublisher.publish(new InvoiceCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public InvoiceDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found")));
    }

    @Override
    public List<InvoiceDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public InvoiceDto update(Long id, InvoiceDto dto) {
        Invoice entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private InvoiceDto toDto(Invoice entity) {
        InvoiceDto dto = new InvoiceDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
