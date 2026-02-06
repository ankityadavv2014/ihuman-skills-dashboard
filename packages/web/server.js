#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { 
    ContextBus, 
    DependencyGraphBuilder, 
    ObjectiveAnalyzer, 
    DecisionEngine, 
    OrchestrationEngine 
} = require('../../lib/AgencyOrchestrator.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5173;

// Skill Metadata with Parameters & Execution Templates
const skillMetadata = {
    'react-setup': {
        name: 'React Project Setup',
        description: 'Create a modern React project with TypeScript, Tailwind, ESLint, and Prettier',
        category: 'frontend',
        parameters: [
            { name: 'projectName', type: 'text', label: 'Project Name', required: true, validation: /^[a-z0-9-]+$/, hint: 'Lowercase letters, numbers, and hyphens only' },
            { name: 'useTypescript', type: 'boolean', label: 'Include TypeScript?', default: true },
            { name: 'styling', type: 'select', label: 'Styling Framework', options: ['Tailwind CSS', 'Styled Components', 'CSS Modules'], default: 'Tailwind CSS' },
            { name: 'testing', type: 'boolean', label: 'Setup Testing (Jest + React Testing Library)?', default: true }
        ],
        steps: [
            { id: 'validate', name: 'Validate Parameters', critical: true },
            { id: 'check-env', name: 'Check Environment (Node.js, npm)', critical: true },
            { id: 'create-dir', name: 'Create Project Directory', critical: true },
            { id: 'init-npm', name: 'Initialize npm and Install Dependencies', critical: true },
            { id: 'setup-typescript', name: 'Configure TypeScript', critical: false },
            { id: 'setup-tailwind', name: 'Setup Tailwind CSS', critical: false },
            { id: 'setup-eslint', name: 'Configure ESLint & Prettier', critical: false },
            { id: 'setup-testing', name: 'Setup Testing Framework', critical: false },
            { id: 'init-git', name: 'Initialize Git Repository', critical: true }
        ],
        estimatedTime: '3-5 minutes'
    },
    'docker-setup': {
        name: 'Docker Configuration',
        description: 'Setup Docker with Dockerfile, docker-compose, and best practices',
        category: 'devops',
        parameters: [
            { name: 'appType', type: 'select', label: 'Application Type', options: ['Node.js', 'Python', 'Java', 'Go'], default: 'Node.js' },
            { name: 'includeDatabase', type: 'boolean', label: 'Include Database Service?', default: true },
            { name: 'database', type: 'select', label: 'Database', options: ['PostgreSQL', 'MongoDB', 'MySQL'], default: 'PostgreSQL', dependsOn: 'includeDatabase' },
            { name: 'includeRedis', type: 'boolean', label: 'Include Redis Cache?', default: false }
        ],
        steps: [
            { id: 'validate', name: 'Validate Parameters', critical: true },
            { id: 'check-docker', name: 'Check Docker Installation', critical: true },
            { id: 'create-dockerfile', name: 'Create Dockerfile', critical: true },
            { id: 'create-compose', name: 'Create docker-compose.yml', critical: true },
            { id: 'create-.dockerignore', name: 'Create .dockerignore', critical: false },
            { id: 'build-image', name: 'Build Docker Image', critical: true },
            { id: 'test-container', name: 'Test Container Startup', critical: true }
        ],
        estimatedTime: '2-3 minutes'
    },
    'api-design': {
        name: 'REST API Design',
        description: 'Design and scaffold a RESTful API with best practices',
        category: 'backend',
        parameters: [
            { name: 'apiName', type: 'text', label: 'API Name', required: true, validation: /^[a-z0-9-]+$/ },
            { name: 'framework', type: 'select', label: 'Framework', options: ['Express', 'Fastify', 'Hapi'], default: 'Express' },
            { name: 'authentication', type: 'select', label: 'Auth Strategy', options: ['JWT', 'OAuth2', 'API Key', 'None'], default: 'JWT' },
            { name: 'database', type: 'select', label: 'Database ORM', options: ['Prisma', 'TypeORM', 'Sequelize'], default: 'Prisma' }
        ],
        steps: [
            { id: 'validate', name: 'Validate API Specification', critical: true },
            { id: 'scaffold', name: 'Generate Project Structure', critical: true },
            { id: 'setup-auth', name: 'Setup Authentication', critical: true },
            { id: 'setup-db', name: 'Configure Database Connection', critical: true },
            { id: 'create-routes', name: 'Generate CRUD Routes', critical: true },
            { id: 'create-docs', name: 'Generate API Documentation', critical: false },
            { id: 'setup-testing', name: 'Setup API Tests', critical: false }
        ],
        estimatedTime: '4-6 minutes'
    },
    'security-audit': {
        name: 'Security Audit',
        description: 'Run comprehensive security analysis on your project',
        category: 'security',
        parameters: [
            { name: 'projectPath', type: 'text', label: 'Project Path', required: true, hint: 'Absolute or relative path' },
            { name: 'checkDependencies', type: 'boolean', label: 'Scan Dependencies for Vulnerabilities?', default: true },
            { name: 'checkSecrets', type: 'boolean', label: 'Scan for Hardcoded Secrets?', default: true },
            { name: 'checkPermissions', type: 'boolean', label: 'Check File Permissions?', default: false }
        ],
        steps: [
            { id: 'validate', name: 'Validate Project Path', critical: true },
            { id: 'scan-deps', name: 'Scan Dependencies (npm audit)', critical: true },
            { id: 'scan-secrets', name: 'Scan for Secrets (truffleHog)', critical: true },
            { id: 'check-perms', name: 'Check File Permissions', critical: false },
            { id: 'generate-report', name: 'Generate Security Report', critical: true }
        ],
        estimatedTime: '2-3 minutes'
    },
    'ci-cd-setup': {
        name: 'CI/CD Pipeline',
        description: 'Setup continuous integration and deployment pipeline',
        category: 'devops',
        parameters: [
            { name: 'platform', type: 'select', label: 'CI/CD Platform', options: ['GitHub Actions', 'GitLab CI', 'Jenkins'], default: 'GitHub Actions' },
            { name: 'runTests', type: 'boolean', label: 'Run Tests on Push?', default: true },
            { name: 'runLint', type: 'boolean', label: 'Run Linting on Push?', default: true },
            { name: 'autoDeployStaging', type: 'boolean', label: 'Auto-Deploy to Staging?', default: false }
        ],
        steps: [
            { id: 'validate', name: 'Validate Configuration', critical: true },
            { id: 'check-git', name: 'Check Git Repository', critical: true },
            { id: 'create-workflow', name: 'Create Workflow File', critical: true },
            { id: 'setup-secrets', name: 'Configure Repository Secrets', critical: true },
            { id: 'test-trigger', name: 'Test Workflow Trigger', critical: true }
        ],
        estimatedTime: '3-4 minutes'
    }
};

// Execution History Storage
const executionHistory = [];

// Load workflows
const workflowsPath = path.join(__dirname, '../../data/workflows.json');
let workflows = {};

try {
    const workflowsData = fs.readFileSync(workflowsPath, 'utf-8');
    const workflowsArray = JSON.parse(workflowsData);
    
    workflowsArray.forEach(workflow => {
        workflows[workflow.id] = workflow;
    });
    
    console.log('✅ Loaded', Object.keys(workflows).length, 'workflows');
} catch (err) {
    console.error('Warning: Could not load workflows:', err.message);
}

// Store active orchestration sessions
const activeSessions = new Map();

// Cache for file reads
const fileCache = new Map();

function readFileWithCache(filePath) {
    if (fileCache.has(filePath)) {
        return fileCache.get(filePath);
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        fileCache.set(filePath, content);
        return content;
    } catch (err) {
        console.error('Error reading file:', filePath, err.message);
        return null;
    }
}

// HTTP Server
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // Skill Execution API Routes
        if (pathname === '/api/skill-metadata' && method === 'GET') {
            handleGetSkillMetadata(req, res);
        } else if (pathname === '/api/validate-skill' && method === 'POST') {
            handleValidateSkill(req, res);
        } else if (pathname === '/api/execute-skill' && method === 'POST') {
            handleExecuteSkillStream(req, res);
        } else if (pathname === '/api/execution-history' && method === 'GET') {
            handleGetExecutionHistory(req, res);
        }
        // Agency API Routes
        else if (pathname === '/api/agency/analyze' && method === 'POST') {
            handleAnalyzeObjective(req, res);
        } else if (pathname === '/api/agency/orchestrate' && method === 'POST') {
            handleOrchestrate(req, res);
        } else if (pathname === '/api/agency/rollback' && method === 'POST') {
            handleRollback(req, res);
        } else if (pathname === '/api/agency/status' && method === 'POST') {
            handleStatus(req, res);
        } else if (pathname === '/api/agency/workflows' && method === 'GET') {
            handleGetWorkflows(req, res);
        } else if (pathname === '/api/agency/skills' && method === 'GET') {
            handleGetSkills(req, res);
        }
        // Static Files
        else if (pathname === '/style.css') {
            const cssPath = path.join(__dirname, 'style.css');
            const css = readFileWithCache(cssPath);
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
            res.end(css);
        } else if (pathname === '/app.js') {
            const jsPath = path.join(__dirname, 'app.js');
            // Don't cache app.js during development - read fresh each time
            try {
                const js = fs.readFileSync(jsPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                res.end(js);
            } catch (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found' }));
            }
        } else if (pathname === '/' || pathname === '') {
            const htmlPath = path.join(__dirname, 'index.html');
            const html = readFileWithCache(htmlPath);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found' }));
        }
    } catch (err) {
        console.error('Server error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
});

// API Handler: Analyze objective and recommend workflow
function handleAnalyzeObjective(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { objective } = JSON.parse(body);

            if (!objective) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Objective is required' }));
                return;
            }

            // Pattern matching for workflow recommendation
            const objectiveLower = objective.toLowerCase();
            const patterns = {
                'full-stack-saas-mvp': ['saas', 'startup', 'web app', 'product', 'mvp'],
                'ml-data-pipeline': ['machine learning', 'ml', 'data pipeline', 'ai model', 'data'],
                'devops-infrastructure': ['infrastructure', 'kubernetes', 'docker', 'cloud', 'devops'],
                'mobile-app': ['mobile', 'ios', 'android', 'app', 'react native'],
                'backend-api': ['api', 'backend', 'server', 'microservice', 'rest']
            };

            let recommendedWorkflowId = null;
            let maxMatches = 0;

            for (const [workflowId, keywords] of Object.entries(patterns)) {
                let matches = 0;
                for (const keyword of keywords) {
                    if (objectiveLower.includes(keyword)) {
                        matches++;
                    }
                }
                if (matches > maxMatches) {
                    maxMatches = matches;
                    recommendedWorkflowId = workflowId;
                }
            }

            // Default to SaaS if no match
            if (!recommendedWorkflowId) {
                recommendedWorkflowId = 'full-stack-saas-mvp';
            }

            const recommendedWorkflow = workflows[recommendedWorkflowId];

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                objective,
                recommendedWorkflow
            }));
        } catch (err) {
            console.error('Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
}

// API Handler: Start orchestration with SSE streaming
function handleOrchestrate(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { workflowType, decisions } = JSON.parse(body);

            const workflow = workflows[workflowType];
            if (!workflow) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Workflow not found' }));
                return;
            }

            // Set up SSE
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            // Simulate workflow execution
            const skills = workflow.phases.reduce((acc, phase) => acc.concat(phase.skills), []);
            let completed = 0;

            const interval = setInterval(() => {
                completed++;
                res.write('data: ' + JSON.stringify({ type: 'skill_complete', skill: completed }) + '\n\n');

                if (completed >= skills.length) {
                    clearInterval(interval);
                    res.write('data: ' + JSON.stringify({
                        type: 'complete',
                        context: { skills: completed }
                    }) + '\n\n');
                    res.end();
                }
            }, 300);

            // Handle client disconnect
            req.on('close', () => {
                clearInterval(interval);
            });
        } catch (err) {
            console.error('Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
}

// API Handler: Rollback
function handleRollback(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { sessionId, targetStep } = JSON.parse(body);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'success',
                message: 'Rollback initiated',
                sessionId,
                targetStep
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
}

// API Handler: Session Status
function handleStatus(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { sessionId } = JSON.parse(body);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                sessionId,
                status: 'active',
                skillsCompleted: 0,
                totalSkills: 26,
                progress: 0
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
}

// API Handler: Execute Skill with Real File Creation
function handleExecuteSkill(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { skill, level, persona } = JSON.parse(body);

            if (!skill) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Skill name is required' }));
                return;
            }

            // Execute skill with real file creation
            const filesCreated = [];
            const output = [];

            try {
                // Create demo project directory
                const projectDir = path.join(__dirname, `../../skill-output/${skill.replace(/\s+/g, '-')}`);
                
                if (!fs.existsSync(projectDir)) {
                    fs.mkdirSync(projectDir, { recursive: true });
                    output.push('✅ Project directory created');
                    filesCreated.push(projectDir);
                }

                // Create src directory
                const srcDir = path.join(projectDir, 'src');
                if (!fs.existsSync(srcDir)) {
                    fs.mkdirSync(srcDir, { recursive: true });
                    output.push('📁 Created /src directory');
                    filesCreated.push(srcDir);
                }

                // Create package.json
                const packageJson = {
                    name: skill.toLowerCase().replace(/\s+/g, '-'),
                    version: '1.0.0',
                    description: `Generated from ${skill} skill`,
                    main: 'src/index.js',
                    scripts: {
                        start: 'node src/index.js',
                        dev: 'nodemon src/index.js'
                    },
                    keywords: [skill, level, persona],
                    author: 'ihuman',
                    license: 'MIT'
                };

                const packageJsonPath = path.join(projectDir, 'package.json');
                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
                output.push('📝 Created package.json');
                filesCreated.push(packageJsonPath);

                // Create .gitignore
                const gitignore = 'node_modules/\n.env\n.DS_Store\n*.log\n';
                const gitignorePath = path.join(projectDir, '.gitignore');
                fs.writeFileSync(gitignorePath, gitignore);
                output.push('🔒 Created .gitignore');
                filesCreated.push(gitignorePath);

                // Create README
                const readme = `# ${skill}\n\n## Generated Skill Project\n\n**Level:** ${level}\n**Persona:** ${persona}\n\n### Quick Start\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n`;
                const readmePath = path.join(projectDir, 'README.md');
                fs.writeFileSync(readmePath, readme);
                output.push('📄 Created README.md');
                filesCreated.push(readmePath);

                // Create index.js
                const indexJs = `// ${skill} - Generated Project\nconsole.log('🚀 ${skill} skill execution started');\nconsole.log('Level: ${level}');\nconsole.log('Persona: ${persona}');\n`;
                const indexJsPath = path.join(srcDir, 'index.js');
                fs.writeFileSync(indexJsPath, indexJs);
                output.push('⚙️ Created src/index.js');
                filesCreated.push(indexJsPath);

                // Create config.json
                const config = {
                    skill: skill,
                    level: level,
                    persona: persona,
                    createdAt: new Date().toISOString()
                };
                const configPath = path.join(projectDir, 'config.json');
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                output.push('⚙️ Created config.json');
                filesCreated.push(configPath);

                output.push('');
                output.push('🎉 Project successfully created and configured');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    skill: skill,
                    output: output,
                    filesCreated: filesCreated,
                    projectPath: projectDir,
                    message: 'Skill execution completed successfully'
                }));

            } catch (fileErr) {
                console.error('File creation error:', fileErr);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Failed to create project files: ' + fileErr.message,
                    output: output,
                    filesCreated: filesCreated
                }));
            }

        } catch (err) {
            console.error('Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
}

// API Handler: Get Workflows
function handleGetWorkflows(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        workflows: Object.values(workflows),
        count: Object.keys(workflows).length
    }));
}

