const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let skillIds = "";
try {
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'skill_catalog.json')));
    skillIds = catalog.map(s => s.id).join(', ');
} catch(e) {
    console.error("Skill catalog missing, run node build-catalog.js");
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// OpenRouter model identifier for Gemini 3.1 Flash Lite
const MODEL_NAME = 'google/gemini-3.1-flash-lite-preview'; 

async function callOpenRouter(systemPrompt, userMessage, jsonMode = false, history = []) {
    const messages = [ { role: "system", content: systemPrompt } ];
    
    // Append conversation history
    if (history && Array.isArray(history)) {
        messages.push(...history);
    }
    messages.push({ role: "user", content: userMessage });

    const body = {
        model: MODEL_NAME,
        messages: messages
    };
    
    if (jsonMode) {
        body.response_format = { type: "json_object" };
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter error: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
}

async function generateKieImage(prompt) {
    try {
        const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer b47967b4f41b450df9cf9bd41aac166e',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "model": "gpt-image-2-text-to-image",
                "input": { "prompt": prompt, "aspect_ratio": "auto", "resolution": "1K" }
            })
        });
        const createData = await createRes.json();
        if (createData.code !== 200) return `[Erreur KIE Génération: ${createData.msg}]`;
        
        const taskId = createData.data.taskId;
        
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                headers: { 'Authorization': 'Bearer b47967b4f41b450df9cf9bd41aac166e' }
            });
            const pollData = await pollRes.json();
            
            if (pollData.data && pollData.data.status === 'SUCCESS') {
                const imgUrl = pollData.data.imageUrl || pollData.data.url || (pollData.data.response && pollData.data.response.image_url) || (pollData.data.result && pollData.data.result.url) || pollData.data.result;
                return `![Image Client Générée KIE](${imgUrl})`;
            } else if (pollData.data && pollData.data.status === 'FAIL') {
                return `[Erreur: Échec génération d'image]`;
            }
        }
        return `[Erreur: Timeout lors de la génération d'image]`;
    } catch(e) {
        return `[Erreur Serveur: ${e.message}]`;
    }
}

const STONIZ_CONTEXT = `CONTEXTE ENTREPRISE: Tu travailles pour Stoniz (stoniz.co). Stoniz démocratise l'investissement immobilier au Maroc. Offres : Rénovation de A à Z clé en main (villas, riads, apparts), investissement locatif courte durée avec conciergerie interne, investissement fractionné à plusieurs, et obligations dès 100€. Cibles : Investisseurs, expatriés, MRE. Arguments : Coupe d'Afrique 2025, Coupe du Monde 2030, rendements attractifs. Toute ta stratégie doit servir la croissance de Stoniz. IMPORTANCE CAPITALE : Toutes tes publications, textes et posts doivent être SPÉCIFIQUEMENT ET EXCLUSIVEMENT taillés pour Stoniz et ses offres. Pas de généralités génériques sur l'immobilier, cite l'entreprise et ses offres spécifiques.`;

