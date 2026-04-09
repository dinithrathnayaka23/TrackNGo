package com.trackngo.chat.internal.entity.converter;

import com.trackngo.chat.internal.entity.enums.MessageType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA attribute converter that maps {@link MessageType} enum constants
 * to their lowercase database string values and vice versa.
 */
@Converter(autoApply = true)
public class MessageTypeConverter implements AttributeConverter<MessageType, String> {

    /**
     * Converts the Java enum to its lowercase DB representation.
     */
    @Override
    public String convertToDatabaseColumn(MessageType attribute) {
        return attribute == null ? null : attribute.getDbValue();
    }

    /**
     * Converts the lowercase DB string back to the Java enum constant.
     */
    @Override
    public MessageType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : MessageType.fromValue(dbData);
    }
}