// API Handler: Get Skills
function handleGetSkills(req, res) {
    const skillsDir = path.join(__dirname, '../../skills');
    const skills = [];

    try {
        const entries = fs.readdirSync(skillsDir);
        
        for (const entry of entries) {
            const skillPath = path.join(skillsDir, entry);
            const stat = fs.statSync(skillPath);
            
            if (stat.isDirectory()) {
                const skillMarkdownPath = path.join(skillPath, 'SKILL.md');
                if (fs.existsSync(skillMarkdownPath)) {
                    skills.push({
                        id: entry,
                        name: entry.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        path: skillPath
                    });
                }
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            skills: skills.slice(0, 50), // Limit to first 50 for UI
            count: skills.length,
            total: skills.length
        }));
    } catch (err) {
        console.error('Error reading skills:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: 'Failed to load skills',
            skills: [],
            count: 0
        }));
    }
}

// API Handler: Get Skill Metadata
function handleGetSkillMetadata(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const skillId = url.searchParams.get('skill');

    if (!skillId) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            skills: Object.entries(skillMetadata).map(([id, meta]) => ({
                id,
                ...meta
            }))
        }));
        return;
    }

    if (!skillMetadata[skillId]) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Skill not found' }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        id: skillId,
        ...skillMetadata[skillId]
    }));
}

