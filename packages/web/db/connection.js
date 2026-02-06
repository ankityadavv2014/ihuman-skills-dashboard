// Database Connection Module for iHuman Platform
// PostgreSQL connection with connection pooling and utilities

import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ihuman_db',
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Connection pool event handlers
pool.on('connect', () => {
    console.log('✅ Database connection pool initialized');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
});

/**
 * Query wrapper with error handling
 * @param {string} text - SQL query
 * @param {array} values - Query parameters
 * @returns {Promise} Query result
 */
export async function query(text, values) {
    const start = Date.now();
    try {
        const result = await pool.query(text, values);
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.warn(`⚠️ Slow query (${duration}ms): ${text.substring(0, 50)}...`);
        }
        return result;
    } catch (error) {
        console.error('❌ Database query error:', error);
        throw error;
    }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise} Database client
 */
export async function getClient() {
    return pool.connect();
}

/**
 * Execute query with client (for transactions)
 * @param {object} client - Database client
 * @param {string} text - SQL query
 * @param {array} values - Query parameters
 * @returns {Promise} Query result
 */
export async function queryWithClient(client, text, values) {
    return client.query(text, values);
}

/**
 * Initialize database schema
 * @returns {Promise<void>}
 */
export async function initializeDatabase() {
    try {
        console.log('📝 Initializing database schema...');
        
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        
        const client = await getClient();
        try {
            // Split and execute schema in transactions
            const statements = schema.split(';').filter(stmt => stmt.trim());
            
            for (const statement of statements) {
                if (statement.trim()) {
                    await client.query(statement);
                }
            }
            
            console.log('✅ Database schema initialized successfully');
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        throw error;
    }
}

/**
 * Check database connection
 * @returns {Promise<boolean>}
 */
export async function checkConnection() {
    try {
        const result = await query('SELECT NOW()');
        console.log('✅ Database connection verified');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

/**
 * Close the connection pool
 * @returns {Promise<void>}
 */
export async function closePool() {
    try {
        await pool.end();
        console.log('✅ Database connection pool closed');
    } catch (error) {
        console.error('❌ Error closing connection pool:', error);
    }
}

/**
 * Get pool statistics
 * @returns {object} Pool stats
 */
export function getPoolStats() {
    return {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingCount: pool.waitingCount,
    };
}

/**
 * Create a transaction
 * @param {function} callback - Transaction logic
 * @returns {Promise} Transaction result
 */
export async function transaction(callback) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Utility functions for common operations

/**
 * Insert a record
 * @param {string} table - Table name
 * @param {object} data - Data to insert
 * @returns {Promise} Inserted record
 */
export async function insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const text = `
        INSERT INTO ${table} (${keys.join(', ')})
        VALUES (${placeholders})
        RETURNING *
    `;
    
    const result = await query(text, values);
    return result.rows[0];
}

/**
 * Update a record
 * @param {string} table - Table name
 * @param {object} data - Data to update
 * @param {string} whereClause - WHERE clause
 * @param {array} whereValues - WHERE values
 * @returns {Promise} Updated record
 */
export async function update(table, data, whereClause, whereValues) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    const allValues = [...values, ...whereValues];
    const offset = keys.length;
    const conditions = whereClause.replace(/\$(\d+)/g, (match, num) => {
        return `$${parseInt(num) + offset}`;
    });
    
    const text = `
        UPDATE ${table}
        SET ${setClause}
        WHERE ${conditions}
        RETURNING *
    `;
    
    const result = await query(text, allValues);
    return result.rows[0];
}

/**
 * Delete a record
 * @param {string} table - Table name
 * @param {string} whereClause - WHERE clause
 * @param {array} whereValues - WHERE values
 * @returns {Promise} Number of deleted records
 */
export async function deleteRecord(table, whereClause, whereValues) {
    const text = `DELETE FROM ${table} WHERE ${whereClause}`;
    const result = await query(text, whereValues);
    return result.rowCount;
}

/**
 * Select records
 * @param {string} table - Table name
 * @param {string} whereClause - WHERE clause (optional)
 * @param {array} whereValues - WHERE values (optional)
 * @returns {Promise} Array of records
 */
export async function select(table, whereClause = '', whereValues = []) {
    let text = `SELECT * FROM ${table}`;
    if (whereClause) {
        text += ` WHERE ${whereClause}`;
    }
    
    const result = await query(text, whereValues);
    return result.rows;
}

/**
 * Select one record
 * @param {string} table - Table name
 * @param {string} whereClause - WHERE clause
 * @param {array} whereValues - WHERE values
 * @returns {Promise} Single record or null
 */
export async function selectOne(table, whereClause, whereValues) {
    const records = await select(table, whereClause, whereValues);
    return records.length > 0 ? records[0] : null;
}

/**
 * Count records
 * @param {string} table - Table name
 * @param {string} whereClause - WHERE clause (optional)
 * @param {array} whereValues - WHERE values (optional)
 * @returns {Promise} Count
 */
export async function count(table, whereClause = '', whereValues = []) {
    let text = `SELECT COUNT(*) as count FROM ${table}`;
    if (whereClause) {
        text += ` WHERE ${whereClause}`;
    }
    
    const result = await query(text, whereValues);
    return parseInt(result.rows[0].count);
}

export default {
    query,
    getClient,
    queryWithClient,
    initializeDatabase,
    checkConnection,
    closePool,
    getPoolStats,
    transaction,
    insert,
    update,
    deleteRecord,
    select,
    selectOne,
    count,
};
