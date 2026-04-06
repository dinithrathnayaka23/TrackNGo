
package com.trackngo.chat.api;

import com.trackngo.chat.api.dto.MessageDto;

import java.util.List;

public interface MessageService {
    MessageDto create(MessageDto dto);
    MessageDto get(Long id);
    List<MessageDto> getAll();
    MessageDto update(Long id, MessageDto dto);
    void delete(Long id);
}

