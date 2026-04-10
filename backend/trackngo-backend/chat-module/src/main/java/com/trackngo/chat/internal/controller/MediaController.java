package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.dto.MediaUploadResponseDto;
import com.trackngo.commons.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/**
 * REST controller for handling chat media file uploads.
 * Files are stored locally and served via the static resource path.
 */
@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final Path uploadDir;

    public MediaController(
            @Value("${trackngo.chat.media.upload-dir:uploads}") String uploadDir) {
        this.uploadDir = Path.of(uploadDir);
    }

    /**
     * Uploads a media file (image, audio, etc.) and returns the access URL.
     * Files are stored with a UUID-based filename to prevent collisions.
     *
     * @param file       the multipart file to upload
     * @param compressed whether this is a compressed variant of the original
     * @return upload metadata including the serving URL
     * @throws IOException if the file cannot be written to disk
     */
    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public MediaUploadResponseDto uploadMedia(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "false") boolean compressed) throws IOException {

        if (file.isEmpty()) {
            throw new BusinessException("File must not be empty");
        }

        Files.createDirectories(uploadDir);

        String originalName = file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "media.bin";
        String extension = "";
        int dotIndex = originalName.lastIndexOf('.');
        if (dotIndex >= 0) {
            extension = originalName.substring(dotIndex);
        }

        String suffix = compressed ? "-compressed" : "";
        String safeName = UUID.randomUUID() + suffix + extension;
        Path target = uploadDir.resolve(safeName);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        return MediaUploadResponseDto.builder()
                .fileName(safeName)
                .mediaUrl("/uploads/" + safeName)
                .mimeType(file.getContentType())
                .sizeBytes(file.getSize())
                .build();
    }
}
