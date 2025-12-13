import { GoogleGenAI } from "@google/genai";
import { ChatSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_PROMPT = `Eres un experto en avicultura y análisis de calidad de huevo (Egg Quality Monitor). Tu tarea es interpretar los datos estadísticos proporcionados a continuación, responder la pregunta del usuario con claridad y utilizando un tono profesional y accesible (en español). Si es necesario, usa tus conocimientos de avicultura para contextualizar los resultados.

Instrucciones:
1. Responde a la pregunta del usuario.
2. Analiza el 'Contexto de Datos Actual' que se te proporciona para basar tu respuesta en los filtros y promedios actuales.
3. Siempre sé conciso y ve al punto.
4. Usa formato Markdown solo para negritas y listas.`;

export const sendMessageToGemini = async (
    userQuery: string, 
    dataContext: string
): Promise<{ text: string; sources: ChatSource[] }> => {
    try {
        const fullPrompt = `Basándote en el siguiente contexto de datos, responde mi pregunta.
        
        --- CONTEXTO DE DATOS ACTUAL ---
        ${dataContext}
        --- FIN CONTEXTO ---
        
        Mi pregunta es: ${userQuery}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                tools: [{ googleSearch: {} }],
            }
        });

        const text = response.text || "No pude generar una respuesta.";
        
        // Extract grounding chunks if available
        let sources: ChatSource[] = [];
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        if (groundingChunks) {
            sources = groundingChunks
                .filter(chunk => chunk.web?.uri && chunk.web?.title)
                .map(chunk => ({
                    uri: chunk.web?.uri,
                    title: chunk.web?.title
                }));
        }

        return { text, sources };

    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error("Error al comunicarse con el asistente.");
    }
};