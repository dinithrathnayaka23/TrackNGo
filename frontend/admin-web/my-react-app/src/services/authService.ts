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

            const body: ApiResponse<LoginResponse> = await res.json()

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
        } catch (error: any) {
            throw new Error(error?.message || 'Login failed')
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
}

export default authService
