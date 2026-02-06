// Global State
let currentSkill = null;
let currentSkillMetadata = null;
let skillParametersUI = {};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    loadSkillsAndMetadata();
    initializeEventListeners();
});

// Load all skills from repository
async function loadSkillsAndMetadata() {
    try {
        // Get skill metadata
        const response = await fetch('/api/skill-metadata');
        const data = await response.json();
        
        if (data.skills && data.skills.length > 0) {
            const skillsList = document.querySelector('.skills-sidebar ul');
            if (skillsList) {
                skillsList.innerHTML = '';
                
                data.skills.forEach((skill, idx) => {
                    const li = document.createElement('li');
                    li.className = idx === 0 ? 'skill-item active' : 'skill-item';
                    li.dataset.skill = skill.id;
                    li.textContent = skill.name;
                    skillsList.appendChild(li);
                });
                
                setupSkillItemListeners();
                
                // Select first skill
                if (data.skills.length > 0) {
                    selectSkill(skillsList.querySelector('.skill-item'), data.skills[0].id);
                }
                
                console.log(`✅ Loaded ${data.skills.length} real skills`);
            }
        }
    } catch (error) {
        console.error('Error loading skills:', error);
    }
}

function setupSkillItemListeners() {
    document.querySelectorAll('.skill-item').forEach(item => {
        item.removeEventListener('click', handleSkillClick);
        item.addEventListener('click', handleSkillClick);
    });
}

function handleSkillClick(e) {
    const skillId = e.target.dataset.skill;
    selectSkill(e.target, skillId);
}

// Select a skill and load its metadata
async function selectSkill(element, skillId) {
    try {
        // Fetch metadata for this skill
        const response = await fetch(`/api/skill-metadata?skill=${skillId}`);
        const skillMeta = await response.json();
        
        currentSkill = skillId;
        currentSkillMetadata = skillMeta;
        
        // Update UI
        document.querySelectorAll('.skill-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        
        document.getElementById('skillName').textContent = skillMeta.name;
        document.getElementById('skillDesc').textContent = skillMeta.description;
        
        // Clear and rebuild parameters UI
        buildParametersUI(skillMeta);
        
        clearOutput();
        addOutput(`📚 Skill selected: ${skillMeta.name}`);
        addOutput(`Category: ${skillMeta.category}`);
        addOutput(`Estimated time: ${skillMeta.estimatedTime}`);
        
    } catch (error) {
        console.error('Error selecting skill:', error);
    }
}

// Build dynamic parameter UI
function buildParametersUI(skillMeta) {
    const configPanel = document.querySelector('.config-panel');
    
    // Keep base fields but add skill-specific parameters
    const paramsHtml = skillMeta.parameters.map(param => {
        const id = `param-${param.name}`;
        
        if (param.type === 'text') {
            return `
                <div class="config-group">
                    <label for="${id}">${param.label}</label>
                    <input type="text" id="${id}" placeholder="${param.hint || ''}" 
                           data-param="${param.name}" data-required="${param.required || false}">
                </div>
            `;
        } else if (param.type === 'boolean') {
            return `
                <div class="config-group">
                    <label>
                        <input type="checkbox" id="${id}" data-param="${param.name}">
                        ${param.label}
                    </label>
                </div>
            `;
        } else if (param.type === 'select') {
            return `
                <div class="config-group">
                    <label for="${id}">${param.label}</label>
                    <select id="${id}" data-param="${param.name}">
                        ${param.options.map(opt => 
                            `<option value="${opt}" ${opt === param.default ? 'selected' : ''}>${opt}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
        }
        return '';
    }).join('');
    
    const existingParams = configPanel.querySelectorAll('[data-param]');
    existingParams.forEach(el => {
        if (el.parentElement.classList.contains('config-group')) {
            el.parentElement.remove();
        }
    });
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = paramsHtml;
    const newParams = tempDiv.querySelectorAll('.config-group');
    configPanel.appendChild(...newParams);
}

function initializeEventListeners() {
    // Tab Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });

    // Skill Selection (initial setup)
    setupSkillItemListeners();

    // Skills View Buttons
    document.getElementById('executeBtn').addEventListener('click', executeSkill);
    document.getElementById('dryRunBtn').addEventListener('click', dryRun);

    // Agency View Buttons
    document.getElementById('analyzeBtn').addEventListener('click', analyzeObjective);
    document.getElementById('startBtn').addEventListener('click', startOrchestration);
    document.getElementById('resetBtn').addEventListener('click', resetAgency);
}

// Tab Switching
function switchTab(tabName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

    if (tabName === 'skills') {
        document.getElementById('skills-view').classList.add('active');
        document.getElementById('skills-tab').classList.add('active');
        document.querySelectorAll('.nav-tab')[0].classList.add('active');
    } else if (tabName === 'agency') {
        document.getElementById('agency-view').classList.add('active');
        document.getElementById('agency-tab').classList.add('active');
        document.querySelectorAll('.nav-tab')[1].classList.add('active');
    }
}

// Dry Run: Validate parameters and show execution plan
async function dryRun() {
    if (!currentSkill || !currentSkillMetadata) {
        addOutput('❌ Please select a skill first');
        return;
    }

    clearOutput();
    addOutput('🧪 DRY RUN MODE - No changes will be made');
    addOutput('');
    
    // Collect parameters
    const parameters = collectParameters();
    
    try {
        const response = await fetch('/api/validate-skill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                skillId: currentSkill,
                parameters
            })
        });
        
        const validation = await response.json();
        
        if (!validation.valid) {
            addOutput('❌ Validation errors:');
            validation.errors.forEach(err => addOutput(`  • ${err}`));
            return;
        }
        
        addOutput('✅ All validations passed!');
        addOutput('');
        addOutput('📋 Execution Plan:');
        addOutput('');
        
        if (validation.dryRunPreview) {
            const preview = validation.dryRunPreview;
            preview.steps.forEach((step, idx) => {
                const icon = step.critical ? '🔴' : '⚪';
                addOutput(`${icon} Step ${step.order}: ${step.name}`);
            });
            
            addOutput('');
            addOutput(`⏱️  Estimated total time: ${preview.estimatedTotalTime}`);
            addOutput(`📁 Estimated output files: ${preview.estimatedOutputFiles}`);
        }
        
        addOutput('');
        addOutput('Ready to execute? Click "Execute Skill" to proceed.');
        
    } catch (error) {
        console.error('Dry run error:', error);
        addOutput(`❌ Error: ${error.message}`);
    }
}

