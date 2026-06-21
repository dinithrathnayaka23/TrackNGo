package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.SeatService;
import com.trackngo.booking.api.dto.SeatDto;
import com.trackngo.booking.events.SeatCreatedEvent;
import com.trackngo.booking.internal.entity.Seat;
import com.trackngo.booking.internal.repository.SeatRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SeatServiceImpl implements SeatService {
    private final SeatRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public SeatDto create(SeatDto dto) {
        Seat entity = new Seat();
        entity.setName(dto.getName());
        Seat saved = repository.save(entity);
        eventPublisher.publish(new SeatCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public SeatDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Seat not found")));
    }

    @Override
    public List<SeatDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public SeatDto update(Long id, SeatDto dto) {
        Seat entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Seat not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private SeatDto toDto(Seat entity) {
        SeatDto dto = new SeatDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
