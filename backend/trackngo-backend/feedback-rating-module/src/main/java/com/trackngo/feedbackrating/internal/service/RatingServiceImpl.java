package com.trackngo.feedbackrating.internal.service;

import com.trackngo.feedbackrating.api.RatingService;
import com.trackngo.feedbackrating.api.dto.RatingDto;
import com.trackngo.feedbackrating.events.RatingCreatedEvent;
import com.trackngo.feedbackrating.internal.entity.Rating;
import com.trackngo.feedbackrating.internal.repository.RatingRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RatingServiceImpl implements RatingService {
    private final RatingRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public RatingDto create(RatingDto dto) {
        Rating entity = new Rating();
        entity.setName(dto.getName());
        Rating saved = repository.save(entity);
        eventPublisher.publish(new RatingCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public RatingDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Rating not found")));
    }

    @Override
    public List<RatingDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public RatingDto update(Long id, RatingDto dto) {
        Rating entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Rating not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private RatingDto toDto(Rating entity) {
        RatingDto dto = new RatingDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