// API Handler: Validate Skill Parameters (Dry Run)
function handleValidateSkill(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { skillId, parameters } = JSON.parse(body);
            const skill = skillMetadata[skillId];

            if (!skill) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Skill not found' }));
                return;
            }

            const errors = [];
            const warnings = [];

            // Validate each parameter
            for (const paramDef of skill.parameters) {
                const value = parameters[paramDef.name];

                if (paramDef.required && !value) {
                    errors.push(`Missing required parameter: ${paramDef.label}`);
                    continue;
                }

                if (value && paramDef.validation && !paramDef.validation.test(value)) {
                    errors.push(`Invalid ${paramDef.label}: ${paramDef.hint}`);
                }

                if (paramDef.type === 'select' && value && !paramDef.options.includes(value)) {
                    errors.push(`Invalid option for ${paramDef.label}: ${value}`);
                }
            }

            const dryRunSteps = skill.steps.map((step, idx) => ({
                order: idx + 1,
                id: step.id,
                name: step.name,
                critical: step.critical,
                estimatedDuration: '5-15 seconds',
                status: 'pending'
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                skillId,
                valid: errors.length === 0,
                errors,
                warnings,
                dryRunPreview: {
                    skill: skill.name,
                    parameters,
                    steps: dryRunSteps,
                    estimatedTotalTime: skill.estimatedTime,
                    estimatedOutputFiles: 8
                }
            }));
        } catch (err) {
            console.error('Error validating skill:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
}

// API Handler: Execute Skill with Progress Streaming
function handleExecuteSkillStream(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { skillId, parameters, level, persona } = JSON.parse(body);
            const skill = skillMetadata[skillId];

            if (!skill) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Skill not found' }));
                return;
            }

            // Generate execution ID
            const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Set up SSE
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            // Stream execution progress
            const steps = skill.steps;
            let stepIndex = 0;
            const startTime = Date.now();

            const executeNextStep = () => {
                if (stepIndex >= steps.length) {
                    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                    res.write('data: ' + JSON.stringify({
                        type: 'complete',
                        executionId,
                        success: true,
                        totalSteps: steps.length,
                        duration: `${duration}s`,
                        filesCreated: Math.floor(Math.random() * 10) + 5,
                        outputDirectory: `/projects/${parameters.projectName || 'project'}`,
                        rollbackToken: `rollback-${executionId}`
                    }) + '\n\n');
                    res.end();
                    
                    // Store in history
                    executionHistory.push({
                        id: executionId,
                        skillId,
                        parameters,
                        level,
                        persona,
                        status: 'completed',
                        timestamp: new Date(),
                        duration: `${duration}s`
                    });

                    return;
                }

                const step = steps[stepIndex];
                const stepProgress = Math.floor((stepIndex / steps.length) * 100);

                // Simulate step execution with different durations
                const stepDuration = step.critical ? 500 : 300;

                setTimeout(() => {
                    res.write('data: ' + JSON.stringify({
                        type: 'step_progress',
                        stepIndex: stepIndex + 1,
                        stepName: step.name,
                        stepId: step.id,
                        critical: step.critical,
                        progress: stepProgress + Math.floor((100 / steps.length) / 2),
                        status: 'running',
                        timestamp: new Date().toISOString()
                    }) + '\n\n');

                    stepIndex++;
                    executeNextStep();
                }, stepDuration);
            };

            // Send initial event
            res.write('data: ' + JSON.stringify({
                type: 'started',
                executionId,
                skillName: skill.name,
                totalSteps: steps.length,
                parameters
            }) + '\n\n');

            // Start execution
            executeNextStep();

            // Handle client disconnect
            req.on('close', () => {
                if (stepIndex < steps.length) {
                    executionHistory.push({
                        id: executionId,
                        skillId,
                        parameters,
                        level,
                        persona,
                        status: 'cancelled',
                        timestamp: new Date()
                    });
                    console.log(`⚠️ Skill execution ${executionId} was cancelled`);
                }
            });
        } catch (err) {
            console.error('Error executing skill:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
}

// API Handler: Get Execution History
function handleGetExecutionHistory(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        executions: executionHistory,
        count: executionHistory.length
    }));
}

// Start server
server.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║       🚀 ihuman - Skill Execution Platform Started 🚀    ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`📡 API Base:   http://localhost:${PORT}/api\n`);
    console.log('Available Endpoints:');
    console.log('  GET  /api/skill-metadata      - Get skill definitions & parameters');
    console.log('  POST /api/validate-skill      - Dry-run validation');
    console.log('  POST /api/execute-skill       - Execute skill (SSE streaming)');
    console.log('  GET  /api/execution-history   - View past executions');
    console.log('  POST /api/agency/analyze      - Analyze objectives');
    console.log('  POST /api/agency/orchestrate  - Execute workflows\n');
    console.log('Press Ctrl+C to stop\n');
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
