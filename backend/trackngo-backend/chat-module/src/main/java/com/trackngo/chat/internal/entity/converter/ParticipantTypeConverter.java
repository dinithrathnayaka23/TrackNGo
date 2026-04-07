package com.trackngo.chat.internal.entity.converter;

import com.trackngo.chat.internal.entity.enums.ParticipantType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA attribute converter that maps {@link ParticipantType} enum constants
 * to their lowercase database string values and vice versa.
 */
@Converter(autoApply = true)
public class ParticipantTypeConverter implements AttributeConverter<ParticipantType, String> {

    /**
     * Converts the Java enum to its lowercase DB representation.
     */
    @Override
    public String convertToDatabaseColumn(ParticipantType attribute) {
        return attribute == null ? null : attribute.getDbValue();
    }

    /**
     * Converts the lowercase DB string back to the Java enum constant.
     */
    @Override
    public ParticipantType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ParticipantType.fromValue(dbData);
    }
}
