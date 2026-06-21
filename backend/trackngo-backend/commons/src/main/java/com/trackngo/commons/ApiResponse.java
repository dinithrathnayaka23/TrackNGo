package com.trackngo.commons;

import lombok.Data;
import lombok.NoArgsConstructor;

/*
  Standardized API response wrapper used across all modules.
  Ensures that every API call returns a consistent structure: {success, message, data}.
   
  @param <T> The type of the data payload being returned.
 */
@Data
@NoArgsConstructor
public class ApiResponse<T> {
    // Indicates if the operation was successful
    private boolean success;
    
    // Human-readable message explaining the result
    private String message;
    
    // The actual payload (e.g., list of buses, booking details)
    private T data;

    /*
      Complete constructor for creating a response.
    */
    public ApiResponse(boolean success, String message, T data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    /*
      Simplified constructor for responses without a data payload.
    */
    public ApiResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
        this.data = null;
    }

    /*
      Factory method for successful responses with data.
    */
    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    /*
      Factory method for successful responses without data.
    */
    public static <T> ApiResponse<T> ok(String message) {
        return new ApiResponse<>(true, message, null);
    }

    /*
      Factory method for failed responses with a message.
    */
    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, message, null);
    }

    /*
      Factory method for failed responses that might still include partial data or error details.
    */
    public static <T> ApiResponse<T> fail(String message, T data) {
        return new ApiResponse<>(false, message, data);
    }
}

