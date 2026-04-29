package com.trackngo.chat.internal.service;

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
import com.trackngo.commons.events.BaseEvent;
import com.trackngo.commons.events.EventPublisher;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageServiceImplTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private ConversationServiceImpl conversationService;

    @Mock
    private EventPublisher eventPublisher;

    @InjectMocks
    private MessageServiceImpl service;

    /** Verifies that sending a message updates unread counts, conversation preview, and publishes the create event. */
    @Test
    void sendMessageShouldPersistMessageUpdateConversationAndPublishEvent() {
        Conversation conversation = buildConversation(7L);
        MessageDto request = MessageDto.builder()
                .conversationId(7L)
                .senderId(10L)
                .content("  Hello there  ")
                .messageType("TEXT")
                .clientMessageId("client-1")
                .build();

        when(conversationService.getConversationEntity(7L)).thenReturn(conversation);
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage message = invocation.getArgument(0);
            message.setMessageId(101L);
            message.setCreatedAt(LocalDateTime.of(2026, 4, 26, 16, 0));
            return message;
        });
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MessageDto result = service.sendMessage(request);

        ArgumentCaptor<ChatMessage> messageCaptor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(messageRepository).save(messageCaptor.capture());
        ChatMessage savedMessage = messageCaptor.getValue();
        assertEquals("Hello there", savedMessage.getContent());
        assertEquals(20L, savedMessage.getRecipientId());
        assertEquals(MessageType.TEXT, savedMessage.getMessageType());
        assertFalse(savedMessage.isRead());

        assertEquals(1, conversation.getParticipant2Unread());
        assertEquals("Hello there", conversation.getLastMessage());
        assertEquals(MessageType.TEXT, conversation.getLastMessageType());
        assertNotNull(conversation.getLastMessageTimestamp());

        ArgumentCaptor<BaseEvent> eventCaptor = ArgumentCaptor.forClass(BaseEvent.class);
        verify(eventPublisher).publish(eventCaptor.capture());
        MessageCreatedEvent event = (MessageCreatedEvent) eventCaptor.getValue();
        assertEquals(101L, event.getMessageId());
        assertEquals(7L, event.getConversationId());

        assertEquals(101L, result.getMessageId());
        assertEquals("SENT", result.getStatus());
        assertEquals("PASSENGER", result.getSenderType());
    }

    /** Verifies that sending a message without an existing conversation creates one first. */
    @Test
    void sendMessageShouldCreateConversationWhenConversationDoesNotExist() {
        MessageDto request = MessageDto.builder()
                .senderId(10L)
                .senderType("PASSENGER")
                .recipientId(20L)
                .content("Need help")
                .messageType("TEXT")
                .build();

        when(conversationRepository.findBetweenUsers(10L, 20L)).thenReturn(Optional.empty());
        when(conversationRepository.findUserTypeByUserId(20L)).thenReturn(Optional.of("driver"));
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(invocation -> {
            Conversation conversation = invocation.getArgument(0);
            if (conversation.getConversationId() == null) {
                conversation.setConversationId(88L);
            }
            return conversation;
        });
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage message = invocation.getArgument(0);
            message.setMessageId(501L);
            message.setCreatedAt(LocalDateTime.of(2026, 4, 26, 16, 30));
            return message;
        });

        MessageDto result = service.sendMessage(request);

        assertEquals(88L, result.getConversationId());
        verify(conversationRepository).findBetweenUsers(10L, 20L);
        verify(conversationRepository).findUserTypeByUserId(20L);
        verify(conversationRepository, atLeastOnce()).save(any(Conversation.class));
    }

    /** Verifies that location messages are rejected when latitude and longitude are missing. */
    @Test
    void sendMessageShouldRejectLocationMessagesWithoutCoordinates() {
        MessageDto request = MessageDto.builder()
                .conversationId(7L)
                .senderId(10L)
                .messageType("LOCATION")
                .content("I'm here")
                .build();

        assertThrows(BusinessException.class, () -> service.sendMessage(request));
    }

    /** Verifies that conversation message retrieval maps paged messages into the API DTO structure. */
    @Test
    void getConversationMessagesShouldMapPagedDtos() {
        Conversation conversation = buildConversation(7L);
        ChatMessage message = buildMessage(301L, conversation, 10L, MessageType.IMAGE, "");
        message.setRead(true);
        message.setCreatedAt(LocalDateTime.of(2026, 4, 26, 12, 0));

        when(conversationService.getConversationEntity(7L)).thenReturn(conversation);
        when(messageRepository.findByConversation_ConversationIdOrderByCreatedAtDesc(eq(7L), any()))
                .thenReturn(new PageImpl<>(List.of(message), PageRequest.of(0, 30), 1));

        PagedResponseDto<MessageDto> result = service.getConversationMessages(7L, 0, 30, null);

        assertEquals(1, result.getContent().size());
        assertEquals("READ", result.getContent().get(0).getStatus());
        assertEquals(true, result.getContent().get(0).getReadByParticipant1());
        assertEquals(true, result.getContent().get(0).getReadByParticipant2());
    }

    /** Verifies that marking a conversation as read updates unread incoming messages and resets the user's counter. */
    @Test
    void markConversationReadShouldUpdateMessagesAndResetUnreadCount() {
        Conversation conversation = buildConversation(7L);
        conversation.setParticipant2Unread(3);
        ChatMessage first = buildMessage(1L, conversation, 10L, MessageType.TEXT, "A");
        ChatMessage second = buildMessage(2L, conversation, 10L, MessageType.TEXT, "B");

        when(conversationService.getConversationEntity(7L)).thenReturn(conversation);
        when(messageRepository.findUnreadByConversationAndRecipient(7L, 20L)).thenReturn(List.of(first, second));

        List<MessageStatusUpdateDto> result = service.markConversationRead(7L, 20L);

        verify(messageRepository).saveAll(List.of(first, second));
        verify(conversationRepository).save(conversation);
        assertEquals(0, conversation.getParticipant2Unread());
        assertEquals(true, first.isRead());
        assertEquals(2, result.size());
        assertEquals("READ", result.get(0).getStatus());
    }

    /** Verifies that deleting a message soft-deletes it and refreshes the conversation preview from the previous message. */
    @Test
    void deleteMessageShouldSoftDeleteAndRefreshConversationPreview() {
        Conversation conversation = buildConversation(7L);
        ChatMessage target = buildMessage(55L, conversation, 10L, MessageType.TEXT, "Remove me");
        target.setMediaUrl("https://cdn.example.com/file.jpg");
        ChatMessage previous = buildMessage(54L, conversation, 20L, MessageType.IMAGE, "");
        previous.setCreatedAt(LocalDateTime.of(2026, 4, 26, 10, 0));

        when(messageRepository.findById(55L)).thenReturn(Optional.of(target));
        when(messageRepository.findTopByConversation_ConversationIdAndDeletedFalseOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(previous));
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MessageDeleteEventDto result = service.deleteMessage(55L, 10L);

        assertEquals(true, target.isDeleted());
        assertEquals("[Message deleted]", target.getContent());
        assertEquals(null, target.getMediaUrl());
        assertEquals("[Image]", conversation.getLastMessage());
        assertEquals(MessageType.IMAGE, conversation.getLastMessageType());
        verify(conversationRepository).save(conversation);
        assertEquals(7L, result.getConversationId());
        assertEquals(55L, result.getMessageId());
    }

    /** Verifies that only the original sender can delete a chat message. */
    @Test
    void deleteMessageShouldRejectDifferentUser() {
        Conversation conversation = buildConversation(7L);
        ChatMessage target = buildMessage(55L, conversation, 10L, MessageType.TEXT, "Keep me");
        when(messageRepository.findById(55L)).thenReturn(Optional.of(target));

        assertThrows(BusinessException.class, () -> service.deleteMessage(55L, 20L));
        verify(messageRepository, never()).save(any(ChatMessage.class));
    }

    /** Builds a representative conversation entity used by the message service tests. */
    private Conversation buildConversation(Long conversationId) {
        Conversation conversation = new Conversation();
        conversation.setConversationId(conversationId);
        conversation.setParticipant1Id(10L);
        conversation.setParticipant1Type(ParticipantType.PASSENGER);
        conversation.setParticipant2Id(20L);
        conversation.setParticipant2Type(ParticipantType.DRIVER);
        conversation.setParticipant1Unread(0);
        conversation.setParticipant2Unread(0);
        return conversation;
    }

    /** Builds a representative chat message entity used in read and delete scenarios. */
    private ChatMessage buildMessage(Long messageId, Conversation conversation, Long senderId,
                                     MessageType messageType, String content) {
        ChatMessage message = new ChatMessage();
        message.setMessageId(messageId);
        message.setConversation(conversation);
        message.setSenderId(senderId);
        message.setSenderType(senderId.equals(conversation.getParticipant1Id())
                ? conversation.getParticipant1Type() : conversation.getParticipant2Type());
        message.setRecipientId(senderId.equals(conversation.getParticipant1Id())
                ? conversation.getParticipant2Id() : conversation.getParticipant1Id());
        message.setMessageType(messageType);
        message.setContent(content);
        message.setRead(false);
        message.setDeleted(false);
        return message;
    }
}
