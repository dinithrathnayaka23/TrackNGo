
package com.trackngo.chat.internal.repository;

import com.trackngo.chat.internal.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, Long> {
}

