const sendBtn = document.getElementById('sendBtn');
const userInput = document.getElementById('userInput');
const chatMessages = document.getElementById('chat-messages');
const loader = document.getElementById('loading');

const agentMap = {
    "Project Manager": "agent-pm",
    "Content Manager": "agent-cm",
    "Rédacteur Web": "agent-rw",
    "Data Analyst": "agent-da"
};

function setAgentActive(agentName) {
    // Reset all
    document.querySelectorAll('.agent-card').forEach(card => {
        card.classList.remove('active');
        card.querySelector('.status').textContent = 'Idle';
    });

    // Set active
    if (agentName && agentMap[agentName]) {
        const card = document.getElementById(agentMap[agentName]);
        card.classList.add('active');
        card.querySelector('.status').textContent = 'Working...';
    }
}

function addMessage(text, type, agentName = null) {
    const el = document.createElement('div');
    el.className = `message ${type}`;
    
    if (type === 'agent' && agentName) {
        const title = document.createElement('div');
        title.className = 'agent-label';
        title.textContent = agentName;
        el.appendChild(title);
    }
    
    const content = document.createElement('div');
    content.className = 'markdown-body';
    
    if (type === 'agent' || type === 'system') {
        content.innerHTML = marked.parse(text);
        
        // Find code blocks and add download buttons
        content.querySelectorAll('pre code').forEach((codeBlock) => {
            const pre = codeBlock.parentElement;
            
            let lang = 'txt';
            codeBlock.classList.forEach(cls => {
                if(cls.startsWith('language-')) {
                    lang = cls.replace('language-', '');
                }
            });
            const extMap = { 'markdown': 'md', 'javascript': 'js', 'json': 'json', 'html': 'html', 'csv': 'csv' };
            const ext = extMap[lang] || lang;
            
            const btn = document.createElement('button');
            btn.className = 'download-btn';
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download .${ext}`;
            
            btn.onclick = () => {
                const blob = new Blob([codeBlock.textContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `agent_output_${Date.now()}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
            };
            
            const header = document.createElement('div');
            header.className = 'code-header';
            
            const langLabel = document.createElement('span');
            langLabel.textContent = lang;
            
            header.appendChild(langLabel);
            header.appendChild(btn);
            
            pre.parentNode.insertBefore(header, pre);
        });
    } else {
        content.textContent = text;
    }
    el.appendChild(content);
    
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Reset UI
    userInput.value = '';
    addMessage(text, 'user');
    loader.classList.add('active');
    setAgentActive('Project Manager'); // PM always intercepts first

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text }) // Pass history here in V2
        });

        const data = await response.json();
        
        loader.classList.remove('active');

        if (data.error) {
            addMessage(`Error: ${data.error}`, 'system');
            setAgentActive(null);
            return;
        }

        // Output PM insight if it delegated the task
        if (data.pm_insight && data.agent !== "Project Manager") {
            addMessage(data.pm_insight, 'agent', "Project Manager");
            
            // Brief visual transition to the new agent
            setTimeout(() => {
                setAgentActive(data.agent);
                setTimeout(() => {
                    addMessage(data.reply, 'agent', data.agent);
                    setTimeout(() => setAgentActive(null), 2000);
                }, 500);
            }, 1000);
        } else {
            // Handled completely by PM
            addMessage(data.reply, 'agent', data.agent);
            setTimeout(() => setAgentActive(null), 2000);
        }

    } catch (err) {
        loader.classList.remove('active');
        setAgentActive(null);
        addMessage(`Connection Error: Make sure your server is running.`, 'system');
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
