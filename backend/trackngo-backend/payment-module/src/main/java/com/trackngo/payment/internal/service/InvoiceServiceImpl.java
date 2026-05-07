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
    // Database access for invoice records.
    private final InvoiceRepository repository;
    // Emits domain events so other modules can react asynchronously.
    private final EventPublisher eventPublisher;

    @Override
    public InvoiceDto create(InvoiceDto dto) {
        // Map incoming DTO to a new entity.
        Invoice entity = new Invoice();
        entity.setName(dto.getName());

        // Persist first so we can publish with a real generated id.
        Invoice saved = repository.save(entity);
        eventPublisher.publish(new InvoiceCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public InvoiceDto get(Long id) {
        // Throw a clear 404-style exception when id does not exist.
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found")));
    }

    @Override
    public List<InvoiceDto> getAll() {
        // Convert entities to DTOs before returning outside service layer.
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public InvoiceDto update(Long id, InvoiceDto dto) {
        // Update works on existing record only.
        Invoice entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        // Direct delete by id; upstream layers decide id validity behavior.
        repository.deleteById(id);
    }

    private InvoiceDto toDto(Invoice entity) {
        // Centralized mapper keeps response format consistent.
        InvoiceDto dto = new InvoiceDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
