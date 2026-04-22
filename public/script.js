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
    
    // Add text formatting (simple line breaks)
    const content = document.createElement('div');
    content.innerHTML = text.replace(/\\n/g, '<br/>');
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
