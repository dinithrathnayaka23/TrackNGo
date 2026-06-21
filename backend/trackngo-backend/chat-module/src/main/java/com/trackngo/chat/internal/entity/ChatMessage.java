package com.trackngo.chat.internal.entity;

import com.trackngo.chat.internal.entity.enums.MessageType;
import com.trackngo.chat.internal.entity.enums.ParticipantType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * JPA entity representing a single chat message.
 * Maps to the 'chat_message' table in the database.
 */
@Entity
@Data
@NoArgsConstructor
@Table(name = "chat_message")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "message_id")
    private Long messageId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(name = "sender_type", nullable = false)
    private ParticipantType senderType;

    @Column(name = "recipient_id")
    private Long recipientId;

    @Column(name = "message_type")
    private MessageType messageType;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "client_message_id")
    private String clientMessageId;

    @Column(name = "media_url", columnDefinition = "TEXT")
    private String mediaUrl;

    @Column(name = "compressed_media_url", columnDefinition = "TEXT")
    private String compressedMediaUrl;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "media_mime_type")
    private String mediaMimeType;

    @Column(name = "media_size_bytes")
    private Long mediaSizeBytes;

    @Column(name = "compressed_size_bytes")
    private Long compressedSizeBytes;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Sets the creation timestamp before the entity is first persisted.
     */
    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
