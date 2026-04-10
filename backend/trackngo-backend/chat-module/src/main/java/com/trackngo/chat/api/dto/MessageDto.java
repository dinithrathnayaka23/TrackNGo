
package com.trackngo.chat.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data transfer object for a chat message.
 * Contains all fields expected by the frontend client, including
 * derived fields mapped from the simplified database schema.
 * <p>
 * Date/time fields are kept as ISO-8601 strings so that the STOMP
 * message converter can handle them without requiring a configured
 * Jackson JavaTimeModule registration on the messaging layer.
 * </p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageDto {

    private Long messageId;
    private Long conversationId;
    private Long senderId;
    private Long recipientId;
    private String senderType;
    private String content;
    private String messageType;
    private String status;
    private String clientMessageId;
    private String mediaUrl;
    private String compressedMediaUrl;
    private String fileName;
    private String mediaMimeType;
    private Long mediaSizeBytes;
    private Long compressedSizeBytes;
    private Integer durationSeconds;
    private Double latitude;
    private Double longitude;
    private Boolean readByParticipant1;
    private Boolean readByParticipant2;
    private Boolean deleted;
    /** ISO-8601 string, e.g. {@code "2025-04-07T14:30:00.123"}. */
    private String createdAt;
    /** ISO-8601 string. */
    private String deliveredAt;
    /** ISO-8601 string. */
    private String readAt;
}

