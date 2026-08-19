package com.trackngo.app.service;

import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import net.coobird.thumbnailator.Thumbnails;
import org.imgscalr.Scalr;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfilePictureService {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    @Value("${trackngo.chat.media.upload-dir:uploads}")
    private String uploadDir;

    public UploadResult uploadProfilePicture(MultipartFile file) {
        validateInput(file);

        User currentUser = getCurrentUser();
        String normalizedType = currentUser.getUserType() == null
                ? ""
                : currentUser.getUserType().trim().toLowerCase(Locale.ROOT);
        if ("driver".equals(normalizedType)) {
            throw new BusinessException("Driver profile pictures are managed by an administrator.");
        }

        try {
            Path baseDir = Path.of(uploadDir).toAbsolutePath().normalize().resolve("profile-pictures");
            Path originalDir = baseDir.resolve("original");
            Path thumbnailDir = baseDir.resolve("thumbnail");
            Files.createDirectories(originalDir);
            Files.createDirectories(thumbnailDir);

            String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
            String extension = switch (contentType) {
                case "image/jpeg" -> ".jpg";
                case "image/png" -> ".png";
                case "image/webp" -> ".webp";
                default -> throw new BusinessException("Unsupported file type. Allowed: JPEG, PNG, WebP.");
            };

            String baseName = currentUser.getId() + "-" + UUID.randomUUID();
            String originalFileName = baseName + extension;
            boolean canWriteWebp = canWriteFormat("image/webp");
            String thumbnailFormat = canWriteWebp ? "webp" : "jpg";
            String thumbnailFileName = baseName + (canWriteWebp ? ".webp" : ".jpg");

            Path originalPath = originalDir.resolve(originalFileName);
            Path thumbnailPath = thumbnailDir.resolve(thumbnailFileName);

            try (InputStream originalStream = file.getInputStream()) {
                Files.copy(originalStream, originalPath, StandardCopyOption.REPLACE_EXISTING);
            }

            BufferedImage inputImage;
            try (InputStream previewStream = file.getInputStream()) {
                inputImage = ImageIO.read(previewStream);
            }
            if (inputImage == null) {
                throw new BusinessException("Uploaded file is not a valid image.");
            }

            writeThumbnail(inputImage, thumbnailPath, thumbnailFormat);

            String originalUrl = "/uploads/profile-pictures/original/" + originalFileName;
            String thumbnailUrl = "/uploads/profile-pictures/thumbnail/" + thumbnailFileName;

            persistProfilePhoto(currentUser.getId(), normalizedType, originalUrl);

            long bytes = Files.size(thumbnailPath);
            return new UploadResult(originalUrl, thumbnailUrl, originalUrl, bytes);
        } catch (IOException ex) {
            throw new BusinessException("Failed to save profile picture: " + ex.getMessage());
        }
    }

    private void validateInput(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Please select an image file.");
        }

        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BusinessException("Unsupported file type. Allowed: JPEG, PNG, WebP.");
        }
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            throw new BusinessException("Unauthorized request.");
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found."));
    }

    private void writeThumbnail(BufferedImage inputImage, Path thumbnailPath, String outputFormat) throws IOException {
        try {
            Thumbnails.of(inputImage)
                    .size(400, 400)
                    .keepAspectRatio(true)
                    .outputQuality(0.95)
                    .outputFormat(outputFormat)
                    .toFile(thumbnailPath.toFile());
            return;
        } catch (Exception ignored) {
            // Falls back to imgscalr + ImageIO when Thumbnailator cannot write this format.
        }

        BufferedImage scaled = Scalr.resize(
                inputImage,
                Scalr.Method.QUALITY,
                Scalr.Mode.AUTOMATIC,
                400,
                400,
                Scalr.OP_ANTIALIAS
        );

        boolean written = ImageIO.write(scaled, outputFormat, thumbnailPath.toFile());
        if (!written) {
            throw new IOException("No ImageIO writer available for format: " + outputFormat);
        }
    }

    private boolean canWriteFormat(String mimeType) {
        return ImageIO.getImageWritersByMIMEType(mimeType).hasNext();
    }

    private void persistProfilePhoto(Long userId, String userType, String profilePhotoUrl) {
        switch (userType) {
            case "passenger" -> jdbcTemplate.update(
                    "UPDATE passenger SET profile_photo = ? WHERE passenger_id = ?",
                    profilePhotoUrl,
                    userId
            );
            case "driver" -> jdbcTemplate.update(
                    "UPDATE driver SET profile_photo = ? WHERE driver_id = ?",
                    profilePhotoUrl,
                    userId
            );
            case "corporate" -> jdbcTemplate.update(
                    "UPDATE corporate_user SET profile_photo = ? WHERE corporate_user_id = ?",
                    profilePhotoUrl,
                    userId
            );
            case "admin" -> jdbcTemplate.update(
                    "UPDATE admin SET profile_photo = ? WHERE admin_id = ?",
                    profilePhotoUrl,
                    userId
            );
            default -> {
            }
        }
    }

    public record UploadResult(String imageUrl, String thumbnailUrl, String originalUrl, long sizeBytes) {
    }
}
