-- iHuman Platform Database Schema
-- PostgreSQL SQL file for creating all necessary tables and relationships

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin', 'developer', 'executor', 'viewer', 'service')),
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- =====================================================
-- API KEYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    scopes JSONB DEFAULT '[]'::jsonb,
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- =====================================================
-- SKILLS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL CHECK (category IN ('frontend', 'backend', 'devops', 'ai-ml', 'data', 'infrastructure', 'security')),
    difficulty VARCHAR(50) CHECK (difficulty IN ('beginner', 'intermediate', 'expert')),
    tags JSONB DEFAULT '[]'::jsonb,
    parameters JSONB DEFAULT '{}' ::jsonb,
    estimated_time INTEGER,
    rating FLOAT DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    author VARCHAR(255),
    version VARCHAR(50) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    documentation_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_difficulty ON skills(difficulty);
CREATE INDEX idx_skills_skill_id ON skills(skill_id);

-- =====================================================
-- EXECUTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id),
    workflow_id UUID,
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'in-progress', 'completed', 'failed', 'rolled-back', 'cancelled')),
    input_params JSONB DEFAULT '{}'::jsonb,
    output_result JSONB DEFAULT NULL,
    error_message TEXT,
    expertise_level VARCHAR(50),
    persona VARCHAR(255),
    progress INTEGER DEFAULT 0,
    duration_ms INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_executions_user_id ON executions(user_id);
CREATE INDEX idx_executions_skill_id ON executions(skill_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_created_at ON executions(created_at DESC);
CREATE INDEX idx_executions_execution_id ON executions(execution_id);

-- =====================================================
-- EXECUTION HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS execution_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    step_number INTEGER,
    step_name VARCHAR(255),
    status VARCHAR(50),
    message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_execution_history_execution_id ON execution_history(execution_id);

-- =====================================================
-- WORKFLOWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'custom' CHECK (type IN ('template', 'custom', 'system')),
    skills JSONB DEFAULT '[]'::jsonb,
    parameters JSONB DEFAULT '{}' ::jsonb,
    estimated_time INTEGER,
    rating FLOAT DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    author_id UUID REFERENCES users(id),
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflows_type ON workflows(type);
CREATE INDEX idx_workflows_author_id ON workflows(author_id);
CREATE INDEX idx_workflows_workflow_id ON workflows(workflow_id);

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failure')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- WEBHOOKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    events JSONB DEFAULT '[]'::jsonb,
    headers JSONB DEFAULT '{}' ::jsonb,
    is_active BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);

-- =====================================================
-- WEBHOOK DELIVERIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100),
    payload JSONB,
    status_code INTEGER,
    response_body TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status_code ON webhook_deliveries(status_code);

-- =====================================================
-- FAVORITES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_skill_id ON favorites(skill_id);

-- =====================================================
-- SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- =====================================================
-- SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
);

CREATE INDEX idx_settings_user_id ON settings(user_id);
CREATE INDEX idx_settings_key ON settings(key);

-- =====================================================
-- FUNCTIONS FOR UPDATED_AT TIMESTAMPS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_executions_updated_at BEFORE UPDATE ON executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active users with execution statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    COUNT(DISTINCT e.id) as total_executions,
    COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) as successful_executions,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) / 
        NULLIF(COUNT(DISTINCT e.id), 0), 2) as success_rate,
    MAX(u.last_login) as last_login,
    u.created_at
FROM users u
LEFT JOIN executions e ON u.id = e.user_id
WHERE u.is_active = true AND u.deleted_at IS NULL
GROUP BY u.id, u.username, u.email, u.role, u.created_at;

-- View for skill popularity
CREATE OR REPLACE VIEW skill_stats AS
SELECT 
    s.id,
    s.skill_id,
    s.name,
    s.category,
    s.difficulty,
    COUNT(e.id) as total_executions,
    COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) as successful_executions,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) / 
        NULLIF(COUNT(e.id), 0), 2) as success_rate,
    ROUND(AVG(EXTRACT(EPOCH FROM (e.completed_at - e.started_at))), 2) as avg_duration_seconds,
    s.rating,
    s.execution_count
FROM skills s
LEFT JOIN executions e ON s.id = e.skill_id AND e.status = 'completed'
WHERE s.is_active = true
GROUP BY s.id, s.skill_id, s.name, s.category, s.difficulty, s.rating, s.execution_count;

-- =====================================================
-- SEED DATA (Optional)
-- =====================================================

-- Insert admin user (password: admin123)
INSERT INTO users (email, username, password_hash, full_name, role, is_verified, is_active)
VALUES (
    'admin@ihuman.dev',
    'admin',
    crypt('admin123', gen_salt('bf')),
    'Admin User',
    'admin',
    true,
    true
) ON CONFLICT DO NOTHING;

-- Insert sample skills
INSERT INTO skills (skill_id, name, description, category, difficulty, tags, rating, execution_count)
VALUES 
    ('react-setup', 'React Project Setup', 'Create a modern React project with TypeScript and Tailwind', 'frontend', 'beginner', '["react", "typescript", "tailwind"]'::jsonb, 4.8, 156),
    ('docker-setup', 'Docker Configuration', 'Setup Docker with best practices and optimization', 'devops', 'intermediate', '["docker", "devops", "containerization"]'::jsonb, 4.7, 89),
    ('api-design', 'REST API Design', 'Design and scaffold a RESTful API with Express', 'backend', 'intermediate', '["express", "api", "rest"]'::jsonb, 4.9, 203),
    ('ml-pipeline', 'ML Pipeline Setup', 'Create machine learning pipeline with TensorFlow', 'ai-ml', 'expert', '["ml", "tensorflow", "python"]'::jsonb, 4.6, 45),
    ('security-audit', 'Security Audit', 'Run comprehensive security analysis on your project', 'security', 'intermediate', '["security", "audit", "devops"]'::jsonb, 4.5, 67)
ON CONFLICT (skill_id) DO NOTHING;
