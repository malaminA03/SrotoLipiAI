export enum Tone {
  PROFESSIONAL = 'Professional',
  CREATIVE = 'Creative',
  CASUAL = 'Casual',
  WITTY = 'Witty',
  EMOTIONAL = 'Emotional',
  HORROR = 'Horror',
  THRILLER = 'Thriller',
  MYSTERY = 'Mystery',
  SCI_FI = 'Sci-Fi',
  DRAMATIC = 'Dramatic',
  CINEMATIC = 'Cinematic'
}

export interface VideoScriptScene {
  sceneNumber: number;
  visualDescription: string;
  voiceoverText: string;
  duration: string;
}

export interface GeneratedContent {
  facebookTitle: string; // Added Title
  facebookPost: string;
  instagramCaption: string;
  linkedinPost: string;
  twitterPost: string;
  youtubeTitle: string;
  youtubeDescription: string;
  videoScript: VideoScriptScene[];
  summary: string; // Used for TTS generation
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  preview: string; // Short text or "Media Input"
  tone: Tone;
  data: GeneratedContent;
}

export interface ProcessingState {
  isRecording: boolean;
  isGenerating: boolean;
  isSpeaking: boolean;
}