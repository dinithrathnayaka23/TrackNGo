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
    private final PaymentRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public PaymentDto create(PaymentDto dto) {
        Payment entity = new Payment();
        entity.setName(dto.getName());
        Payment saved = repository.save(entity);
        eventPublisher.publish(new PaymentCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public PaymentDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Payment not found")));
    }

    @Override
    public List<PaymentDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public PaymentDto update(Long id, PaymentDto dto) {
        Payment entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private PaymentDto toDto(Payment entity) {
        PaymentDto dto = new PaymentDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