// Execute Skill: Run with real streaming
async function executeSkill() {
    if (!currentSkill || !currentSkillMetadata) {
        addOutput('❌ Please select a skill first');
        return;
    }

    clearOutput();
    updateStatus('executing', 'Executing');
    addOutput('🚀 Starting skill execution...');
    addOutput('');
    
    // Collect parameters
    const parameters = collectParameters();
    const level = document.getElementById('level').value;
    const persona = document.getElementById('persona').value;
    
    try {
        const response = await fetch('/api/execute-skill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                skillId: currentSkill,
                parameters,
                level,
                persona
            })
        });
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        // Stream SSE events
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let stepCount = 0;
        let isRunning = true;
        
        while (isRunning) {
            const { done, value } = await reader.read();
            
            if (done) {
                updateStatus('success', 'Success');
                addOutput('');
                addOutput('✅ Skill execution completed successfully!');
                break;
            }
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const event = JSON.parse(line.substring(6));
                        
                        if (event.type === 'started') {
                            addOutput(`⏱️  Started: ${event.skillName}`);
                            addOutput(`📊 Total steps: ${event.totalSteps}`);
                            addOutput('');
                        } else if (event.type === 'step_progress') {
                            stepCount++;
                            const progressPercent = event.progress;
                            const progressBar = '█'.repeat(Math.floor(progressPercent / 5)) + 
                                              '░'.repeat(20 - Math.floor(progressPercent / 5));
                            addOutput(`[${progressBar}] ${progressPercent}% - ${event.stepName}`);
                        } else if (event.type === 'complete') {
                            addOutput('');
                            addOutput(`✅ Execution ID: ${event.executionId}`);
                            addOutput(`⏱️  Duration: ${event.duration}`);
                            addOutput(`📁 Files created: ${event.filesCreated}`);
                            addOutput(`📂 Output: ${event.outputDirectory}`);
                            addOutput(`🔄 Rollback token: ${event.rollbackToken}`);
                        }
                    } catch (e) {
                        // Not JSON, skip
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Execution error:', error);
        addOutput(`❌ Error: ${error.message}`);
        updateStatus('error', 'Error');
    }
}

// Collect all parameters from form
function collectParameters() {
    const params = {};
    
    document.querySelectorAll('[data-param]').forEach(input => {
        const paramName = input.dataset.param;
        
        if (input.type === 'checkbox') {
            params[paramName] = input.checked;
        } else {
            params[paramName] = input.value;
        }
    });
    
    return params;
}

