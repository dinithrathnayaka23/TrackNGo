package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.TripService;
import com.trackngo.booking.api.dto.TripDto;
import com.trackngo.booking.events.TripCreatedEvent;
import com.trackngo.booking.internal.entity.Trip;
import com.trackngo.booking.internal.repository.TripRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TripServiceImpl implements TripService {
    private final TripRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public TripDto create(TripDto dto) {
        Trip entity = new Trip();
        entity.setName(dto.getName());
        Trip saved = repository.save(entity);
        eventPublisher.publish(new TripCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public TripDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Trip not found")));
    }

    @Override
    public List<TripDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public TripDto update(Long id, TripDto dto) {
        Trip entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Trip not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private TripDto toDto(Trip entity) {
        TripDto dto = new TripDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
