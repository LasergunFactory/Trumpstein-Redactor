
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const detectSensitiveData = async (text: string): Promise<string[]> => {
  if (!text.trim()) return [];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify all sensitive information in the following text. 
      Sensitive information includes Names, Addresses, Phone Numbers, Email Addresses, SSNs, 
      Credit Card Numbers, or any other Personally Identifiable Information (PII).
      Return only a JSON array of strings containing the specific words or phrases to redact.
      
      Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};
