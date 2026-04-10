package com.trackngo.driverfleet.internal.service;

import com.trackngo.driverfleet.api.DriverService;
import com.trackngo.driverfleet.api.dto.DriverDto;
import com.trackngo.driverfleet.events.DriverCreatedEvent;
import com.trackngo.driverfleet.internal.entity.Driver;
import com.trackngo.driverfleet.internal.repository.DriverRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverServiceImpl implements DriverService {
    private final DriverRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public DriverDto create(DriverDto dto) {
        Driver entity = new Driver();
        entity.setName(dto.getName());
        Driver saved = repository.save(entity);
        eventPublisher.publish(new DriverCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public DriverDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Driver not found")));
    }

    @Override
    public List<DriverDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public DriverDto update(Long id, DriverDto dto) {
        Driver entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private DriverDto toDto(Driver entity) {
        DriverDto dto = new DriverDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
