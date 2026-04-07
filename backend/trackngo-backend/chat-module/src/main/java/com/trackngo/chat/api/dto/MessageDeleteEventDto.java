package com.trackngo.chat.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO emitted when a message is soft-deleted.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageDeleteEventDto {

    private Long conversationId;
    private Long messageId;
    private Long deletedByUserId;
    private LocalDateTime deletedAt;
}
