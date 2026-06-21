package com.trackngo.payment.internal.service;

import com.trackngo.payment.api.PaymentService;
import com.trackngo.payment.api.dto.PaymentDto;
import com.trackngo.payment.events.PaymentCreatedEvent;
import com.trackngo.payment.internal.entity.Payment;
import com.trackngo.payment.internal.repository.PaymentRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {
    // Database access for payment records.
    private final PaymentRepository repository;
    // Emits domain events so other modules can react asynchronously.
    private final EventPublisher eventPublisher;

    @Override
    public PaymentDto create(PaymentDto dto) {
        // Map incoming DTO to a new entity.
        Payment entity = new Payment();
        entity.setName(dto.getName());

        // Persist first so we can publish with a real generated id.
        Payment saved = repository.save(entity);
        eventPublisher.publish(new PaymentCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public PaymentDto get(Long id) {
        // Throw a clear 404-style exception when id does not exist.
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Payment not found")));
    }

    @Override
    public List<PaymentDto> getAll() {
        // Convert entities to DTOs before returning outside service layer.
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public PaymentDto update(Long id, PaymentDto dto) {
        // Update works on existing record only.
        Payment entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        // Direct delete by id; upstream layers decide id validity behavior.
        repository.deleteById(id);
    }

    private PaymentDto toDto(Payment entity) {
        // Centralized mapper keeps response format consistent.
        PaymentDto dto = new PaymentDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
