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
        // API Routes
        if (pathname === '/api/agency/analyze' && method === 'POST') {
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
        } else if (pathname === '/api/execute-skill' && method === 'POST') {
            handleExecuteSkill(req, res);
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

// Start server
server.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║       🚀 ihuman - Skill Execution Platform Started 🚀    ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`📡 API Base:   http://localhost:${PORT}/api/agency\n`);
    console.log('Available Endpoints:');
    console.log('  POST /api/agency/analyze      - Analyze objectives');
    console.log('  POST /api/agency/orchestrate  - Execute workflows');
    console.log('  POST /api/agency/rollback     - Rollback execution');
    console.log('  POST /api/agency/status       - Check session status');
    console.log('  GET  /api/agency/workflows    - List workflows\n');
    console.log('Press Ctrl+C to stop\n');
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
