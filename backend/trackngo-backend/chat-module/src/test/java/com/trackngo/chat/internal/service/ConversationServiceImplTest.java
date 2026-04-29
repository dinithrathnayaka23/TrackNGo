package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.dto.ConversationDto;
import com.trackngo.chat.api.dto.PagedResponseDto;
import com.trackngo.chat.internal.entity.Conversation;
import com.trackngo.chat.internal.entity.enums.MessageType;
import com.trackngo.chat.internal.entity.enums.ParticipantType;
import com.trackngo.chat.internal.repository.ConversationRepository;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationServiceImplTest {

    @Mock
    private ConversationRepository conversationRepository;

    @InjectMocks
    private ConversationServiceImpl service;

    /** Verifies that an existing conversation is returned without creating a duplicate row. */
    @Test
    void getOrCreateConversationShouldReturnExistingConversation() {
        when(conversationRepository.findBetweenUsers(10L, 20L))
                .thenReturn(Optional.of(buildConversation(7L, ParticipantType.PASSENGER, ParticipantType.CORPORATE)));

        ConversationDto result = service.getOrCreateConversation(10L, null, 20L, null);

        assertEquals(7L, result.getConversationId());
        assertEquals("PASSENGER", result.getParticipant1Type());
        assertEquals("CORPORATE_USER", result.getParticipant2Type());
    }

    /** Verifies that a missing conversation is created with resolved participant types and zero unread counts. */
    @Test
    void getOrCreateConversationShouldCreateConversationWhenMissing() {
        when(conversationRepository.findBetweenUsers(10L, 20L)).thenReturn(Optional.empty());
        when(conversationRepository.findUserTypeByUserId(10L)).thenReturn(Optional.of("passenger"));
        when(conversationRepository.findUserTypeByUserId(20L)).thenReturn(Optional.of("driver"));
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(invocation -> {
            Conversation conversation = invocation.getArgument(0);
            conversation.setConversationId(55L);
            return conversation;
        });

        ConversationDto result = service.getOrCreateConversation(10L, null, 20L, null);

        ArgumentCaptor<Conversation> captor = ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());
        Conversation saved = captor.getValue();
        assertEquals(ParticipantType.PASSENGER, saved.getParticipant1Type());
        assertEquals(ParticipantType.DRIVER, saved.getParticipant2Type());
        assertEquals(0, saved.getParticipant1Unread());
        assertEquals(0, saved.getParticipant2Unread());
        assertEquals(55L, result.getConversationId());
    }

    /** Verifies that the service rejects attempts to create a conversation with the same user twice. */
    @Test
    void getOrCreateConversationShouldRejectSameUser() {
        assertThrows(BusinessException.class,
                () -> service.getOrCreateConversation(10L, "PASSENGER", 10L, "PASSENGER"));
    }

    /** Verifies that user conversation search delegates to the search query and maps the paged response. */
    @Test
    void getUserConversationsShouldUseSearchAndMapPagedResponse() {
        Conversation conversation = buildConversation(9L, ParticipantType.PASSENGER, ParticipantType.DRIVER);
        conversation.setLastMessage("Need support");
        conversation.setLastMessageType(MessageType.TEXT);
        when(conversationRepository.findUserConversationsWithSearch(eq(10L), eq("support"), any()))
                .thenReturn(new PageImpl<>(List.of(conversation), PageRequest.of(0, 20), 1));

        PagedResponseDto<ConversationDto> result = service.getUserConversations(10L, 0, 20, "support");

        assertEquals(1, result.getContent().size());
        assertEquals("Need support", result.getContent().get(0).getLastMessage());
        assertEquals("TEXT", result.getContent().get(0).getLastMessageType());
    }

    /** Verifies that invalid user ids are rejected before the repository is queried. */
    @Test
    void getUserConversationsShouldRejectInvalidUserId() {
        assertThrows(BusinessException.class, () -> service.getUserConversations(0L, 0, 20, null));
    }

    /** Verifies that support conversation queries use the support-specific repository method. */
    @Test
    void getSupportConversationsShouldUseSupportRepositoryQuery() {
        when(conversationRepository.findSupportConversations(eq(1L), eq(ParticipantType.ADMIN), any()))
                .thenReturn(new PageImpl<>(List.of(buildConversation(5L, ParticipantType.ADMIN, ParticipantType.PASSENGER))));

        PagedResponseDto<ConversationDto> result = service.getSupportConversations(1L, 0, 30, null);

        assertEquals(1, result.getContent().size());
        assertEquals("ADMIN", result.getContent().get(0).getParticipant1Type());
    }

    /** Verifies that missing conversation ids surface a not-found error through the internal entity lookup. */
    @Test
    void getConversationEntityShouldThrowWhenConversationDoesNotExist() {
        when(conversationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.getConversationEntity(99L));
    }

    /** Builds a representative conversation entity used throughout the conversation service tests. */
    private Conversation buildConversation(Long conversationId,
                                           ParticipantType participant1Type,
                                           ParticipantType participant2Type) {
        Conversation conversation = new Conversation();
        conversation.setConversationId(conversationId);
        conversation.setParticipant1Id(10L);
        conversation.setParticipant1Type(participant1Type);
        conversation.setParticipant2Id(20L);
        conversation.setParticipant2Type(participant2Type);
        conversation.setParticipant1Unread(1);
        conversation.setParticipant2Unread(2);
        return conversation;
    }
}
