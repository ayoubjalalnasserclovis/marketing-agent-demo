const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Note: If 'gemini-3.1-flash' fails due to invalid model name, fallback to 'gemini-2.5-flash'
const MODEL_NAME = 'gemini-3.1-flash'; 

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PROMPTS = {
    "Project Manager": `Tu es le Project Manager d'une équipe marketing IA. 
Tes missions : Suivre les tâches de chaque agent, vérifier les deadlines, prioriser les actions, assurer la cohérence globale.
Ton rôle principal est de recevoir la requête de l'utilisateur, et de déterminer si tu peux y répondre toi-même (pour de la coordination/suivi d'avancement) OU si tu dois la déléguer à un autre agent.
RÉPOND IMPÉRATIVEMENT SOUS FORME DE JSON STRICT :
{"target": "Rédacteur Web" | "Content Manager" | "Data Analyst" | "Project Manager", "instruction": "La tâche précise à exécuter", "response": "Ta réponse directe à l'utilisateur si tu gères la demande toi-même ou que tu accuses réception de la délégation"}` ,

    "Content Manager": `Tu es le Content Manager. 
Missions : Définir le calendrier éditorial, proposer des idées, créer des scripts de contenu (hook, structure, CTA), adapter le positionnement (autorité, simple, direct), briefer le rédacteur web.
Livre : Planning hebdo, scripts prêts à tourner, idées de contenu.`,

    "Rédacteur Web": `Tu es le Rédacteur Web.
Missions : Produire les contenus longs et SEO, rédiger des articles de blog, créer des ressources (PDF, guides), structurer pour conversion, réutiliser les reels en article.
Livre : Articles complets publiables, ressources, contenus optimisés.`,

    "Data Analyst": `Tu es le Data Analyst.
Missions : Analyser les performances des contenus (réseaux sociaux, blog), identifier ce qui marche/ne marche pas, donner des recommandations concrètes.
Livre : Reporting hebdo, Top contenus, Axes d'amélioration.`
};

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        
        // Step 1: Project Manager evaluates the task
        const pmResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: message,
            config: {
                systemInstruction: PROMPTS["Project Manager"],
                responseMimeType: "application/json"
            }
        });
        
        let pmData;
        try {
            pmData = JSON.parse(pmResponse.text);
        } catch(e) {
            console.error("Failed to parse PM response", pmResponse.text);
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
        const agentResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: instruction,
            config: {
                systemInstruction: targetPrompt
            }
        });

        res.json({
            agent: target,
            pm_insight: response,
            reply: agentResponse.text
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Marketing Agent Demo running on port ${PORT}`));
