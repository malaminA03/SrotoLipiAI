import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GeneratedContent, Tone } from "../types";

const SYSTEM_INSTRUCTION = `
You are SrotoLipi AI, an advanced Bengali content creation engine. 
Your task is to analyze the user's input (Text, Image, Video, or Audio) and generate high-quality content in BENGALI tailored for various platforms.

Adhere strictly to these rules:
1. All output MUST be in the Bengali language (except for SEO tags/hashtags which can be mixed if popular).
2. The tone must match the user's selection.
3. The output must be returned in strictly valid JSON format matching the schema provided.
4. For video scripts, provide detailed visual cues and engaging voiceovers.
5. If a specific duration is requested for the video script, ensure the scene count and word count of the voiceover matches that approximate timing.
6. **YouTube Description**: Must be VERY LONG, detailed, and comprehensive (at least 300 words), covering the topic in depth with chapters/timestamps placeholders if applicable.
7. **Facebook**: Provide a catchy, click-baity Title separate from the post body.
`;

// Direct API Key from configuration or fallback
// This ensures the key from vite.config.ts is used
const API_KEY = process.env.API_KEY;

// Helper to initialize the AI client lazily
const getAiClient = () => {
  if (!API_KEY || API_KEY === 'undefined') {
    throw new Error("API Key is missing. Please ensure 'API_KEY' is set in your .env file or environment variables.");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

export const generateContent = async (
  textInput: string,
  mediaFile: { data: string; mimeType: string } | null,
  audioInput: { data: string; mimeType: string } | null,
  tone: Tone,
  duration: string 
): Promise<GeneratedContent> => {
  
  // Initialize client here to handle errors gracefully
  const ai = getAiClient();

  // Using Gemini 3 Flash for maximum speed and low latency
  const model = "gemini-3-flash-preview";
  
  const parts: any[] = [];

  let promptText = `Generate content with a ${tone} tone.`;
  promptText += `\nTarget Video Script Duration: ${duration}`;
  
  if (textInput) promptText += `\nTopic/Context: ${textInput}`;
  
  parts.push({ text: promptText });

  // Handle Uploaded File (Image, Video, or Audio)
  if (mediaFile) {
    parts.push({
      inlineData: {
        data: mediaFile.data,
        mimeType: mediaFile.mimeType
      }
    });
    
    if (mediaFile.mimeType.startsWith('audio/')) {
      parts.push({ text: "Context: The attached media is an audio file. Listen to the speech/sound carefully and use it as the primary source material." });
    } else if (mediaFile.mimeType.startsWith('image/')) {
      parts.push({ text: "Context: Analyze this image visually." });
    } else if (mediaFile.mimeType.startsWith('video/')) {
      parts.push({ text: "Context: Analyze this video visually and audibly." });
    }
  }

  // Handle Recorded Audio
  if (audioInput) {
    parts.push({
      inlineData: {
        data: audioInput.data,
        mimeType: audioInput.mimeType
      }
    });
    parts.push({ text: "Audio Context: Please listen to this recorded audio and use it as the source material." });
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
            facebookTitle: { type: Type.STRING, description: "A catchy, attention-grabbing title for Facebook." },
            facebookPost: { type: Type.STRING, description: "Engaging Facebook post body with emojis." },
            instagramCaption: { type: Type.STRING, description: "Short, catchy caption with hashtags." },
            linkedinPost: { type: Type.STRING, description: "Professional and insightful post." },
            twitterPost: { type: Type.STRING, description: "Concise tweet under 280 chars." },
            youtubeTitle: { type: Type.STRING, description: "SEO optimized click-worthy title." },
            youtubeDescription: { type: Type.STRING, description: "A very long, detailed, and comprehensive video description (300+ words)." },
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
          required: ["facebookTitle", "facebookPost", "instagramCaption", "linkedinPost", "twitterPost", "youtubeTitle", "youtubeDescription", "videoScript", "summary"]
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
  // Initialize client here
  const ai = getAiClient();
  
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