const PROMPTS = {
    "Project Manager": () => `${STONIZ_CONTEXT}\nTu es le Project Manager d'une équipe marketing IA, basé sur le framework "claude-skills".
Missions : Orchestrer les campagnes, suivre les tâches de chaque agent.
TU DISPOSES D'UNE LIBRAIRIE DE COMPÉTENCES (SKILLS). Tu dois analyser la requête et décider si tu peux répondre ou si tu dois déléguer.
Si tu délègues, tu DOIS choisir les compétences spécifiques (0, 1 ou plusieurs) nécessaires à l'agent depuis cette liste exacte : [${skillIds}]. Ne choisis aucune compétence si la tâche est banale.
RÉPOND IMPÉRATIVEMENT SOUS FORME DE JSON STRICT :
{"target": "Rédacteur Web" | "Content Manager" | "Data Analyst" | "Project Manager", "skills": ["id_du_skill_exact_s_il_y_en_a"], "instruction": "La tâche formatée (avec contexte et objectifs)", "response": "Ta réponse directe à l'utilisateur"}` ,

    "Content Manager": `${STONIZ_CONTEXT}\nTu es le Content Manager & Growth Marketer (intégrant les modules "marketing-skill" et "business-growth" de claude-skills). 
Missions : Définir le calendrier éditorial, gérer la stratégie de croissance, proposer des hooks viraux et créer des scripts.
NOUVELLE CAPACITÉ : Tu peux générer des images HD pour les posts. Pour générer une image, tu DOIS insérer exactement la balise suivante sur une ligne séparée :
[GENERATE_IMAGE: "Ta description extrêmement détaillée de l'image en anglais"]
Le système remplacera automatiquement cette balise par l'image générée. Utilise cette balise chaque fois que tu crées un post ou une publication.
Livre : Planning hebdo, scripts prêts à tourner, matrices de contenu avec balises d'images.`,

    "Rédacteur Web": `${STONIZ_CONTEXT}\nTu es le Rédacteur Web, Copywriter DRP (Direct Response Copywriting) et l'Expert SEO (basé sur "claude-seo" et "claude-skills").
Missions : Produire les contenus longs et SEO, rédiger des articles, landing pages.
Capacités d'Analyse SEO & Copywriting intégrées :
- Copywriting: Frameworks PAS (Problem-Agitate-Solve), AIDA, et StoryBrand.
- Analyse E-E-A-T (Sept 2025).
- Recommandations Techniques (Core Web Vitals).
- Optimisation GEO, Analyse sémantique et SXO.
Livre : Articles complets publiables, ressources, audits SEO, et textes à haute conversion.`,

    "Data Analyst": `${STONIZ_CONTEXT}\nTu es le Data Analyst (basé sur les modules "product-team/analytics" et "finance/saas-metrics" de claude-skills).
Missions : Analyser les performances (réseaux sociaux, blog), calculer les ROIs, suivre le LTV/CAC, et identifier ce qui marche/ne marche pas via des modèles statistiques.
Livre : Reporting hebdo, Top contenus, et recommandations DATA-DRIVEN actionnables.`
};

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        
        // Step 1: Project Manager evaluates the task
        const pmText = await callOpenRouter(PROMPTS["Project Manager"](), message, true, history);
        
        let pmData;
        try {
            // Sometimes OpenRouter wraps json in markdown code blocks
            const cleanJson = pmText.replace(/```json/g, "").replace(/```/g, "").trim();
            pmData = JSON.parse(cleanJson);
        } catch(e) {
            console.error("Failed to parse PM response", pmText);
            return res.status(500).json({ error: "PM Router failed to format JSON" });
        }

        const { target, instruction, response, skills } = pmData;

        // If the PM is handling it directly
        if (target === "Project Manager") {
            return res.json({
                agent: "Project Manager",
                reply: response
            });
        }

        // Step 2: Push to the correct underlying agent with Agentic RAG
        let targetPrompt = PROMPTS[target] || PROMPTS["Rédacteur Web"];
        
        // Inject physical SKILL.md rules if the PM selected any
        if (skills && Array.isArray(skills) && skills.length > 0) {
            for (const s of skills) {
                const p = path.join(__dirname, 'claude-skills', s, 'SKILL.md');
                if (fs.existsSync(p)) {
                    targetPrompt += "\n\n--- REQUIRED SKILL INJECTED: " + s + " ---\n" + fs.readFileSync(p, 'utf-8');
                }
            }
        }

        let agentText = await callOpenRouter(targetPrompt, instruction, false, history);

        // Intercept and auto-generate KIE images
        const imgRegex = /\[GENERATE_IMAGE:\s*"?([^"\]]+)"?\s*\]/g;
        let match;
        // Generate images sequentially to avoid overwhelming the API
        while ((match = imgRegex.exec(agentText)) !== null) {
            const imgPrompt = match[1];
            console.log("KIE API Triggered - Generating Image:", imgPrompt);
            const imgMarkdown = await generateKieImage(imgPrompt);
            agentText = agentText.replace(match[0], imgMarkdown);
        }
        res.json({
            agent: target,
            pm_insight: response,
            reply: agentText
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Marketing Agent Demo running on port ${PORT} using OpenRouter`));
