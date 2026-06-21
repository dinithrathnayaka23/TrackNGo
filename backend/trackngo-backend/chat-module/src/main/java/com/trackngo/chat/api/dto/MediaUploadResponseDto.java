package com.trackngo.chat.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response returned after a successful media file upload.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaUploadResponseDto {

    private String fileName;
    private String mediaUrl;
    private String mimeType;
    private long sizeBytes;
}
