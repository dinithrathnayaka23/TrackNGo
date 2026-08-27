import { apiUrl } from '@/config/env';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface EmailTwoFactorStatus {
  enabled: boolean;
}

export interface TwoFactorAuthResult {
  token: string;
  userId: number;
  userType: string;
  email: string;
  firstName: string;
  lastName: string;
  twoFactorRequired: boolean;
  twoFactorToken: string | null;
  trustedDeviceToken: string | null;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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

export async function getEmailTwoFactorStatus(
  userId: number,
  token: string
): Promise<EmailTwoFactorStatus> {
  return request<EmailTwoFactorStatus>(`/api/users/${userId}/two-factor/email`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setEmailTwoFactorEnabled(
  userId: number,
  token: string,
  enabled: boolean
): Promise<EmailTwoFactorStatus> {
  return request<EmailTwoFactorStatus>(
    `/api/users/${userId}/two-factor/email/${enabled ? 'enable' : 'disable'}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export async function verifyLoginOtp(
  challengeToken: string,
  code: string
): Promise<TwoFactorAuthResult> {
  return request<TwoFactorAuthResult>('/api/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeToken, code }),
  });
}

export async function resendLoginOtp(challengeToken: string): Promise<void> {
  await request<null>('/api/auth/2fa/resend', {
    method: 'POST',
    body: JSON.stringify({ challengeToken }),
  });
}
