package com.trackngo.chat.internal.entity.enums;

import lombok.Getter;

/**
 * Type of a chat message.
 * Maps to the MySQL ENUM('text','image','voice','location','system').
 */
@Getter
public enum MessageType {

    TEXT("text"),
    IMAGE("image"),
    VOICE("voice"),
    LOCATION("location"),
    SYSTEM("system");

    private final String dbValue;

    MessageType(String dbValue) {
        this.dbValue = dbValue;
    }

    /**
     * Resolves a MessageType from a string value (case-insensitive).
     * Defaults to TEXT if the input is null or blank.
     *
     * @param value the string to parse (DB value or enum name)
     * @return the resolved MessageType
     * @throws IllegalArgumentException if the value is not recognized
     */
    public static MessageType fromValue(String value) {
        if (value == null || value.isBlank()) {
            return TEXT;
        }
        for (MessageType type : values()) {
            if (type.dbValue.equalsIgnoreCase(value) || type.name().equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown MessageType: " + value);
    }
}
