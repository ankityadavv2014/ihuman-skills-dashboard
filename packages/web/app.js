// Skill descriptions
const skillDescriptions = {
    'react-setup': 'Setup a modern React project with TypeScript and tooling',
    'typescript-config': 'Configure TypeScript with best practices',
    'api-design': 'Design REST APIs following best practices',
    'security-audit': 'Run comprehensive security audit on your project',
    'docker-setup': 'Setup Docker for your application',
    'ci-cd-setup': 'Configure CI/CD pipeline',
    'testing-strategy': 'Setup comprehensive testing strategy',
    'performance-optimization': 'Optimize application performance'
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    loadSkills();
    initializeEventListeners();
});

async function loadSkills() {
    try {
        const response = await fetch('/api/agency/skills');
        const data = await response.json();
        
        if (data.skills && data.skills.length > 0) {
            const skillsList = document.querySelector('.skills-sidebar ul');
            if (skillsList) {
                // Clear existing skills
                skillsList.innerHTML = '';
                
                // Add loaded skills
                data.skills.forEach(skill => {
                    const li = document.createElement('li');
                    li.className = 'skill-item';
                    li.dataset.skill = skill.id;
                    li.textContent = skill.name;
                    skillsList.appendChild(li);
                });
                
                // Re-attach event listeners to new elements
                setupSkillItemListeners();
                
                console.log(`✅ Loaded ${data.total} real skills from repository`);
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
    // Hide all tabs and views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab and view
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

// Skill Selection
function selectSkill(element, skillId) {
    document.querySelectorAll('.skill-item').forEach(el => {
        el.classList.remove('active');
    });
    element.classList.add('active');

    document.getElementById('skillName').textContent = skillId.replace(/-/g, ' ');
    document.getElementById('skillDesc').textContent = skillDescriptions[skillId] || '';

    addOutput('📚 Skill selected: ' + skillId);
}

// Execute Skill
async function executeSkill() {
    const skillName = document.getElementById('skillName').textContent;
    const level = document.getElementById('level').value;
    const persona = document.getElementById('persona').value;

    updateStatus('executing', 'Executing');
    clearOutput();
    addOutput('🚀 Starting skill execution...');
    addOutput('📝 Skill: ' + skillName);
    addOutput('📊 Level: ' + level);
    addOutput('👤 Persona: ' + persona);
    addOutput('');

    try {
        // Call real API endpoint to execute skill with real file creation
        const response = await fetch('/api/execute-skill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                skill: skillName,
                level: level,
                persona: persona
            })
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }

        const data = await response.json();

        if (data.error) {
            addOutput('❌ Error: ' + data.error);
            updateStatus('error', 'Error');
            return;
        }

        // Show execution output
        if (data.output) {
            data.output.forEach(line => addOutput(line));
        }

        // Show files created
        if (data.filesCreated && data.filesCreated.length > 0) {
            addOutput('');
            addOutput('📁 Files created:');
            data.filesCreated.forEach(file => {
                addOutput('  ✓ ' + file);
            });
        }

        addOutput('');
        addOutput('✅ Skill execution completed successfully!');
        updateStatus('success', 'Success');

    } catch (error) {
        console.error('Error executing skill:', error);
        addOutput('❌ Error: ' + error.message);
        updateStatus('error', 'Error');
    }
}

// Dry Run
function dryRun() {
    const skillName = document.getElementById('skillName').textContent;

    updateStatus('executing', 'Executing');
    clearOutput();
    addOutput('🧪 DRY RUN MODE - No changes will be made');
    addOutput('');
    addOutput('📋 Execution Plan for: ' + skillName);
    addOutput('');
    addOutput('Step 1: Validate project name format');
    addOutput('Step 2: Check Node.js and npm versions');
    addOutput('Step 3: Create project directory');
    addOutput('Step 4: Initialize package.json');
    addOutput('Step 5: Install dependencies');
    addOutput('Step 6: Setup configuration files');
    addOutput('Step 7: Initialize git repository');
    addOutput('');
    addOutput('✅ Dry run completed. No changes made.');
    updateStatus('success', 'Ready');
}

// Output Management
function addOutput(text) {
    const output = document.getElementById('output');
    output.textContent += text + '\n';
    output.scrollTop = output.scrollHeight;
}

function clearOutput() {
    document.getElementById('output').textContent = '';
}

function updateStatus(type, text) {
    const status = document.getElementById('status');
    status.textContent = text;
    status.className = 'status-badge status-' + type;
}

// Store current workflow in session
let currentWorkflow = null;
let currentDecisions = {};

// Agency Functions
async function analyzeObjective() {
    console.log('📊 analyzeObjective called');
    const objective = document.getElementById('agencyObjective').value.trim();
    console.log('📝 Objective:', objective);

    if (!objective) {
        alert('Please enter an objective');
        return;
    }

    try {
        const response = await fetch('/api/agency/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objective })
        });

        const data = await response.json();
        console.log('✅ API Response:', data);

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        if (!data.recommendedWorkflow) {
            alert('No matching workflow found for: "' + objective + '"\n\nTry:\n• "Build a SaaS MVP"\n• "Machine learning pipeline"\n• "DevOps infrastructure"\n• "Mobile app"\n• "Backend API"');
            return;
        }

        // Move to phase 2
        document.getElementById('phase1-objective').classList.remove('active');
        document.getElementById('phase2-recommendation').classList.add('active');
        document.getElementById('phase2-recommendation').style.display = 'block';

        // Store the workflow for later use
        currentWorkflow = data.recommendedWorkflow;
        console.log('💾 Stored workflow:', currentWorkflow.id, currentWorkflow.name);

        // Show workflow recommendation
        document.getElementById('workflow-recommendation').style.display = 'block';
        document.getElementById('workflow-title').textContent =
            data.recommendedWorkflow?.name || 'Recommended Workflow';
        document.getElementById('workflow-description').textContent =
            data.recommendedWorkflow?.description || '';

        // Show decisions - extract from all phases
        const decisionsContainer = document.getElementById('decisions-container');
        decisionsContainer.innerHTML = '';

        let allDecisions = [];
        if (data.recommendedWorkflow?.phases) {
            data.recommendedWorkflow.phases.forEach(phase => {
                console.log('📋 Phase:', phase.phase, '- Decisions:', phase.decisionPoints);
                if (phase.decisionPoints) {
                    allDecisions = allDecisions.concat(phase.decisionPoints);
                }
            });
        }

        console.log('🎯 All Decisions Found:', allDecisions.length);

        if (allDecisions.length > 0) {
            allDecisions.forEach((decision, idx) => {
                console.log('🔧 Creating decision dropdown:', decision.question);
                const div = document.createElement('div');
                div.style.marginBottom = '15px';

                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.fontWeight = '600';
                label.style.color = 'var(--text)';
                label.style.marginBottom = '8px';
                label.textContent = decision.question;
                div.appendChild(label);

                const select = document.createElement('select');
                select.id = 'decision_' + idx;
                select.style.width = '100%';
                select.style.padding = '8px';
                select.style.background = 'var(--bg)';
                select.style.color = 'var(--text)';
                select.style.border = '1px solid var(--border)';
                select.style.borderRadius = '4px';

                if (decision.options && Array.isArray(decision.options)) {
                    decision.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        select.appendChild(option);
                    });
                }

                div.appendChild(select);
                decisionsContainer.appendChild(div);
            });
        } else {
            console.log('ℹ️ No decision points in this workflow - skipping decisions');
            // If no decision points, show a message
            const msg = document.createElement('p');
            msg.style.color = 'var(--text-muted)';
            msg.textContent = 'This workflow has no additional decisions required. Ready to start!';
            decisionsContainer.appendChild(msg);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error analyzing objective: ' + error.message);
        // Reset to phase 1 so user can try again
        document.getElementById('phase1-objective').classList.add('active');
        document.getElementById('phase2-recommendation').classList.remove('active');
    }
}

