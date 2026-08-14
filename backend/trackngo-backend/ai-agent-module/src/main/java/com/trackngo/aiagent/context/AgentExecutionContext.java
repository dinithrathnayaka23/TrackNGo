package com.trackngo.aiagent.context;

public final class AgentExecutionContext {
    private static final ThreadLocal<Context> CURRENT = new ThreadLocal<>();

    private AgentExecutionContext() {
    }

    public static void set(Context context) {
        CURRENT.set(context);
    }

    public static Context get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }

    public record Context(Long userId, String email, String role, String chatId) {
        public boolean hasUser() {
            return userId != null;
        }
    }
}
