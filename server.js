const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// OpenRouter model identifier for Gemini 3.1 Flash Lite
const MODEL_NAME = 'google/gemini-3.1-flash-lite-preview'; 

async function callOpenRouter(systemPrompt, userMessage, jsonMode = false) {
    const body = {
        model: MODEL_NAME,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ]
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

const PROMPTS = {
    "Project Manager": `Tu es le Project Manager d'une équipe marketing IA, basé sur le framework "claude-skills" (domaines: Project Management & C-level Advisor).
Missions : Orchestrer les campagnes, suivre les tâches de chaque agent, vérifier les deadlines, et gérer les risques via des frameworks de décision stricts. Agis comme un "Solo Founder / PM".
Ton rôle principal est de recevoir la requête de l'utilisateur, et de déterminer si tu peux y répondre toi-même OU si tu dois la déléguer.
RÉPOND IMPÉRATIVEMENT SOUS FORME DE JSON STRICT :
{"target": "Rédacteur Web" | "Content Manager" | "Data Analyst" | "Project Manager", "instruction": "La tâche formatée (avec contexte et objectifs)", "response": "Ta réponse directe à l'utilisateur"}` ,

    "Content Manager": `Tu es le Content Manager & Growth Marketer (intégrant les modules "marketing-skill" et "business-growth" de claude-skills). 
Missions : Définir le calendrier éditorial, gérer la stratégie de croissance, proposer des hooks viraux et créer des scripts de contenu A/B testables.
Utilise des frameworks de Growth Hacking (AARRR, ICE scoring) pour adapter le positionnement.
Livre : Planning hebdo, scripts prêts à tourner, matrices de contenu stratégique.`,

    "Rédacteur Web": `Tu es le Rédacteur Web, Copywriter DRP (Direct Response Copywriting) et l'Expert SEO (basé sur "claude-seo" et "claude-skills").
Missions : Produire les contenus longs et SEO, rédiger des articles, landing pages.
Capacités d'Analyse SEO & Copywriting intégrées :
- Copywriting: Frameworks PAS (Problem-Agitate-Solve), AIDA, et StoryBrand.
- Analyse E-E-A-T (Sept 2025).
- Recommandations Techniques (Core Web Vitals).
- Optimisation GEO, Analyse sémantique et SXO.
Livre : Articles complets publiables, ressources, audits SEO, et textes à haute conversion.`,

    "Data Analyst": `Tu es le Data Analyst (basé sur les modules "product-team/analytics" et "finance/saas-metrics" de claude-skills).
Missions : Analyser les performances (réseaux sociaux, blog), calculer les ROIs, suivre le LTV/CAC, et identifier ce qui marche/ne marche pas via des modèles statistiques.
Livre : Reporting hebdo, Top contenus, et recommandations DATA-DRIVEN actionnables.`
};

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        
        // Step 1: Project Manager evaluates the task
        const pmText = await callOpenRouter(PROMPTS["Project Manager"], message, true);
        
        let pmData;
        try {
            // Sometimes OpenRouter wraps json in markdown code blocks
            const cleanJson = pmText.replace(/```json/g, "").replace(/```/g, "").trim();
            pmData = JSON.parse(cleanJson);
        } catch(e) {
            console.error("Failed to parse PM response", pmText);
            return res.status(500).json({ error: "PM Router failed to format JSON" });
        }

        const { target, instruction, response } = pmData;

        // If the PM is handling it directly
        if (target === "Project Manager") {
            return res.json({
                agent: "Project Manager",
                reply: response
            });
        }

        // Step 2: Push to the correct underlying agent
        const targetPrompt = PROMPTS[target] || PROMPTS["Project Manager"];
        const agentText = await callOpenRouter(targetPrompt, instruction, false);

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
