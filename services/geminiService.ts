
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const enhanceScript = async (script: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Melhore este roteiro para um teleprompter RSVP (leitura palavra por palavra). 
      Remova marcações de cena desnecessárias entre colchetes se elas não forem essenciais para a fala, 
      mas mantenha a intensidade e o tom. 
      O objetivo é uma fala impactante e fluída.
      
      Roteiro Original:
      ${script}`,
      config: {
        systemInstruction: "Você é um especialista em retórica e roteiros para vídeos curtos (Reels/TikTok/Ads). Seu objetivo é tornar o texto mais 'falável' e impactante.",
      },
    });
    return response.text || script;
  } catch (error) {
    console.error("Erro ao melhorar roteiro:", error);
    return script;
  }
};
