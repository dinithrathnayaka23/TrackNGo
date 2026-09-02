package com.trackngo.app.service;

import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.commons.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import net.coobird.thumbnailator.Thumbnails;
import org.imgscalr.Scalr;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfilePictureService {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final String ORIGINAL_URL_PREFIX = "/uploads/profile-pictures/original/";
    /** A thumbnail keeps the original's base name but picks its own extension at upload time. */
    private static final List<String> THUMBNAIL_EXTENSIONS = List.of(".webp", ".jpg");
    private static final String DRIVER_SELF_SERVICE_MESSAGE =
            "Driver profile pictures are managed by an administrator.";

    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final FileStorageService fileStorageService;

    public UploadResult uploadProfilePicture(MultipartFile file) {
        validateInput(file);

        User currentUser = getCurrentUser();
        String normalizedType = normalizeUserType(currentUser.getUserType());

        try {
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

            String originalUrl = fileStorageService.store(
                    file.getBytes(), "profile-pictures/original/" + originalFileName);

            BufferedImage inputImage;
            try (InputStream previewStream = file.getInputStream()) {
                inputImage = ImageIO.read(previewStream);
            }
            if (inputImage == null) {
                throw new BusinessException("Uploaded file is not a valid image.");
            }

            byte[] thumbnailBytes = renderThumbnail(inputImage, thumbnailFormat);
            String thumbnailUrl = fileStorageService.store(
                    thumbnailBytes, "profile-pictures/thumbnail/" + thumbnailFileName);

            // The picture being replaced is no longer reachable from anywhere once the row
            // points at the new one, so its files go too instead of accumulating on disk.
            String replacedUrl = readProfilePhoto(currentUser.getId(), normalizedType);
            persistProfilePhoto(currentUser.getId(), normalizedType, originalUrl);
            deleteStoredImages(replacedUrl);

            return new UploadResult(originalUrl, thumbnailUrl, originalUrl, thumbnailBytes.length);
        } catch (IOException ex) {
            throw new BusinessException("Failed to save profile picture: " + ex.getMessage());
        }
    }

    /** Clears the signed-in user's own profile picture. Drivers are managed by an administrator. */
    public DeleteResult deleteOwnProfilePicture() {
        User currentUser = getCurrentUser();
        String normalizedType = normalizeUserType(currentUser.getUserType());
        if ("driver".equals(normalizedType)) {
            throw new BusinessException(DRIVER_SELF_SERVICE_MESSAGE);
        }

        return clearProfilePhoto(currentUser.getId(), normalizedType);
    }

    /** Clears a driver's profile picture on behalf of an administrator. */
    public DeleteResult deleteDriverProfilePicture(Long driverId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM driver WHERE driver_id = ?",
                Integer.class,
                driverId
        );
        if (count == null || count == 0) {
            throw new ResourceNotFoundException("Driver not found.");
        }

        return clearProfilePhoto(driverId, "driver");
    }

    /**
     * Removing a picture is deliberately idempotent: someone who taps remove twice, or two
     * administrators acting on the same driver, should both see success rather than an
     * error about something that is already gone.
     */
    private DeleteResult clearProfilePhoto(Long userId, String userType) {
        String existingUrl = readProfilePhoto(userId, userType);
        if (existingUrl == null || existingUrl.isBlank()) {
            return new DeleteResult(false);
        }

        persistProfilePhoto(userId, userType, null);
        deleteStoredImages(existingUrl);
        return new DeleteResult(true);
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

    private String normalizeUserType(String userType) {
        return userType == null ? "" : userType.trim().toLowerCase(Locale.ROOT);
    }

    private byte[] renderThumbnail(BufferedImage inputImage, String outputFormat) throws IOException {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Thumbnails.of(inputImage)
                    .size(400, 400)
                    .keepAspectRatio(true)
                    .outputQuality(0.95)
                    .outputFormat(outputFormat)
                    .toOutputStream(out);
            return out.toByteArray();
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

        ByteArrayOutputStream fallbackOut = new ByteArrayOutputStream();
        boolean written = ImageIO.write(scaled, outputFormat, fallbackOut);
        if (!written) {
            throw new IOException("No ImageIO writer available for format: " + outputFormat);
        }
        return fallbackOut.toByteArray();
    }

    private boolean canWriteFormat(String mimeType) {
        return ImageIO.getImageWritersByMIMEType(mimeType).hasNext();
    }

    private String readProfilePhoto(Long userId, String userType) {
        String sql = switch (userType) {
            case "passenger" -> "SELECT profile_photo FROM passenger WHERE passenger_id = ?";
            case "driver" -> "SELECT profile_photo FROM driver WHERE driver_id = ?";
            case "corporate" -> "SELECT profile_photo FROM corporate_user WHERE corporate_user_id = ?";
            case "admin" -> "SELECT profile_photo FROM admin WHERE admin_id = ?";
            default -> null;
        };
        if (sql == null) {
            return null;
        }

        List<String> stored = jdbcTemplate.queryForList(sql, String.class, userId);
        return stored.isEmpty() ? null : stored.get(0);
    }

    /**
     * Deletes the files behind a stored picture. Values that do not point at our own upload
     * folder - an externally hosted avatar, or a device URI saved by the corporate app -
     * have nothing on disk to remove and are skipped.
     */
    private void deleteStoredImages(String profilePhotoUrl) {
        if (profilePhotoUrl == null || !profilePhotoUrl.startsWith(ORIGINAL_URL_PREFIX)) {
            return;
        }

        String fileName = profilePhotoUrl.substring(ORIGINAL_URL_PREFIX.length());
        if (fileName.isBlank()) {
            return;
        }

        fileStorageService.delete("profile-pictures/original/" + fileName);

        int extensionStart = fileName.lastIndexOf('.');
        String baseName = extensionStart < 0 ? fileName : fileName.substring(0, extensionStart);
        for (String extension : THUMBNAIL_EXTENSIONS) {
            fileStorageService.delete("profile-pictures/thumbnail/" + baseName + extension);
        }
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

    /** {@code removed} is false when the account had no picture to begin with. */
    public record DeleteResult(boolean removed) {
    }
}
