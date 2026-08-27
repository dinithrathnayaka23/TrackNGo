
package com.trackngo.chat.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data transfer object representing a conversation summary.
 * Used in REST responses and inter-module communication.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationDto {

    private Long conversationId;
    private Long participant1Id;
    private Long participant2Id;
    private String participant1Type;
    private String participant2Type;
    private Long otherParticipantId;
    private String otherParticipantName;
    private String otherParticipantType;
    /** Stored path of the other participant's avatar; null when they have not set one. */
    private String otherParticipantPhoto;
    private int unreadCount;
    private int participant1Unread;
    private int participant2Unread;
    private String lastMessage;
    private String lastMessageType;
    private String lastMessageTimestamp;
}

