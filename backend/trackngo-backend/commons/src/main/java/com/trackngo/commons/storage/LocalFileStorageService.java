package com.trackngo.commons.storage;

import com.trackngo.commons.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/**
 * Default {@link FileStorageService}: writes to a local directory and serves
 * it back via the {@code /uploads/**} static resource mapping (see the app
 * module's {@code WebConfig}).
 * <p>
 * On Render (and most PaaS hosts) the filesystem is ephemeral — anything
 * written here is lost on redeploy/restart unless {@code
 * trackngo.chat.media.upload-dir} is pointed at an attached persistent disk.
 * For durable storage across redeploys, replace this bean with an
 * S3/Cloudinary/R2-backed {@link FileStorageService} implementation; nothing
 * else needs to change.
 */
@Service
public class LocalFileStorageService implements FileStorageService {

    private final Path baseDir;

    public LocalFileStorageService(@Value("${trackngo.chat.media.upload-dir:uploads}") String uploadDir) {
        this.baseDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    @Override
    public String store(byte[] content, String relativePath) {
        Path target = resolveSafe(relativePath);
        try {
            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.write(target, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException ex) {
            throw new BusinessException("Failed to store file: " + ex.getMessage());
        }
        return "/uploads/" + relativePath;
    }

    @Override
    public void delete(String relativePath) {
        Path target = resolveSafe(relativePath);
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
            // A file left behind on disk is untidy, not a failure worth rejecting a request over.
        }
    }

    /** A caller-supplied path is data, not a trusted path: never let one resolve outside baseDir. */
    private Path resolveSafe(String relativePath) {
        Path target = baseDir.resolve(relativePath).normalize();
        if (!target.startsWith(baseDir)) {
            throw new BusinessException("Invalid file path.");
        }
        return target;
    }
}
