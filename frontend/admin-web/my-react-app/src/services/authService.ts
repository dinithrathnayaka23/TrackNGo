export interface LoginRequest {
    email: string
    password: string
}

export interface LoginResponse {
    token: string
    userId: number
    userType: string
    email: string
    firstName: string | null
    lastName: string | null
}

type ApiResponse<T> = {
    success: boolean
    message: string
    data: T
}

export type AdminSessionProfile = {
    userId: number
    userType: string
    email: string
    firstName: string | null
    lastName: string | null
}

const ADMIN_PROFILE_KEY = 'adminProfile'

export type OtpChannel = 'EMAIL' | 'PHONE'

export type ForgotPasswordResponse = {
    maskedDestination: string
    channel: OtpChannel
    expiresInSeconds: number
    resendCooldownSeconds: number
}

export type VerifyOtpResponse = {
    resetToken: string
    expiresInSeconds: number
}

export type AdminRegisterRequest = {
    fullName: string
    employeeId: string
    email: string
    phone: string
    password: string
}

// Normalizes any thrown value into a short, user-facing message. Network-level
// failures (server unreachable, DNS, CORS) surface as opaque browser errors like
// "Failed to fetch" - replace those with plain language instead of leaking them.
function toFriendlyErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof TypeError) {
        return 'Unable to reach the server. Check your connection and try again.'
    }
    if (error instanceof Error && error.message) {
        return error.message
    }
    return fallback
}

async function parseApiResponse<T>(res: Response, fallbackErrorMessage: string): Promise<T> {
    const responseText = await res.text()
    let body: ApiResponse<T> | null = null
    if (responseText.trim()) {
        try {
            body = JSON.parse(responseText) as ApiResponse<T>
        } catch {
            throw new Error(`The server returned an invalid response (${res.status}).`)
        }
    }

    if (!body) {
        throw new Error(`The server returned an empty response (${res.status}).`)
    }

    if (!res.ok || !body.success) {
        throw new Error(body.message || fallbackErrorMessage)
    }

    return body.data
}

const authService = {
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    identifier: credentials.email.trim(),
                    password: credentials.password,
                    expectedUserType: 'admin',
                }),
            })

            const responseText = await res.text()
            let body: ApiResponse<LoginResponse> | null = null
            if (responseText.trim()) {
                try {
                    body = JSON.parse(responseText) as ApiResponse<LoginResponse>
                } catch {
                    throw new Error(`The server returned an invalid response (${res.status}).`)
                }
            }

            if (!body) {
                throw new Error(`The server returned an empty response (${res.status}).`)
            }

            if (!res.ok || !body.success) {
                throw new Error(body.message || 'Login failed')
            }

            if (body.data?.userType?.toLowerCase() !== 'admin') {
                throw new Error('This portal is only for admin accounts.')
            }

            if (body.data && body.data.token) {
                localStorage.setItem('jwtToken', body.data.token)
                localStorage.setItem('adminEmail', body.data.email)
                localStorage.setItem(
                    ADMIN_PROFILE_KEY,
                    JSON.stringify({
                        userId: body.data.userId,
                        userType: body.data.userType,
                        email: body.data.email,
                        firstName: body.data.firstName,
                        lastName: body.data.lastName,
                    } satisfies AdminSessionProfile),
                )
            }

            return body.data
        } catch (error: unknown) {
            throw new Error(toFriendlyErrorMessage(error, 'Login failed. Please try again.'))
        }
    },

    logout: () => {
        localStorage.removeItem('jwtToken')
        localStorage.removeItem('adminEmail')
        localStorage.removeItem(ADMIN_PROFILE_KEY)
    },

    getToken: () => localStorage.getItem('jwtToken'),

    getAdminProfile: (): AdminSessionProfile | null => {
        const raw = localStorage.getItem(ADMIN_PROFILE_KEY)
        if (!raw) return null
        try {
            return JSON.parse(raw) as AdminSessionProfile
        } catch {
            return null
        }
    },

    isAuthenticated: () => !!localStorage.getItem('jwtToken'),

    forgotPassword: async ({ identifier, channel, expectedUserType }: { identifier: string; channel: OtpChannel; expectedUserType?: string }): Promise<ForgotPasswordResponse> => {
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: identifier.trim(), channel, expectedUserType }),
            })
            return await parseApiResponse<ForgotPasswordResponse>(res, 'Failed to send verification code')
        } catch (error: unknown) {
            throw new Error(toFriendlyErrorMessage(error, 'Failed to send verification code. Please try again.'))
        }
    },

    resendOtp: async ({ identifier }: { identifier: string }): Promise<ForgotPasswordResponse> => {
        try {
            const res = await fetch('/api/auth/resend-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: identifier.trim() }),
            })
            return await parseApiResponse<ForgotPasswordResponse>(res, 'Failed to resend verification code')
        } catch (error: unknown) {
            throw new Error(toFriendlyErrorMessage(error, 'Failed to resend verification code. Please try again.'))
        }
    },

    verifyOtp: async ({ identifier, otp }: { identifier: string; otp: string }): Promise<VerifyOtpResponse> => {
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: identifier.trim(), otp: otp.trim() }),
            })
            return await parseApiResponse<VerifyOtpResponse>(res, 'Failed to verify code')
        } catch (error: unknown) {
            throw new Error(toFriendlyErrorMessage(error, 'Failed to verify code. Please try again.'))
        }
    },

    resetPassword: async ({ resetToken, newPassword }: { resetToken: string; newPassword: string }): Promise<void> => {
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resetToken, newPassword }),
            })
            await parseApiResponse<void>(res, 'Failed to reset password')
        } catch (error: unknown) {
            throw new Error(toFriendlyErrorMessage(error, 'Failed to reset password. Please try again.'))
        }
    },

    registerAdmin: async (payload: AdminRegisterRequest): Promise<void> => {
        try {
            const res = await fetch('/api/auth/register-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: payload.fullName.trim(),
                    employeeId: payload.employeeId.trim(),
                    email: payload.email.trim(),
                    phone: payload.phone.trim(),
                    password: payload.password,
                }),
            })
            await parseApiResponse<void>(res, 'Registration failed')
        } catch (error: unknown) {
            throw new Error(toFriendlyErrorMessage(error, 'Registration failed. Please try again.'))
        }
    },
}

export default authService
