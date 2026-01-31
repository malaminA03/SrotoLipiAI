import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GeneratedContent, Tone } from "../types";

// Initialize client with the API Key from environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are SrotoLipi AI, an advanced Bengali content creation engine. 
Your task is to analyze the user's input (Text, Image, Video, or Audio) and generate high-quality content in BENGALI tailored for various platforms.

Adhere strictly to these rules:
1. All output MUST be in the Bengali language (except for SEO tags/hashtags which can be mixed if popular).
2. The tone must match the user's selection.
3. The output must be returned in strictly valid JSON format matching the schema provided.
4. For video scripts, provide detailed visual cues and engaging voiceovers.
`;

export const generateContent = async (
  textInput: string,
  mediaFile: { data: string; mimeType: string } | null,
  audioInput: { data: string; mimeType: string } | null,
  tone: Tone
): Promise<GeneratedContent> => {
  
  // Using Gemini 3 Flash for maximum speed and low latency
  const model = "gemini-3-flash-preview";
  
  const parts: any[] = [];

  let promptText = `Generate content with a ${tone} tone.`;
  if (textInput) promptText += `\nTopic/Context: ${textInput}`;
  
  parts.push({ text: promptText });

  if (mediaFile) {
    parts.push({
      inlineData: {
        data: mediaFile.data,
        mimeType: mediaFile.mimeType
      }
    });
  }

  if (audioInput) {
    parts.push({
      inlineData: {
        data: audioInput.data,
        mimeType: audioInput.mimeType
      }
    });
    parts.push({ text: "Audio Context: Please listen to this audio and use it as the source material." });
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            facebookPost: { type: Type.STRING, description: "Engaging Facebook post with emojis." },
            instagramCaption: { type: Type.STRING, description: "Short, catchy caption with hashtags." },
            linkedinPost: { type: Type.STRING, description: "Professional and insightful post." },
            twitterPost: { type: Type.STRING, description: "Concise tweet under 280 chars." },
            youtubeTitle: { type: Type.STRING, description: "SEO optimized click-worthy title." },
            youtubeDescription: { type: Type.STRING, description: "Detailed video description." },
            summary: { type: Type.STRING, description: "A brief summary of the content for audio reading." },
            videoScript: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  visualDescription: { type: Type.STRING },
                  voiceoverText: { type: Type.STRING },
                  duration: { type: Type.STRING }
                }
              }
            }
          },
          required: ["facebookPost", "instagramCaption", "linkedinPost", "twitterPost", "youtubeTitle", "youtubeDescription", "videoScript", "summary"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from Gemini.");
    
    return JSON.parse(jsonText) as GeneratedContent;

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  // Using Gemini 2.5 Flash for fast TTS
  const model = "gemini-2.5-flash-preview-tts";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }
          }
        }
      }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("Failed to generate speech.");

    return audioData;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    throw error;
  }
};