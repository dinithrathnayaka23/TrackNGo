
package com.trackngo.chat.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConversationDto {
    private Long id;
    @NotBlank
    private String name;
}

