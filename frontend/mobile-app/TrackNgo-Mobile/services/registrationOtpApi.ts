import { extractApiMessage, httpPost } from "./http";

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

// The shared helper in http.ts does the same extraction, and falls back to the
// supplied sentence instead of the raw "POST /path failed: 400 - {...}" string
// that leaked through here whenever the body could not be parsed.
const extractMessage = extractApiMessage;

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
