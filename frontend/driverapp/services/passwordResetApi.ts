import { apiUrl } from '@/config/env';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ForgotPasswordResult {
  maskedDestination: string;
  channel: 'EMAIL' | 'PHONE';
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

export interface VerifyResetOtpResult {
  resetToken: string;
  expiresInSeconds: number;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: ApiResponse<T>;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(text);
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || text);
  }

  return data.data;
}

export async function requestDriverPasswordResetOtp(email: string): Promise<ForgotPasswordResult> {
  return post<ForgotPasswordResult>('/api/auth/forgot-password', {
    identifier: email.trim(),
    channel: 'EMAIL',
    expectedUserType: 'driver',
  });
}

export async function resendDriverPasswordResetOtp(email: string): Promise<ForgotPasswordResult> {
  return post<ForgotPasswordResult>('/api/auth/resend-otp', {
    identifier: email.trim(),
  });
}

export async function verifyDriverPasswordResetOtp(email: string, otp: string): Promise<VerifyResetOtpResult> {
  return post<VerifyResetOtpResult>('/api/auth/verify-otp', {
    identifier: email.trim(),
    otp,
  });
}

export async function resetDriverPassword(resetToken: string, newPassword: string): Promise<void> {
  await post<null>('/api/auth/reset-password', {
    resetToken,
    newPassword,
  });
}
