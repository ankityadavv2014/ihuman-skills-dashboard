// Authentication API Routes
// Handles login, refresh, logout, and user registration

import { User } from '../db/models.js';
import { 
    generateToken, 
    generateRefreshToken, 
    loginUser, 
    refreshAccessToken,
    getPermissionsForRole 
} from './jwt.js';

/**
 * Handle login request
 */
export async function handleLogin(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { email, password } = JSON.parse(body);

            if (!email || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Email and password are required' }));
                return;
            }

            const result = await loginUser(email, password);

            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Set-Cookie': `refreshToken=${result.refreshToken}; HttpOnly; SameSite=Strict; Max-Age=604800`
            });
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('Login error:', error);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Login failed' }));
        }
    });
}

/**
 * Handle registration request
 */
export async function handleRegister(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { email, username, password, fullName } = JSON.parse(body);

            if (!email || !username || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Email, username, and password are required' }));
                return;
            }

            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User with this email already exists' }));
                return;
            }

            // Create new user
            const newUser = await User.create(email, username, password, fullName, 'viewer');
            const permissions = getPermissionsForRole('viewer');

            const accessToken = generateToken(newUser.id, 'viewer', permissions);
            const refreshToken = generateRefreshToken(newUser.id);

            res.writeHead(201, { 
                'Content-Type': 'application/json',
                'Set-Cookie': `refreshToken=${refreshToken}; HttpOnly; SameSite=Strict; Max-Age=604800`
            });
            res.end(JSON.stringify({
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    username: newUser.username,
                    role: 'viewer',
                    permissions,
                },
                accessToken,
                refreshToken,
                expiresIn: 3600,
            }));
        } catch (error) {
            console.error('Registration error:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Registration failed' }));
        }
    });
}

/**
 * Handle refresh token request
 */
export async function handleRefresh(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { refreshToken } = JSON.parse(body);

            if (!refreshToken) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Refresh token is required' }));
                return;
            }

            const result = await refreshAccessToken(refreshToken);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('Refresh error:', error);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Token refresh failed' }));
        }
    });
}

/**
 * Handle logout request
 */
export async function handleLogout(req, res) {
    // Clear refresh token cookie
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Set-Cookie': 'refreshToken=; HttpOnly; SameSite=Strict; Max-Age=0'
    });
    res.end(JSON.stringify({ message: 'Logout successful' }));
}

/**
 * Handle get current user request
 */
export async function handleGetMe(req, res, userId) {
    try {
        const user = await User.findById(userId);

        if (!user) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'User not found' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            id: user.id,
            email: user.email,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            permissions: user.permissions,
            avatar_url: user.avatar_url,
            is_active: user.is_active,
            created_at: user.created_at,
        }));
    } catch (error) {
        console.error('Get me error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to get user info' }));
    }
}

/**
 * Handle verify token request
 */
export async function handleVerifyToken(req, res) {
    // This is typically handled by middleware
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ valid: true }));
}

/**
 * Handle password change request
 */
export async function handleChangePassword(req, res, userId) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { currentPassword, newPassword } = JSON.parse(body);

            if (!currentPassword || !newPassword) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Current and new password are required' }));
                return;
            }

            const user = await User.findById(userId);
            if (!user) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User not found' }));
                return;
            }

            // Verify current password
            if (!User.verifyPassword(currentPassword, user.password_hash)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Current password is incorrect' }));
                return;
            }

            // Update password
            const crypto = await import('crypto');
            const newPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
            await User.updateProfile(userId, { password_hash: newPasswordHash });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Password changed successfully' }));
        } catch (error) {
            console.error('Change password error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to change password' }));
        }
    });
}

export default {
    handleLogin,
    handleRegister,
    handleRefresh,
    handleLogout,
    handleGetMe,
    handleVerifyToken,
    handleChangePassword,
};
