package com.trackngo.driverfleet.internal.service;

import com.trackngo.driverfleet.api.BusService;
import com.trackngo.driverfleet.api.dto.BusDto;
import com.trackngo.driverfleet.events.BusCreatedEvent;
import com.trackngo.driverfleet.internal.entity.FleetBus;
import com.trackngo.driverfleet.internal.repository.FleetBusRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BusServiceImpl implements BusService {
    private final FleetBusRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public BusDto create(BusDto dto) {
        FleetBus entity = new FleetBus();
        entity.setName(dto.getName());
        FleetBus saved = repository.save(entity);
        eventPublisher.publish(new BusCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public BusDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Bus not found")));
    }

    @Override
    public List<BusDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public BusDto update(Long id, BusDto dto) {
        FleetBus entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Bus not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private BusDto toDto(FleetBus entity) {
        BusDto dto = new BusDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
