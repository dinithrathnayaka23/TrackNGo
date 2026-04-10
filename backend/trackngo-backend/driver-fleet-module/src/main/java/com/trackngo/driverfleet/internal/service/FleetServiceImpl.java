package com.trackngo.driverfleet.internal.service;

import com.trackngo.driverfleet.api.FleetService;
import com.trackngo.driverfleet.api.dto.FleetDto;
import com.trackngo.driverfleet.events.FleetCreatedEvent;
import com.trackngo.driverfleet.internal.entity.Fleet;
import com.trackngo.driverfleet.internal.repository.FleetRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FleetServiceImpl implements FleetService {
    private final FleetRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public FleetDto create(FleetDto dto) {
        Fleet entity = new Fleet();
        entity.setName(dto.getName());
        Fleet saved = repository.save(entity);
        eventPublisher.publish(new FleetCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public FleetDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Fleet not found")));
    }

    @Override
    public List<FleetDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public FleetDto update(Long id, FleetDto dto) {
        Fleet entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Fleet not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private FleetDto toDto(Fleet entity) {
        FleetDto dto = new FleetDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
