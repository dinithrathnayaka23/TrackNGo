package com.trackngo.feedbackrating.internal.service;

import com.trackngo.feedbackrating.api.FeedbackService;
import com.trackngo.feedbackrating.api.dto.FeedbackDto;
import com.trackngo.feedbackrating.events.FeedbackCreatedEvent;
import com.trackngo.feedbackrating.internal.entity.Feedback;
import com.trackngo.feedbackrating.internal.repository.FeedbackRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FeedbackServiceImpl implements FeedbackService {
    private final FeedbackRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public FeedbackDto create(FeedbackDto dto) {
        Feedback entity = new Feedback();
        entity.setName(dto.getName());
        Feedback saved = repository.save(entity);
        eventPublisher.publish(new FeedbackCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public FeedbackDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Feedback not found")));
    }

    @Override
    public List<FeedbackDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public FeedbackDto update(Long id, FeedbackDto dto) {
        Feedback entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Feedback not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private FeedbackDto toDto(Feedback entity) {
        FeedbackDto dto = new FeedbackDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
