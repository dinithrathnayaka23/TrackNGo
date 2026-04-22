export interface LoginRequest {
    email: string
    password: string
}

export interface LoginResponse {
    token: string
    adminId: string
    email: string
    name: string
}

type ApiResponse<T> = {
    success: boolean
    message: string
    data: T
}

const authService = {
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
        try {
            const res = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            })

            const body = await res.json()

            if (!res.ok || !body.success) {
                throw new Error(body.message || 'Login failed')
            }

            if (body.data && body.data.token) {
                localStorage.setItem('jwtToken', body.data.token)
                localStorage.setItem('adminEmail', body.data.email)
            }

            return body.data
        } catch (error: any) {
            throw error.message || 'Login failed'
        }
    },

    logout: () => {
        localStorage.removeItem('jwtToken')
        localStorage.removeItem('adminEmail')
    },

    getToken: () => localStorage.getItem('jwtToken'),

    isAuthenticated: () => !!localStorage.getItem('jwtToken'),
}

export default authService