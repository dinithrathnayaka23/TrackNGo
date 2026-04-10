
package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.ConversationService;
import com.trackngo.chat.api.dto.ConversationDto;
import com.trackngo.chat.api.dto.PagedResponseDto;
import com.trackngo.chat.internal.entity.Conversation;
import com.trackngo.chat.internal.entity.enums.ParticipantType;
import com.trackngo.chat.internal.repository.ConversationRepository;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation of {@link ConversationService} managing chat conversations.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationServiceImpl implements ConversationService {

    private final ConversationRepository conversationRepository;

    /**
     * {@inheritDoc}
     * If participant types are not provided, they are resolved from the user table.
     */
    @Override
    @Transactional
    public ConversationDto getOrCreateConversation(Long user1Id, String user1Type,
                                                    Long user2Id, String user2Type) {
        if (user1Id != null && user1Id.equals(user2Id)) {
            throw new BusinessException("Cannot create a conversation with the same user");
        }

        return conversationRepository.findBetweenUsers(user1Id, user2Id)
                .map(this::toDto)
                .orElseGet(() -> {
                    String resolvedType1 = resolveParticipantType(user1Id, user1Type);
                    String resolvedType2 = resolveParticipantType(user2Id, user2Type);

                    Conversation conversation = new Conversation();
                    conversation.setParticipant1Id(user1Id);
                    conversation.setParticipant1Type(ParticipantType.fromValue(resolvedType1));
                    conversation.setParticipant2Id(user2Id);
                    conversation.setParticipant2Type(ParticipantType.fromValue(resolvedType2));
                    conversation.setParticipant1Unread(0);
                    conversation.setParticipant2Unread(0);
                    return toDto(conversationRepository.save(conversation));
                });
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public PagedResponseDto<ConversationDto> getUserConversations(Long userId, int page,
                                                                   int size, String query) {
        if (userId == null || userId <= 0) {
            throw new BusinessException("Invalid user ID: " + userId);
        }
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<Conversation> result;
            if (query != null && !query.isBlank()) {
                result = conversationRepository.findUserConversationsWithSearch(userId, query, pageable);
            } else {
                result = conversationRepository.findUserConversations(userId, pageable);
            }
            
            if (result == null) {
                return PagedResponseDto.<ConversationDto>builder()
                        .content(new java.util.ArrayList<>())
                        .page(page)
                        .size(size)
                        .totalElements(0)
                        .totalPages(0)
                        .last(true)
                        .build();
            }
            
            return toPagedResponse(result.map(this::toDto));
        } catch (Exception ex) {
            log.error("Failed to load conversations for user {}", userId, ex);
            throw new BusinessException("Failed to load conversations: " + ex.getMessage());
        }
    }

    /**
     * Retrieves a conversation entity by ID or throws ResourceNotFoundException.
     * Used internally by other chat-module services.
     *
     * @param conversationId the conversation primary key
     * @return the conversation entity
     */
    @Transactional(readOnly = true)
    public Conversation getConversationEntity(Long conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Conversation not found with id: " + conversationId));
    }

    /**
     * Converts a Conversation entity to its DTO representation.
     */
    ConversationDto toDto(Conversation entity) {
        return ConversationDto.builder()
                .conversationId(entity.getConversationId())
                .participant1Id(entity.getParticipant1Id())
                .participant2Id(entity.getParticipant2Id())
                .participant1Type(entity.getParticipant1Type().name())
                .participant2Type(entity.getParticipant2Type().name())
                .participant1Unread(entity.getParticipant1Unread())
                .participant2Unread(entity.getParticipant2Unread())
                .lastMessage(entity.getLastMessage())
                .lastMessageType(null)
                .lastMessageTimestamp(entity.getLastMessageTimestamp() == null
                        ? null : entity.getLastMessageTimestamp().toString())
                .build();
    }

    /**
     * Resolves a participant type string. If the provided type is null or blank,
     * looks it up from the shared user table via a native query.
     */
    private String resolveParticipantType(Long userId, String providedType) {
        if (providedType != null && !providedType.isBlank()) {
            return providedType;
        }
        return conversationRepository.findUserTypeByUserId(userId)
                .orElse("passenger");
    }

    /**
     * Wraps a Spring Data Page into the module's PagedResponseDto.
     */
    private <T> PagedResponseDto<T> toPagedResponse(Page<T> page) {
        return PagedResponseDto.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}

