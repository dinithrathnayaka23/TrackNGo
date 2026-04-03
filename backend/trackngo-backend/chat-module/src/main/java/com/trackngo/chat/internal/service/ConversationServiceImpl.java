
package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.ConversationService;
import com.trackngo.chat.api.dto.ConversationDto;
import com.trackngo.chat.internal.entity.Conversation;
import com.trackngo.chat.internal.repository.ConversationRepository;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversationServiceImpl implements ConversationService {
    private final ConversationRepository repository;

    @Override
    public ConversationDto create(ConversationDto dto) {
        Conversation entity = new Conversation();
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public ConversationDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found")));
    }

    @Override
    public List<ConversationDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public ConversationDto update(Long id, ConversationDto dto) {
        Conversation entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private ConversationDto toDto(Conversation entity) {
        ConversationDto dto = new ConversationDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}

