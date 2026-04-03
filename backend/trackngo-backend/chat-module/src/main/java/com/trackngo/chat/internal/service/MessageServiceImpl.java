
package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.MessageService;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.chat.events.MessageCreatedEvent;
import com.trackngo.chat.internal.entity.Message;
import com.trackngo.chat.internal.repository.MessageRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {
    private final MessageRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public MessageDto create(MessageDto dto) {
        Message entity = new Message();
        entity.setName(dto.getName());
        Message saved = repository.save(entity);
        eventPublisher.publish(new MessageCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public MessageDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Message not found")));
    }

    @Override
    public List<MessageDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public MessageDto update(Long id, MessageDto dto) {
        Message entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private MessageDto toDto(Message entity) {
        MessageDto dto = new MessageDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}

