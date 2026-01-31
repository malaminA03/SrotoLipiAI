export enum Tone {
  PROFESSIONAL = 'Professional',
  CREATIVE = 'Creative',
  CASUAL = 'Casual',
  WITTY = 'Witty',
  EMOTIONAL = 'Emotional'
}

export interface VideoScriptScene {
  sceneNumber: number;
  visualDescription: string;
  voiceoverText: string;
  duration: string;
}

export interface GeneratedContent {
  facebookPost: string;
  instagramCaption: string;
  linkedinPost: string;
  twitterPost: string;
  youtubeTitle: string;
  youtubeDescription: string;
  videoScript: VideoScriptScene[];
  summary: string; // Used for TTS generation
}

export interface ProcessingState {
  isRecording: boolean;
  isGenerating: boolean;
  isSpeaking: boolean;
}
