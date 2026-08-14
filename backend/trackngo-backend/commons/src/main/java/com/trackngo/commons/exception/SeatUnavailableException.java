package com.trackngo.commons.exception;

/**
 * Raised when a seat was taken by another booking before this request committed.
 */
public class SeatUnavailableException extends RuntimeException {
    public SeatUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
