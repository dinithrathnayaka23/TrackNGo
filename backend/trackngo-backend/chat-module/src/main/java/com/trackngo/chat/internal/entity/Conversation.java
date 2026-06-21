
package com.trackngo.chat.internal.entity;

import com.trackngo.chat.internal.entity.converters.ParticipantTypeConverter;
import com.trackngo.chat.internal.entity.enums.ParticipantType;
import com.trackngo.chat.internal.entity.converter.MessageTypeConverter;
import com.trackngo.chat.internal.entity.enums.MessageType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * JPA entity representing a chat conversation between two participants.
 * Maps to the 'conversation' table. Participant types are stored alongside IDs
 * since the chat module does not hold a foreign key to the user table.
 */
@Entity
@Data
@NoArgsConstructor
@Table(name = "conversation")
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "conversation_id")
    private Long conversationId;

    @Column(name = "participant_1_id", nullable = false)
    private Long participant1Id;

    @Convert(converter = ParticipantTypeConverter.class)
    @Column(name = "participant_1_type", nullable = false)
    private ParticipantType participant1Type;

    @Column(name = "participant_2_id", nullable = false)
    private Long participant2Id;

    @Convert(converter = ParticipantTypeConverter.class)
    @Column(name = "participant_2_type", nullable = false)
    private ParticipantType participant2Type;

    @Column(name = "participant_1_unread", nullable = false)
    private int participant1Unread;

    @Column(name = "participant_2_unread", nullable = false)
    private int participant2Unread;

    @Column(name = "last_message", columnDefinition = "TEXT")
    private String lastMessage;

    @Convert(converter = MessageTypeConverter.class)
    @Column(name = "last_message_type")
    private MessageType lastMessageType;

    @Column(name = "last_message_timestamp")
    private LocalDateTime lastMessageTimestamp;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Sets creation and update timestamps before the entity is first persisted.
     */
    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    /**
     * Refreshes the update timestamp before each update.
     */
    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}

