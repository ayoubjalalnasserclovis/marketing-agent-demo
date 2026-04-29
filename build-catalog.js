const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_URL = 'https://github.com/alirezarezvani/claude-skills.git';
const SKILLS_DIR = path.join(__dirname, 'claude-skills');
const CATALOG_PATH = path.join(__dirname, 'skill_catalog.json');

// 1. Clone repository if not exists
if (!fs.existsSync(SKILLS_DIR)) {
    console.log('Cloning claude-skills repository...');
    try {
        execSync(`git clone ${REPO_URL} "${SKILLS_DIR}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error('Failed to clone repository:', e);
        process.exit(1);
    }
} else {
    console.log('claude-skills repository already exists. Skipping clone.');
}

// 2. Build catalog
const catalog = [];

function parseSkill(domain, skillName, skillPath) {
    const mdPath = path.join(skillPath, 'SKILL.md');
    if (fs.existsSync(mdPath)) {
        catalog.push({
            id: `${domain}/${skillName}`,
            domain: domain,
            name: skillName,
            description: `Requires injecting the ${skillName} SKILL.md rules to the agent.`
        });
    }
}

function scanDomain(domainDir) {
    const domainName = path.basename(domainDir);
    // Ignore hidden files and scripts
    if (domainName.startsWith('.') || domainName === 'scripts' || domainName === 'docs' ) return;

    try {
        const contents = fs.readdirSync(domainDir, { withFileTypes: true });
        for (const item of contents) {
            if (item.isDirectory()) {
                // Potential skill dir or sub-domain
                const itemPath = path.join(domainDir, item.name);
                if (fs.existsSync(path.join(itemPath, 'SKILL.md'))) {
                    parseSkill(domainName, item.name, itemPath);
                }
            }
        }
    } catch (e) {
        // Ignored
    }
}

console.log('Building skill catalog...');
try {
    const rootContents = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    for (const item of rootContents) {
        if (item.isDirectory() && !item.name.startsWith('.')) {
            scanDomain(path.join(SKILLS_DIR, item.name));
        }
    }
    
    // Also scan custom-skills
    const CUSTOM_DIR = path.join(__dirname, 'custom-skills');
    if (fs.existsSync(CUSTOM_DIR)) {
        const customContents = fs.readdirSync(CUSTOM_DIR, { withFileTypes: true });
        for (const item of customContents) {
            if (item.isDirectory() && !item.name.startsWith('.')) {
                scanDomain(path.join(CUSTOM_DIR, item.name));
            }
        }
    }
    
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
    console.log(`Successfully indexed ${catalog.length} skills to skill_catalog.json`);
} catch (e) {
    console.error('Failed to build catalog:', e);
}
