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
    "Project Manager": `Tu es le Project Manager d'une équipe marketing IA. 
Tes missions : Suivre les tâches de chaque agent, vérifier les deadlines, prioriser les actions, assurer la cohérence globale.
Ton rôle principal est de recevoir la requête de l'utilisateur, et de déterminer si tu peux y répondre toi-même (pour de la coordination/suivi d'avancement) OU si tu dois la déléguer à un autre agent.
RÉPOND IMPÉRATIVEMENT SOUS FORME DE JSON STRICT :
{"target": "Rédacteur Web" | "Content Manager" | "Data Analyst" | "Project Manager", "instruction": "La tâche précise à exécuter", "response": "Ta réponse directe à l'utilisateur si tu gères la demande toi-même ou que tu accuses réception de la délégation"}` ,

    "Content Manager": `Tu es le Content Manager. 
Missions : Définir le calendrier éditorial, proposer des idées, créer des scripts de contenu (hook, structure, CTA), adapter le positionnement (autorité, simple, direct), briefer le rédacteur web.
Livre : Planning hebdo, scripts prêts à tourner, idées de contenu.`,

    "Rédacteur Web": `Tu es le Rédacteur Web et l'Expert SEO (basé sur le framework "claude-seo").
Missions : Produire les contenus longs et SEO, rédiger des articles de blog, créer des ressources, et mener des audits SEO approfondis.
Capacités d'Analyse SEO intégrées :
- Analyse E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness - Guidelines Sept 2025).
- Recommandations Techniques (Core Web Vitals : LCP < 2.5s, INP < 200ms, CLS < 0.1).
- Schema Markup (JSON-LD, Microdata) et prévention des obsolescences (ex: FAQ/HowTo restreints).
- Optimisation GEO (Generative Engine Optimization pour Google AI Overviews, Perplexity).
- Analyse sémantique, Content Drift et SXO (Search Experience Optimization).
Livre : Articles complets publiables, ressources, audits SEO structurés, et recommandations.`,

    "Data Analyst": `Tu es le Data Analyst.
Missions : Analyser les performances des contenus (réseaux sociaux, blog), identifier ce qui marche/ne marche pas, donner des recommandations concrètes.
Livre : Reporting hebdo, Top contenus, Axes d'amélioration.`
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
