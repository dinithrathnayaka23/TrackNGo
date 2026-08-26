import { httpPost } from "./http";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ForgotPasswordResult {
  maskedDestination: string;
  channel: "EMAIL" | "PHONE";
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

export interface VerifyResetOtpResult {
  resetToken: string;
  expiresInSeconds: number;
}

function extractMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const braceIndex = error.message.indexOf("{");
    if (braceIndex >= 0) {
      try {
        const parsed = JSON.parse(error.message.slice(braceIndex)) as { message?: string };
        if (parsed.message) return parsed.message;
      } catch {
        // fall through to the raw message below
      }
    }
    return error.message;
  }
  return fallback;
}

export async function requestPasswordResetOtp(email: string): Promise<ForgotPasswordResult> {
  try {
    const response = await httpPost<ApiResponse<ForgotPasswordResult>>(
      "/api/auth/forgot-password",
      undefined,
      { identifier: email, channel: "EMAIL" },
    );
    return response.data;
  } catch (error) {
    throw new Error(extractMessage(error, "Could not send the reset code. Please try again."));
  }
}

export async function resendPasswordResetOtp(email: string): Promise<ForgotPasswordResult> {
  try {
    const response = await httpPost<ApiResponse<ForgotPasswordResult>>(
      "/api/auth/resend-otp",
      undefined,
      { identifier: email },
    );
    return response.data;
  } catch (error) {
    throw new Error(extractMessage(error, "Could not resend the reset code. Please try again."));
  }
}

export async function verifyPasswordResetOtp(email: string, otp: string): Promise<VerifyResetOtpResult> {
  try {
    const response = await httpPost<ApiResponse<VerifyResetOtpResult>>(
      "/api/auth/verify-otp",
      undefined,
      { identifier: email, otp },
    );
    return response.data;
  } catch (error) {
    throw new Error(extractMessage(error, "That code is invalid. Please try again."));
  }
}

export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  try {
    await httpPost<ApiResponse<null>>(
      "/api/auth/reset-password",
      undefined,
      { resetToken, newPassword },
    );
  } catch (error) {
    throw new Error(extractMessage(error, "Could not reset your password. Please try again."));
  }
}
