package com.trackngo.aiagent.controller;

import com.trackngo.aiagent.orchestration.AgentRouter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
public class ChatController {

    private final AgentRouter agentRouter;

    public ChatController(AgentRouter agentRouter) {
        this.agentRouter = agentRouter;
    }

    public record ChatRequest(String message, String chatId) {}
    public record ChatResponse(String reply) {}

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        String chatId = request.chatId() != null ? request.chatId() : "default-chat-session";
        String reply = agentRouter.processUserQuery(request.message(), chatId);
        return ResponseEntity.ok(new ChatResponse(reply));
    }
}
