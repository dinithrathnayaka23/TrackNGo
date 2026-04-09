package com.trackngo.chat.internal.entity.enums;

import lombok.Getter;

/**
 * Type of a participant in a chat conversation.
 * Maps to the MySQL ENUM('passenger','driver','admin','corporate').
 */
@Getter
public enum ParticipantType {

    PASSENGER("passenger"),
    DRIVER("driver"),
    ADMIN("admin"),
    CORPORATE("corporate");

    private final String dbValue;

    ParticipantType(String dbValue) {
        this.dbValue = dbValue;
    }

    /**
     * Resolves a ParticipantType from a string value (case-insensitive).
     * Accepts both lowercase DB values (e.g. "passenger") and uppercase names (e.g. "PASSENGER").
     *
     * @param value the string to parse
     * @return the resolved ParticipantType, or null if the input is null
     * @throws IllegalArgumentException if the value is not recognized
     */
    public static ParticipantType fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (ParticipantType type : values()) {
            if (type.dbValue.equalsIgnoreCase(value) || type.name().equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown ParticipantType: " + value);
    }
}
