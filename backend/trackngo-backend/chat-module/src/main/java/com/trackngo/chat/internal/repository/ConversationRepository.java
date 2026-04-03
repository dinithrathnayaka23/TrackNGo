
package com.trackngo.chat.internal.repository;

import com.trackngo.chat.internal.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
}

