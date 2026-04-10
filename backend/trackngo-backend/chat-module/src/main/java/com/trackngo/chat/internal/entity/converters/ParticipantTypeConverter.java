package com.trackngo.chat.internal.entity.converters;

import com.trackngo.chat.internal.entity.enums.ParticipantType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Converts {@link ParticipantType} to/from the lowercase DB enum values.
 */
@Converter(autoApply = false)
public class ParticipantTypeConverter implements AttributeConverter<ParticipantType, String> {

    @Override
    public String convertToDatabaseColumn(ParticipantType attribute) {
        return attribute == null ? null : attribute.getDbValue();
    }

    @Override
    public ParticipantType convertToEntityAttribute(String dbData) {
        return ParticipantType.fromValue(dbData);
    }
}
