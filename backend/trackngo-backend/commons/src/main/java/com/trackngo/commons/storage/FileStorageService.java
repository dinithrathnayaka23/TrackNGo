package com.trackngo.commons.storage;

/**
 * Abstraction over where uploaded files (profile pictures, chat media) are
 * actually kept, so the services and controllers that use it never call the
 * filesystem directly. Swap {@link LocalFileStorageService} for an
 * S3/Cloudinary/R2-backed implementation later without touching any caller.
 */
public interface FileStorageService {

    /**
     * Stores {@code content} at {@code relativePath} (e.g.
     * {@code "profile-pictures/original/42-abc.jpg"}) and returns the public
     * URL a client should use to read it back (e.g.
     * {@code "/uploads/profile-pictures/original/42-abc.jpg"}).
     */
    String store(byte[] content, String relativePath);

    /** Deletes whatever is stored at {@code relativePath}, if anything. Never throws. */
    void delete(String relativePath);
}
