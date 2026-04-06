
package com.trackngo.chat.api;

import com.trackngo.chat.api.dto.ConversationDto;

import java.util.List;

public interface ConversationService {
    ConversationDto create(ConversationDto dto);
    ConversationDto get(Long id);
    List<ConversationDto> getAll();
    ConversationDto update(Long id, ConversationDto dto);
    void delete(Long id);
}

