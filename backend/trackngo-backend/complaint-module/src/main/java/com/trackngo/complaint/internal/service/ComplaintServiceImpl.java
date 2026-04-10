package com.trackngo.complaint.internal.service;

import com.trackngo.complaint.api.ComplaintService;
import com.trackngo.complaint.api.dto.ComplaintDto;
import com.trackngo.complaint.events.ComplaintCreatedEvent;
import com.trackngo.complaint.internal.entity.Complaint;
import com.trackngo.complaint.internal.repository.ComplaintRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ComplaintServiceImpl implements ComplaintService {
    private final ComplaintRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public ComplaintDto create(ComplaintDto dto) {
        Complaint entity = new Complaint();
        entity.setName(dto.getName());
        Complaint saved = repository.save(entity);
        eventPublisher.publish(new ComplaintCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public ComplaintDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Complaint not found")));
    }

    @Override
    public List<ComplaintDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public ComplaintDto update(Long id, ComplaintDto dto) {
        Complaint entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Complaint not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private ComplaintDto toDto(Complaint entity) {
        ComplaintDto dto = new ComplaintDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
