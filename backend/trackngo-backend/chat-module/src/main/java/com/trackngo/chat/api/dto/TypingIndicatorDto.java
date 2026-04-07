package com.trackngo.chat.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for real-time typing indicator events
 * broadcast over the WebSocket channel.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TypingIndicatorDto {

    private Long conversationId;
    private Long userId;
    private boolean typing;
}