// Output Management
function clearOutput() {
    const output = document.getElementById('output');
    if (output) {
        output.innerHTML = '';
    }
}

function addOutput(text) {
    const output = document.getElementById('output');
    if (output) {
        const line = document.createElement('div');
        line.textContent = text;
        line.style.marginBottom = '4px';
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }
}

function updateStatus(statusType, statusText) {
    const badge = document.getElementById('status');
    if (badge) {
        badge.className = `status-badge status-${statusType}`;
        badge.textContent = statusText;
    }
}

// Agency Mode Functions (preserved from original)
let currentWorkflow = null;
let currentDecisions = {};

async function analyzeObjective() {
    const objective = document.getElementById('objective').value;
    
    if (!objective || objective.trim().length === 0) {
        alert('Please enter an objective');
        return;
    }

    try {
        const response = await fetch('/api/agency/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objective })
        });

        const result = await response.json();
        currentWorkflow = result.recommendedWorkflow;

        if (currentWorkflow) {
            showPhase2(currentWorkflow);
        }
    } catch (error) {
        console.error('Error analyzing objective:', error);
        alert('Error analyzing objective');
    }
}

function showPhase2(workflow) {
    document.querySelector('.agency-phase.active')?.classList.remove('active');
    document.getElementById('phase2-recommendation').classList.add('active');
    document.getElementById('workflowTitle').textContent = workflow.name;
    document.getElementById('workflowDesc').textContent = workflow.description;

    const decisionsContainer = document.getElementById('phase2-decisions');
    decisionsContainer.innerHTML = '';
    currentDecisions = {};

    let allDecisions = [];
    workflow.phases.forEach(phase => {
        if (phase.decisionPoints) {
            allDecisions = allDecisions.concat(phase.decisionPoints);
        }
    });

    allDecisions.forEach((decision, idx) => {
        const div = document.createElement('div');
        div.style.marginBottom = '12px';
        
        const label = document.createElement('label');
        label.textContent = decision.question;
        label.style.display = 'block';
        label.style.marginBottom = '4px';
        label.style.fontWeight = 'bold';
        
        const select = document.createElement('select');
        select.dataset.decision = decision.id;
        select.style.width = '100%';
        select.style.padding = '8px';
        
        decision.options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            select.appendChild(opt);
        });
        
        select.addEventListener('change', (e) => {
            currentDecisions[decision.id] = e.target.value;
        });
        
        div.appendChild(label);
        div.appendChild(select);
        decisionsContainer.appendChild(div);
    });
}

async function startOrchestration() {
    if (!currentWorkflow) {
        alert('Please analyze an objective first');
        return;
    }

    document.querySelector('.agency-phase.active')?.classList.remove('active');
    document.getElementById('phase3-execution').classList.add('active');

    const progressBar = document.getElementById('progressBar');
    const skillCounter = document.getElementById('skillCounter');
    
    try {
        const response = await fetch('/api/agency/orchestrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workflowType: currentWorkflow.id,
                decisions: currentDecisions
            })
        });

        const totalSkills = currentWorkflow.phases.reduce((acc, p) => acc + p.skills.length, 0);
        let completed = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                progressBar.style.width = '100%';
                showPhase4();
                break;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const event = JSON.parse(line.substring(6));
                        if (event.type === 'skill_complete') {
                            completed++;
                            const percent = (completed / totalSkills) * 100;
                            progressBar.style.width = percent + '%';
                            skillCounter.textContent = `${completed}/${totalSkills} skills completed`;
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (error) {
        console.error('Error orchestrating workflow:', error);
    }
}

function showPhase4() {
    document.querySelector('.agency-phase.active')?.classList.remove('active');
    document.getElementById('phase4-completion').classList.add('active');
    
    // Show workflow summary
    if (currentWorkflow) {
        const summary = document.querySelector('.completion-summary');
        const phasesList = currentWorkflow.phases.map((p, i) => 
            `<li>✅ ${i + 1}. ${p.name}</li>`
        ).join('');
        
        summary.innerHTML = `
            <h3>${currentWorkflow.name}</h3>
            <p>${currentWorkflow.description}</p>
            <strong>Phases Completed:</strong>
            <ul>${phasesList}</ul>
        `;
    }
}

function resetAgency() {
    currentWorkflow = null;
    currentDecisions = {};
    
    document.querySelector('.agency-phase.active')?.classList.remove('active');
    document.getElementById('phase1-input').classList.add('active');
    document.getElementById('objective').value = '';
}
