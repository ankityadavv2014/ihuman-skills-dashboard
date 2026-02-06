// Database Models for iHuman Platform
// User, Skill, and Execution models with business logic

import * as db from './connection.js';
import crypto from 'crypto';

// =====================================================
// USER MODEL
// =====================================================
export const User = {
    /**
     * Create a new user
     */
    async create(email, username, password, fullName = null, role = 'viewer') {
        try {
            const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
            
            const result = await db.insert('users', {
                email,
                username,
                password_hash: passwordHash,
                full_name: fullName,
                role,
                is_active: true,
            });
            
            return result;
        } catch (error) {
            if (error.code === '23505') {
                throw new Error(`User with email ${email} or username ${username} already exists`);
            }
            throw error;
        }
    },

    /**
     * Find user by email
     */
    async findByEmail(email) {
        return db.selectOne('users', 'email = $1 AND deleted_at IS NULL', [email]);
    },

    /**
     * Find user by ID
     */
    async findById(id) {
        return db.selectOne('users', 'id = $1 AND deleted_at IS NULL', [id]);
    },

    /**
     * Find user by username
     */
    async findByUsername(username) {
        return db.selectOne('users', 'username = $1 AND deleted_at IS NULL', [username]);
    },

    /**
     * Verify password
     */
    verifyPassword(password, passwordHash) {
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        return hash === passwordHash;
    },

    /**
     * Update last login
     */
    async updateLastLogin(userId) {
        return db.update(
            'users',
            { last_login: new Date() },
            'id = $1',
            [userId]
        );
    },

    /**
     * Update user profile
     */
    async updateProfile(userId, updates) {
        return db.update('users', updates, 'id = $1', [userId]);
    },

    /**
     * Get user with execution statistics
     */
    async getUserStats(userId) {
        const result = await db.query(`
            SELECT 
                u.*,
                COUNT(e.id) as total_executions,
                COUNT(CASE WHEN e.status = 'completed' THEN e.id END) as successful_executions
            FROM users u
            LEFT JOIN executions e ON u.id = e.user_id
            WHERE u.id = $1 AND u.deleted_at IS NULL
            GROUP BY u.id
        `, [userId]);
        
        return result.rows[0] || null;
    },

    /**
     * List all active users (admin only)
     */
    async listUsers(limit = 50, offset = 0) {
        const result = await db.query(`
            SELECT id, email, username, full_name, role, is_active, last_login, created_at
            FROM users
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        return result.rows;
    },

    /**
     * Soft delete user
     */
    async delete(userId) {
        return db.update('users', { deleted_at: new Date() }, 'id = $1', [userId]);
    }
};

// =====================================================
// SKILL MODEL
// =====================================================
export const Skill = {
    /**
     * Get all skills with filtering
     */
    async list(filters = {}, limit = 50, offset = 0) {
        let query = 'SELECT * FROM skills WHERE is_active = true';
        const params = [];
        let paramIndex = 1;

        if (filters.category) {
            query += ` AND category = $${paramIndex}`;
            params.push(filters.category);
            paramIndex++;
        }

        if (filters.difficulty) {
            query += ` AND difficulty = $${paramIndex}`;
            params.push(filters.difficulty);
            paramIndex++;
        }

        if (filters.search) {
            query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        query += ` ORDER BY execution_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows;
    },

    /**
     * Get single skill by ID
     */
    async getById(skillId) {
        return db.selectOne('skills', 'id = $1 AND is_active = true', [skillId]);
    },

    /**
     * Get skill by skill_id (string identifier)
     */
    async getBySkillId(skillId) {
        return db.selectOne('skills', 'skill_id = $1 AND is_active = true', [skillId]);
    },

    /**
     * Update execution count and rating
     */
    async recordExecution(skillId, isSuccess, duration) {
        const skill = await this.getById(skillId);
        if (!skill) throw new Error('Skill not found');

        const updates = {
            execution_count: skill.execution_count + 1,
        };

        if (isSuccess) {
            updates.success_count = skill.success_count + 1;
        }

        return db.update('skills', updates, 'id = $1', [skillId]);
    },

    /**
     * Get skill statistics
     */
    async getStats(skillId) {
        const result = await db.query(`
            SELECT 
                s.*,
                COUNT(e.id) as recent_executions,
                AVG(EXTRACT(EPOCH FROM (e.completed_at - e.started_at))) as avg_duration
            FROM skills s
            LEFT JOIN executions e ON s.id = e.skill_id AND e.created_at > NOW() - INTERVAL '30 days'
            WHERE s.id = $1
            GROUP BY s.id
        `, [skillId]);

        return result.rows[0] || null;
    },

    /**
     * Search skills
     */
    async search(query, limit = 20) {
        const result = await db.query(`
            SELECT * FROM skills
            WHERE is_active = true AND (
                name ILIKE $1 OR 
                description ILIKE $1 OR 
                tags::text ILIKE $1
            )
            ORDER BY execution_count DESC
            LIMIT $2
        `, [`%${query}%`, limit]);

        return result.rows;
    },

    /**
     * Get popular skills
     */
    async getPopular(limit = 10) {
        const result = await db.query(`
            SELECT * FROM skills
            WHERE is_active = true
            ORDER BY execution_count DESC, rating DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    }
};

// =====================================================
// EXECUTION MODEL
// =====================================================
export const Execution = {
    /**
     * Create a new execution record
     */
    async create(userId, skillId, inputParams = {}, expertiseLevel = null, persona = null) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const result = await db.insert('executions', {
            execution_id: executionId,
            user_id: userId,
            skill_id: skillId,
            input_params: JSON.stringify(inputParams),
            expertise_level: expertiseLevel,
            persona: persona,
            status: 'queued',
            progress: 0,
        });

        return result;
    },

    /**
     * Get execution by ID
     */
    async getById(executionId) {
        return db.selectOne('executions', 'id = $1', [executionId]);
    },

    /**
     * Get execution by execution_id (string)
     */
    async getByExecutionId(executionId) {
        return db.selectOne('executions', 'execution_id = $1', [executionId]);
    },

    /**
     * Update execution status
     */
    async updateStatus(executionId, status, updates = {}) {
        const allUpdates = {
            status,
            ...updates,
            updated_at: new Date(),
        };

        if (status === 'completed' || status === 'failed') {
            allUpdates.completed_at = new Date();
        }

        return db.update('executions', allUpdates, 'id = $1', [executionId]);
    },

    /**
     * Update execution progress
     */
    async updateProgress(executionId, progress, message = null) {
        const updates = {
            progress,
            updated_at: new Date(),
        };

        return db.update('executions', updates, 'id = $1', [executionId]);
    },

    /**
     * Complete execution
     */
    async complete(executionId, result, durationMs) {
        return this.updateStatus(executionId, 'completed', {
            output_result: JSON.stringify(result),
            duration_ms: durationMs,
        });
    },

    /**
     * Fail execution
     */
    async fail(executionId, errorMessage, durationMs) {
        return this.updateStatus(executionId, 'failed', {
            error_message: errorMessage,
            duration_ms: durationMs,
        });
    },

    /**
     * Get user execution history
     */
    async getUserHistory(userId, limit = 50, offset = 0, status = null) {
        let query = `
            SELECT e.*, s.name as skill_name, s.category
            FROM executions e
            JOIN skills s ON e.skill_id = s.id
            WHERE e.user_id = $1
        `;
        const params = [userId];

        if (status) {
            query += ` AND e.status = $2`;
            params.push(status);
        }

        query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows;
    },

    /**
     * Get execution statistics
     */
    async getStats(userId) {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
                ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as success_rate,
                AVG(duration_ms) as avg_duration_ms
            FROM executions
            WHERE user_id = $1
        `, [userId]);

        return result.rows[0] || null;
    },

    /**
     * Rollback execution
     */
    async rollback(executionId, targetStep = null) {
        return this.updateStatus(executionId, 'rolled-back', {
            error_message: `Rolled back to step ${targetStep || 'start'}`,
        });
    }
};

// =====================================================
// AUDIT LOG MODEL
// =====================================================
export const AuditLog = {
    /**
     * Log an action
     */
    async log(userId, action, entityType, entityId, oldValues = null, newValues = null, status = 'success', errorMessage = null) {
        return db.insert('audit_logs', {
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            old_values: oldValues ? JSON.stringify(oldValues) : null,
            new_values: newValues ? JSON.stringify(newValues) : null,
            status,
            error_message: errorMessage,
        });
    },

    /**
     * Get audit logs for entity
     */
    async getEntityLogs(entityType, entityId, limit = 50) {
        const result = await db.query(`
            SELECT * FROM audit_logs
            WHERE entity_type = $1 AND entity_id = $2
            ORDER BY created_at DESC
            LIMIT $3
        `, [entityType, entityId, limit]);

        return result.rows;
    },

    /**
     * Get user activity
     */
    async getUserActivity(userId, limit = 100) {
        const result = await db.query(`
            SELECT * FROM audit_logs
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [userId, limit]);

        return result.rows;
    }
};

export default {
    User,
    Skill,
    Execution,
    AuditLog,
};
