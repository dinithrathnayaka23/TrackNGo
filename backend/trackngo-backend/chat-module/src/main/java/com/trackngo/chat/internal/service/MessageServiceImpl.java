
package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.MessageService;
import com.trackngo.chat.api.dto.MessageDeleteEventDto;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.chat.api.dto.MessageStatusUpdateDto;
import com.trackngo.chat.api.dto.PagedResponseDto;
import com.trackngo.chat.events.MessageCreatedEvent;
import com.trackngo.chat.internal.entity.ChatMessage;
import com.trackngo.chat.internal.entity.Conversation;
import com.trackngo.chat.internal.entity.enums.MessageType;
import com.trackngo.chat.internal.entity.enums.ParticipantType;
import com.trackngo.chat.internal.repository.ConversationRepository;
import com.trackngo.chat.internal.repository.MessageRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

/**
 * Implementation of {@link MessageService} managing chat messages,
 * read receipts, and message deletion.
 */
@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationServiceImpl conversationService;
    private final EventPublisher eventPublisher;

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public MessageDto sendMessage(MessageDto dto) {
        validateSendRequest(dto);

        Conversation conversation = resolveConversation(dto);
        validateParticipant(conversation, dto.getSenderId());

        ParticipantType senderType = deriveSenderType(conversation, dto.getSenderId());
        MessageType messageType = MessageType.fromValue(dto.getMessageType());

        ChatMessage entity = new ChatMessage();
        entity.setConversation(conversation);
        entity.setSenderId(dto.getSenderId());
        entity.setSenderType(senderType);
        entity.setMessageType(messageType);
        entity.setContent(dto.getContent() == null ? "" : dto.getContent().trim());
        entity.setMediaUrl(dto.getMediaUrl());
        entity.setLatitude(dto.getLatitude());
        entity.setLongitude(dto.getLongitude());
        entity.setRead(false);
        entity.setDeleted(false);

        incrementUnreadCount(conversation, dto.getSenderId());
        conversation.setLastMessage(buildPreview(entity));
        conversation.setLastMessageTimestamp(LocalDateTime.now());

        ChatMessage saved = messageRepository.save(entity);
        conversationRepository.save(conversation);

        eventPublisher.publish(new MessageCreatedEvent(
                saved.getMessageId(), conversation.getConversationId()));

        return toDto(saved, conversation, dto.getClientMessageId());
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public PagedResponseDto<MessageDto> getConversationMessages(Long conversationId,
                                                                 int page, int size,
                                                                 LocalDateTime before) {
        Conversation conversation = conversationService.getConversationEntity(conversationId);
        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<ChatMessage> result;
        if (before != null) {
            result = messageRepository
                    .findByConversation_ConversationIdAndCreatedAtBeforeOrderByCreatedAtDesc(
                            conversationId, before, pageable);
        } else {
            result = messageRepository
                    .findByConversation_ConversationIdOrderByCreatedAtDesc(
                            conversationId, pageable);
        }

        Page<MessageDto> dtoPage = result.map(msg -> toDto(msg, conversation, null));
        return PagedResponseDto.<MessageDto>builder()
                .content(dtoPage.getContent())
                .page(dtoPage.getNumber())
                .size(dtoPage.getSize())
                .totalElements(dtoPage.getTotalElements())
                .totalPages(dtoPage.getTotalPages())
                .last(dtoPage.isLast())
                .build();
    }

    /**
     * {@inheritDoc}
     * Delivery status is not tracked in the current schema; returns an empty list.
     */
    @Override
    @Transactional
    public List<MessageStatusUpdateDto> markConversationDelivered(Long conversationId,
                                                                   Long userId) {
        conversationService.getConversationEntity(conversationId);
        return Collections.emptyList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public List<MessageStatusUpdateDto> markConversationRead(Long conversationId,
                                                              Long userId) {
        Conversation conversation = conversationService.getConversationEntity(conversationId);
        validateParticipant(conversation, userId);

        List<ChatMessage> unread = messageRepository
                .findUnreadByConversationAndRecipient(conversationId, userId);

        for (ChatMessage message : unread) {
            message.setRead(true);
        }
        messageRepository.saveAll(unread);

        resetUnreadCount(conversation, userId);
        conversationRepository.save(conversation);

        return unread.stream()
                .map(msg -> MessageStatusUpdateDto.builder()
                        .conversationId(conversationId)
                        .messageId(msg.getMessageId())
                        .status("READ")
                        .build())
                .toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public MessageDeleteEventDto deleteMessage(Long messageId, Long userId) {
        ChatMessage message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Message not found with id: " + messageId));

        Conversation conversation = message.getConversation();
        validateParticipant(conversation, userId);

        if (!userId.equals(message.getSenderId())) {
            throw new BusinessException("Only the message sender can delete a message");
        }
        if (message.isDeleted()) {
            throw new BusinessException("Message is already deleted");
        }

        message.setDeleted(true);
        message.setContent("[Message deleted]");
        message.setMediaUrl(null);
        messageRepository.save(message);

        refreshConversationPreview(conversation);

        return MessageDeleteEventDto.builder()
                .conversationId(conversation.getConversationId())
                .messageId(message.getMessageId())
                .deletedByUserId(userId)
                .deletedAt(LocalDateTime.now())
                .build();
    }

    // ── Private helpers ─────────────────────────────────────────────────

    /**
     * Validates the required fields on an incoming message DTO.
     */
    private void validateSendRequest(MessageDto dto) {
        if (dto.getSenderId() == null) {
            throw new BusinessException("senderId is required");
        }
        if (dto.getConversationId() == null && dto.getRecipientId() == null) {
            throw new BusinessException("conversationId or recipientId is required");
        }

        boolean isLocation = "LOCATION".equalsIgnoreCase(dto.getMessageType());
        boolean hasContent = dto.getContent() != null && !dto.getContent().isBlank();
        boolean hasMedia = dto.getMediaUrl() != null && !dto.getMediaUrl().isBlank();
        boolean hasCoords = dto.getLatitude() != null && dto.getLongitude() != null;

        if (!hasContent && !hasMedia && !hasCoords) {
            throw new BusinessException("Either content, mediaUrl, or location coordinates is required");
        }
        if (isLocation && !hasCoords) {
            throw new BusinessException("latitude and longitude are required for location messages");
        }
    }

    /**
     * Resolves the conversation for an incoming message, creating one if necessary.
     */
    private Conversation resolveConversation(MessageDto dto) {
        if (dto.getConversationId() != null) {
            return conversationService.getConversationEntity(dto.getConversationId());
        }

        Long senderId = dto.getSenderId();
        Long recipientId = dto.getRecipientId();

        return conversationRepository.findBetweenUsers(senderId, recipientId)
                .orElseGet(() -> {
                    String senderTypeStr = dto.getSenderType() != null
                            ? dto.getSenderType()
                            : conversationRepository.findUserTypeByUserId(senderId)
                                    .orElse("passenger");
                    String recipientTypeStr = conversationRepository
                            .findUserTypeByUserId(recipientId).orElse("passenger");

                    Conversation created = new Conversation();
                    created.setParticipant1Id(senderId);
                    created.setParticipant1Type(ParticipantType.fromValue(senderTypeStr));
                    created.setParticipant2Id(recipientId);
                    created.setParticipant2Type(ParticipantType.fromValue(recipientTypeStr));
                    created.setParticipant1Unread(0);
                    created.setParticipant2Unread(0);
                    return conversationRepository.save(created);
                });
    }

    /**
     * Validates that the given userId is one of the conversation's participants.
     */
    private void validateParticipant(Conversation conversation, Long userId) {
        boolean isP1 = userId.equals(conversation.getParticipant1Id());
        boolean isP2 = userId.equals(conversation.getParticipant2Id());
        if (!isP1 && !isP2) {
            throw new BusinessException("User is not a participant in this conversation");
        }
    }

    /**
     * Derives the sender's ParticipantType from the conversation metadata.
     */
    private ParticipantType deriveSenderType(Conversation conversation, Long senderId) {
        if (senderId.equals(conversation.getParticipant1Id())) {
            return conversation.getParticipant1Type();
        }
        return conversation.getParticipant2Type();
    }

    /**
     * Increments the unread count for the OTHER participant (not the sender).
     */
    private void incrementUnreadCount(Conversation conversation, Long senderId) {
        if (senderId.equals(conversation.getParticipant1Id())) {
            conversation.setParticipant2Unread(conversation.getParticipant2Unread() + 1);
        } else {
            conversation.setParticipant1Unread(conversation.getParticipant1Unread() + 1);
        }
    }

    /**
     * Resets the unread count for the user (after marking messages as read).
     */
    private void resetUnreadCount(Conversation conversation, Long userId) {
        if (userId.equals(conversation.getParticipant1Id())) {
            conversation.setParticipant1Unread(0);
        } else {
            conversation.setParticipant2Unread(0);
        }
    }

    /**
     * Builds a short text preview for a message (used as conversation.lastMessage).
     */
    private String buildPreview(ChatMessage message) {
        if (message.getContent() != null && !message.getContent().isBlank()) {
            return message.getContent();
        }
        return switch (message.getMessageType()) {
            case IMAGE -> "[Image]";
            case VOICE -> "[Voice message]";
            case LOCATION -> "[Location]";
            default -> "[Message]";
        };
    }

    /**
     * Refreshes the conversation's last message preview after a deletion.
     */
    private void refreshConversationPreview(Conversation conversation) {
        messageRepository
                .findTopByConversation_ConversationIdAndDeletedFalseOrderByCreatedAtDesc(
                        conversation.getConversationId())
                .ifPresentOrElse(
                        last -> {
                            conversation.setLastMessage(buildPreview(last));
                            conversation.setLastMessageTimestamp(last.getCreatedAt());
                        },
                        () -> {
                            conversation.setLastMessage(null);
                            conversation.setLastMessageTimestamp(null);
                        });
        conversationRepository.save(conversation);
    }

    /**
     * Converts a ChatMessage entity to a MessageDto.
     * Derives status and read-by-participant flags from the simplified is_read schema.
     */
    MessageDto toDto(ChatMessage entity, Conversation conversation, String clientMessageId) {
        boolean senderIsP1 = entity.getSenderId().equals(conversation.getParticipant1Id());
        Long recipientId = senderIsP1
                ? conversation.getParticipant2Id()
                : conversation.getParticipant1Id();

        boolean readByP1 = senderIsP1 || entity.isRead();
        boolean readByP2 = !senderIsP1 || entity.isRead();
        String status = entity.isRead() ? "READ" : "SENT";

        return MessageDto.builder()
                .messageId(entity.getMessageId())
                .conversationId(conversation.getConversationId())
                .senderId(entity.getSenderId())
                .recipientId(recipientId)
                .senderType(entity.getSenderType().name())
                .content(entity.getContent())
                .messageType(entity.getMessageType().name())
                .status(status)
                .clientMessageId(clientMessageId)
                .mediaUrl(entity.getMediaUrl())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .readByParticipant1(readByP1)
                .readByParticipant2(readByP2)
                .deleted(entity.isDeleted())
                .createdAt(entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null)
                .build();
    }
}

