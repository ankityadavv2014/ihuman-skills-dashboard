// JWT Authentication Middleware and Utilities
// Handles token generation, verification, and protected routes

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from './db/models.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '3600'; // 1 hour
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '604800'; // 7 days

/**
 * Generate JWT token
 */
export function generateToken(userId, role, permissions) {
    const payload = {
        sub: userId,
        role,
        permissions,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + parseInt(JWT_EXPIRES_IN),
    };

    return jwt.sign(payload, JWT_SECRET);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId) {
    const payload = {
        sub: userId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + parseInt(JWT_REFRESH_EXPIRES_IN),
    };

    return jwt.sign(payload, JWT_SECRET);
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'refresh') {
            return null;
        }
        return decoded;
    } catch (error) {
        return null;
    }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader) {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
    }

    return null;
}

/**
 * Extract API key from header
 */
export function extractApiKey(headers) {
    const authHeader = headers.authorization || '';
    const parts = authHeader.split(' ');

    if (parts.length === 2 && parts[0] === 'ApiKey') {
        return parts[1];
    }

    return null;
}

/**
 * Hash API key
 */
export function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate new API key
 */
export function generateApiKey() {
    return `sk_${Math.random().toString(36).substr(2, 20)}`;
}

/**
 * Middleware: Authenticate with JWT
 */
export function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);

    if (!token) {
        return res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing authentication token' }));
        return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or expired token' }));
        return;
    }

    req.user = decoded;
    next();
}

/**
 * Middleware: Check permissions
 */
export function checkPermission(...requiredPermissions) {
    return (req, res, next) => {
        if (!req.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        const userPermissions = req.user.permissions || [];
        const hasPermission = requiredPermissions.some(perm => 
            userPermissions.includes(perm) || userPermissions.includes('admin:full')
        );

        if (!hasPermission) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Insufficient permissions',
                required: requiredPermissions 
            }));
            return;
        }

        next();
    };
}

/**
 * Middleware: Check role
 */
export function checkRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Access denied',
                required_role: allowedRoles 
            }));
            return;
        }

        next();
    };
}

/**
 * Login user and return tokens
 */
export async function loginUser(email, password) {
    try {
        const user = await User.findByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }

        if (!User.verifyPassword(password, user.password_hash)) {
            throw new Error('Invalid password');
        }

        if (!user.is_active) {
            throw new Error('User account is inactive');
        }

        // Update last login
        await User.updateLastLogin(user.id);

        // Generate tokens
        const permissions = user.permissions || [];
        const accessToken = generateToken(user.id, user.role, permissions);
        const refreshToken = generateRefreshToken(user.id);

        return {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                permissions,
            },
            accessToken,
            refreshToken,
            expiresIn: parseInt(JWT_EXPIRES_IN),
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken) {
    try {
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            throw new Error('Invalid refresh token');
        }

        const user = await User.findById(decoded.sub);
        if (!user) {
            throw new Error('User not found');
        }

        const permissions = user.permissions || [];
        const newAccessToken = generateToken(user.id, user.role, permissions);

        return {
            accessToken: newAccessToken,
            expiresIn: parseInt(JWT_EXPIRES_IN),
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Role-based permission mapping
 */
export const ROLE_PERMISSIONS = {
    admin: [
        'admin:full',
        'users:manage',
        'skills:read',
        'skills:write',
        'skills:execute',
        'executions:read',
        'executions:write',
        'workflows:read',
        'workflows:write',
        'api-keys:manage',
        'analytics:read',
    ],
    developer: [
        'skills:read',
        'skills:write',
        'skills:execute',
        'executions:read',
        'executions:write',
        'workflows:read',
        'workflows:write',
        'api-keys:manage',
        'analytics:read',
    ],
    executor: [
        'skills:read',
        'skills:execute',
        'executions:read',
        'executions:write',
        'workflows:read',
        'analytics:read',
    ],
    viewer: [
        'skills:read',
        'executions:read',
        'workflows:read',
        'analytics:read',
    ],
    service: [
        'skills:execute',
        'executions:write',
        'webhooks:trigger',
    ],
};

/**
 * Get permissions for role
 */
export function getPermissionsForRole(role) {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
}

export default {
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    extractToken,
    extractApiKey,
    hashApiKey,
    generateApiKey,
    authenticateJWT,
    checkPermission,
    checkRole,
    loginUser,
    refreshAccessToken,
    ROLE_PERMISSIONS,
    getPermissionsForRole,
};
