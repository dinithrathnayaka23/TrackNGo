package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.dto.MediaUploadResponseDto;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/**
 * REST controller for handling chat media file uploads. Storage is delegated
 * to {@link FileStorageService} so this controller doesn't need to change
 * when the storage backend does.
 */
@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final FileStorageService fileStorageService;

    /**
     * Uploads a media file (image, audio, etc.) and returns the access URL.
     * Files are stored with a UUID-based filename to prevent collisions.
     *
     * @param file       the multipart file to upload
     * @param compressed whether this is a compressed variant of the original
     * @return upload metadata including the serving URL
     * @throws IOException if the file cannot be read
     */
    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public MediaUploadResponseDto uploadMedia(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "false") boolean compressed) throws IOException {

        if (file.isEmpty()) {
            throw new BusinessException("File must not be empty");
        }

        String originalName = file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "media.bin";
        String extension = "";
        int dotIndex = originalName.lastIndexOf('.');
        if (dotIndex >= 0) {
            extension = originalName.substring(dotIndex);
        }

        String suffix = compressed ? "-compressed" : "";
        String safeName = UUID.randomUUID() + suffix + extension;
        String mediaUrl = fileStorageService.store(file.getBytes(), safeName);

        return MediaUploadResponseDto.builder()
                .fileName(safeName)
                .mediaUrl(mediaUrl)
                .mimeType(file.getContentType())
                .sizeBytes(file.getSize())
                .build();
    }
}
