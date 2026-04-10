
package com.trackngo.tracking.internal.service;

import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.tracking.api.BusLocationService;
import com.trackngo.tracking.api.dto.BusLocationDto;
import com.trackngo.tracking.events.TrackingUpdatedEvent;
import com.trackngo.tracking.internal.entity.BusLocation;
import com.trackngo.tracking.internal.repository.BusLocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BusLocationServiceImpl implements BusLocationService {
    private final BusLocationRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public BusLocationDto create(BusLocationDto dto) {
        BusLocation entity = new BusLocation();
        entity.setName(dto.getName());
        BusLocation saved = repository.save(entity);
        eventPublisher.publish(new TrackingUpdatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public BusLocationDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("BusLocation not found")));
    }

    @Override
    public List<BusLocationDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public BusLocationDto update(Long id, BusLocationDto dto) {
        BusLocation entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("BusLocation not found"));
        entity.setName(dto.getName());
        BusLocation saved = repository.save(entity);
        eventPublisher.publish(new TrackingUpdatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private BusLocationDto toDto(BusLocation entity) {
        BusLocationDto dto = new BusLocationDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}

