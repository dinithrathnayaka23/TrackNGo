import { httpPost } from "./http";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface RegistrationOtpResult {
  maskedEmail: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

export interface VerifyRegistrationOtpResult {
  verificationToken: string;
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

export async function sendRegistrationOtp(email: string): Promise<RegistrationOtpResult> {
  try {
    const response = await httpPost<ApiResponse<RegistrationOtpResult>>(
      "/api/auth/registration/send-otp",
      undefined,
      { email },
    );
    return response.data;
  } catch (error) {
    throw new Error(extractMessage(error, "Could not send the verification code. Please try again."));
  }
}

export async function resendRegistrationOtp(email: string): Promise<RegistrationOtpResult> {
  try {
    const response = await httpPost<ApiResponse<RegistrationOtpResult>>(
      "/api/auth/registration/resend-otp",
      undefined,
      { email },
    );
    return response.data;
  } catch (error) {
    throw new Error(extractMessage(error, "Could not resend the verification code. Please try again."));
  }
}

export async function verifyRegistrationOtp(email: string, otp: string): Promise<VerifyRegistrationOtpResult> {
  try {
    const response = await httpPost<ApiResponse<VerifyRegistrationOtpResult>>(
      "/api/auth/registration/verify-otp",
      undefined,
      { email, otp },
    );
    return response.data;
  } catch (error) {
    throw new Error(extractMessage(error, "That code is invalid. Please try again."));
  }
}