async function startOrchestration() {
    console.log('🚀 startOrchestration called');
    
    if (!currentWorkflow) {
        alert('No workflow selected. Please analyze an objective first.');
        return;
    }

    const objective = document.getElementById('agencyObjective').value;
    console.log('📝 Objective:', objective);
    console.log('🔄 Using Workflow:', currentWorkflow.id);

    // Collect decisions from dropdowns
    const decisions = {};
    document.querySelectorAll('[id^="decision_"]').forEach(select => {
        const decisionKey = select.id.replace('decision_', '');
        decisions[decisionKey] = select.value;
        console.log('📋 Decision:', decisionKey, '=', select.value);
    });
    currentDecisions = decisions;

    // Move to phase 3
    document.getElementById('phase2-recommendation').classList.remove('active');
    document.getElementById('phase2-recommendation').style.display = 'none';
    document.getElementById('phase3-progress').classList.add('active');
    document.getElementById('phase3-progress').style.display = 'block';
    document.getElementById('orchestration-progress').style.display = 'block';

    try {
        console.log('📡 Calling /api/agency/orchestrate...');
        const response = await fetch('/api/agency/orchestrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workflowType: currentWorkflow.id,
                objective: objective,
                decisions: decisions
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        console.log('✅ Connected to SSE stream');
        const reader = response.body.getReader();
        let skillsCompleted = 0;
        
        // Count total skills from workflow
        const totalSkills = currentWorkflow.phases.reduce((sum, phase) => {
            return sum + (phase.skills ? phase.skills.length : 0);
        }, 0);
        console.log('📊 Total skills to execute:', totalSkills);

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('✨ Stream ended');
                break;
            }

            const text = new TextDecoder().decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const event = JSON.parse(line.slice(6));
                        console.log('📨 Event:', event.type);

                        if (event.type === 'skill_complete') {
                            skillsCompleted++;
                            const progress = Math.round((skillsCompleted / totalSkills) * 100);
                            document.getElementById('progress-bar').style.width = progress + '%';
                            document.getElementById('progress-text').textContent =
                                skillsCompleted + '/' + totalSkills + ' skills completed';
                            console.log('✅ Skill complete:', skillsCompleted, '/', totalSkills);
                        } else if (event.type === 'complete') {
                            console.log('🎉 Orchestration complete');
                            showCompletion(event.context, totalSkills);
                        } else if (event.type === 'error') {
                            console.error('❌ Error:', event.error);
                            alert('Error: ' + event.error);
                            resetAgency();
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Orchestration error:', error);
        alert('Error starting orchestration: ' + error.message);
        resetAgency();
    }
}

function showCompletion(context, totalSkills) {
    console.log('🎉 showCompletion called');
    
    // Move to phase 4
    document.getElementById('phase3-progress').classList.remove('active');
    document.getElementById('phase3-progress').style.display = 'none';
    document.getElementById('phase4-complete').classList.add('active');
    document.getElementById('phase4-complete').style.display = 'block';

    document.getElementById('orchestration-progress').style.display = 'none';
    document.getElementById('orchestration-complete').style.display = 'block';

    // Build completion message
    const workflowName = currentWorkflow?.name || 'Workflow';
    const successMessage = `✅ ${workflowName} executed successfully!\n\nYour infrastructure is now ready for development.`;
    document.getElementById('completion-message').textContent = successMessage;

    // Build detailed summary
    const details = document.getElementById('completion-details');
    let html = '<h4 style="color: var(--text); margin: 0 0 15px 0; font-size: 14px;">📊 Execution Summary</h4>';
    
    html += '<p style="color: var(--text-muted); margin: 0 0 10px 0; font-size: 13px;"><strong style="color: var(--text);">Workflow:</strong> ' + (currentWorkflow?.name || 'N/A') + '</p>';
    html += '<p style="color: var(--text-muted); margin: 0 0 10px 0; font-size: 13px;"><strong style="color: var(--text);">Complexity:</strong> ' + (currentWorkflow?.complexity || 'N/A') + '</p>';
    html += '<p style="color: var(--text-muted); margin: 0 0 10px 0; font-size: 13px;"><strong style="color: var(--text);">Estimated Time:</strong> ' + (currentWorkflow?.estimatedTime || 'N/A') + '</p>';
    html += '<p style="color: var(--text-muted); margin: 0 0 10px 0; font-size: 13px;"><strong style="color: var(--text);">Total Skills:</strong> ' + (totalSkills || 0) + '</p>';
    html += '<p style="color: var(--text-muted); margin: 0 0 15px 0; font-size: 13px;"><strong style="color: var(--text);">Status:</strong> <span style="color: var(--success);">✓ Complete</span></p>';
    
    // Show phases completed
    if (currentWorkflow?.phases) {
        html += '<p style="color: var(--text-muted); margin: 0 0 10px 0; font-size: 12px;"><strong style="color: var(--text);">Phases Completed:</strong></p>';
        html += '<ul style="margin: 5px 0 0 20px; padding: 0; list-style: none; color: var(--text-muted); font-size: 12px;">';
        currentWorkflow.phases.forEach((phase, idx) => {
            html += '<li style="margin: 4px 0; color: var(--success);">✓ ' + phase.phase + '</li>';
        });
        html += '</ul>';
    }
    
    // Show decisions made
    if (Object.keys(currentDecisions).length > 0) {
        html += '<p style="color: var(--text-muted); margin: 15px 0 10px 0; font-size: 12px;"><strong style="color: var(--text);">Decisions Applied:</strong></p>';
        html += '<ul style="margin: 5px 0 0 20px; padding: 0; list-style: none; color: var(--text-muted); font-size: 12px;">';
        for (const [key, value] of Object.entries(currentDecisions)) {
            html += '<li style="margin: 4px 0;">📌 ' + key + ' → ' + value + '</li>';
        }
        html += '</ul>';
    }
    
    details.innerHTML = html;
}

function resetAgency() {
    console.log('↺ Resetting Agency workflow');
    
    // Clear all state
    currentWorkflow = null;
    currentDecisions = {};
    
    // Reset form
    document.getElementById('agencyObjective').value = '';
    
    // Reset all phases visibility
    document.getElementById('phase1-objective').classList.add('active');
    document.getElementById('phase1-objective').style.display = 'block';
    
    document.getElementById('phase2-recommendation').classList.remove('active');
    document.getElementById('phase2-recommendation').style.display = 'none';
    document.getElementById('workflow-recommendation').style.display = 'none';
    
    document.getElementById('phase3-progress').classList.remove('active');
    document.getElementById('phase3-progress').style.display = 'none';
    document.getElementById('orchestration-progress').style.display = 'none';
    
    document.getElementById('phase4-complete').classList.remove('active');
    document.getElementById('phase4-complete').style.display = 'none';
    document.getElementById('orchestration-complete').style.display = 'none';
    
    // Reset progress bar
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-text').textContent = '0/0 skills completed';
}
