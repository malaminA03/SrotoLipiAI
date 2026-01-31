import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Image as ImageIcon, 
  Video, 
  Send, 
  Copy, 
  Play, 
  Pause, 
  Youtube, 
  Facebook, 
  Linkedin, 
  Twitter, 
  FileVideo,
  Sparkles,
  Loader2,
  Volume2,
  Check
} from 'lucide-react';
import { generateContent, generateSpeech } from './services/geminiService';
import AudioVisualizer from './components/AudioVisualizer';
import { GeneratedContent, Tone, VideoScriptScene } from './types';

// Utility to convert file to Base64
const fileToGenerativePart = async (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        data: base64Content,
        mimeType: file.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function App() {
  // State
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [tone, setTone] = useState<Tone>(Tone.CREATIVE);
  const [duration, setDuration] = useState<string>('Short (< 2 min)');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeTab, setActiveTab] = useState<'social' | 'youtube' | 'script'>('social');
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setRecordedAudio(null); // Clear audio if file selected
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      // Stop tracks to release mic
      audioStream?.getTracks().forEach(track => track.stop());
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);
        
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); // or webm
          const audioUrl = URL.createObjectURL(audioBlob);
          setRecordedAudio({ blob: audioBlob, url: audioUrl });
          setSelectedFile(null); // Clear file if audio recorded
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access denied or not available.");
      }
    }
  };

  const handleGenerate = async () => {
    if (!inputText && !selectedFile && !recordedAudio) {
      alert("Please provide some input (Text, Image, Video, or Audio).");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      let mediaData = null;
      let audioData = null;

      if (selectedFile) {
        mediaData = await fileToGenerativePart(selectedFile);
      }

      if (recordedAudio) {
         // Convert blob to base64
         const reader = new FileReader();
         const base64Audio = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(recordedAudio.blob);
         });
         audioData = {
            data: base64Audio.split(',')[1],
            mimeType: recordedAudio.blob.type || 'audio/webm' // Default fallback
         };
      }

      const generatedData = await generateContent(inputText, mediaData, audioData, tone, duration);
      setResult(generatedData);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Failed to generate content. Please check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTTS = async () => {
    if (!result?.summary) return;
    
    if (isPlayingAudio) {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
        }
        setIsPlayingAudio(false);
        return;
    }

    try {
      setIsPlayingAudio(true);
      const base64Audio = await generateSpeech(result.summary);
      
      // Decode and play
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlayingAudio(false);
      source.start(0);
      audioSourceRef.current = source;

    } catch (e) {
      console.error("TTS Playback failed", e);
      setIsPlayingAudio(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // UI Components helpers
  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-all border-b-2 ${
        activeTab === id 
          ? 'border-blue-600 text-blue-600' 
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      
      {/* Simple Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">SrotoLipi AI</h1>
              <p className="text-xs text-slate-500">Content Factory</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
             <span className="text-slate-600 bg-slate-100 px-3 py-1 rounded-full">Gemini 3 Flash</span>
             <span className="text-slate-600 bg-slate-100 px-3 py-1 rounded-full">TTS Enabled</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: INPUT ZONE */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Create New Content</h2>

            {/* Text Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Topic or Context</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ex: A promotional post for a new organic tea brand..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none h-32 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Media Upload & Mic */}
            <div className="grid grid-cols-2 gap-4 mb-6">
               {/* File Input */}
               <div className="relative">
                 <input 
                   type="file" 
                   id="file-upload" 
                   className="hidden" 
                   accept="image/*,video/*"
                   onChange={handleFileChange}
                 />
                 <label 
                   htmlFor="file-upload"
                   className={`flex flex-col items-center justify-center h-20 rounded-lg border border-dashed cursor-pointer transition-all ${
                     selectedFile 
                       ? 'border-blue-500 bg-blue-50 text-blue-700' 
                       : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 text-slate-500'
                   }`}
                 >
                   {selectedFile ? (
                      selectedFile.type.startsWith('image') ? <ImageIcon size={20} /> : <Video size={20} />
                   ) : (
                      <ImageIcon size={20} className="mb-1" />
                   )}
                   <span className="text-xs font-medium truncate max-w-[90%]">
                     {selectedFile ? selectedFile.name : 'Upload Media'}
                   </span>
                 </label>
               </div>

               {/* Mic Input */}
               <button
                 onClick={toggleRecording}
                 className={`flex flex-col items-center justify-center h-20 rounded-lg border transition-all ${
                   isRecording 
                     ? 'border-red-500 bg-red-50 text-red-600 animate-pulse' 
                     : recordedAudio 
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-500'
                 }`}
               >
                 <Mic size={20} className="mb-1" />
                 <span className="text-xs font-medium">
                   {isRecording ? 'Stop Recording' : recordedAudio ? 'Audio Saved' : 'Record Audio'}
                 </span>
               </button>
            </div>

            {/* Audio Visualizer */}
            {isRecording && (
                <div className="mb-6">
                   <AudioVisualizer stream={audioStream} isActive={isRecording} />
                </div>
            )}

            {/* Controls */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tone</label>
                <select 
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 outline-none"
                >
                  {Object.values(Tone).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Duration</label>
                <select 
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 outline-none"
                >
                  <option value="Short (< 2 min)">Short (&lt; 2 min)</option>
                  <option value="Medium (5 min)">Medium (5 min)</option>
                  <option value="Long (10 min)">Long (10 min)</option>
                  <option value="Extra Long (15 min)">Extra Long (15 min)</option>
                </select>
              </div>
            </div>

            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading ? (
                <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating...
                </>
                ) : (
                <>
                    <Sparkles size={18} />
                    Generate
                </>
                )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: OUTPUT PORTALS */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-h-[600px] flex flex-col">
            {/* Output Tabs */}
            <div className="flex border-b border-slate-200 px-2 pt-2">
                <TabButton id="social" label="Social" icon={Facebook} />
                <TabButton id="youtube" label="YouTube" icon={Youtube} />
                <TabButton id="script" label="Script" icon={FileVideo} />
            </div>

            <div className="p-6 flex-1">
                {!result ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                    <Sparkles size={24} className="text-slate-300" />
                    </div>
                    <p className="text-sm">Content will appear here</p>
                </div>
                ) : (
                <div className="animate-in fade-in duration-500 space-y-6">
                    
                    {/* TTS Player Header */}
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-full text-blue-600 shadow-sm border border-slate-100">
                                <Volume2 size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Voice Preview</p>
                                <p className="text-sm font-medium text-slate-800">Bengali Audio Summary</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleTTS}
                            className={`p-3 rounded-full transition-all ${isPlayingAudio ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                        >
                            {isPlayingAudio ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                        </button>
                    </div>

                    {/* Content Rendering */}
                    {activeTab === 'social' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SocialCard platform="Facebook" icon={Facebook} content={result.facebookPost} color="text-blue-600" onCopy={() => copyToClipboard(result.facebookPost)} />
                        <SocialCard platform="Instagram" icon={ImageIcon} content={result.instagramCaption} color="text-pink-600" onCopy={() => copyToClipboard(result.instagramCaption)} />
                        <SocialCard platform="LinkedIn" icon={Linkedin} content={result.linkedinPost} color="text-blue-700" onCopy={() => copyToClipboard(result.linkedinPost)} />
                        <SocialCard platform="X (Twitter)" icon={Twitter} content={result.twitterPost} color="text-slate-800" onCopy={() => copyToClipboard(result.twitterPost)} />
                    </div>
                    )}

                    {activeTab === 'youtube' && (
                    <div className="space-y-6">
                        <div className="group relative">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs uppercase font-bold text-slate-400">Video Title</span>
                                <button onClick={() => copyToClipboard(result.youtubeTitle)} className="text-slate-400 hover:text-blue-600 p-1"><Copy size={14}/></button>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 border border-slate-200 rounded-lg p-4 bg-slate-50">{result.youtubeTitle}</h3>
                        </div>
                        <div className="group relative">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs uppercase font-bold text-slate-400">Description</span>
                                <button onClick={() => copyToClipboard(result.youtubeDescription)} className="text-slate-400 hover:text-blue-600 p-1"><Copy size={14}/></button>
                            </div>
                            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line border border-slate-200 rounded-lg p-4 bg-slate-50">
                                {result.youtubeDescription}
                            </div>
                        </div>
                    </div>
                    )}

                    {activeTab === 'script' && (
                    <div className="space-y-4">
                        {result.videoScript.map((scene, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                                    {scene.sceneNumber}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Visual</span>
                                        <p className="text-sm text-slate-800 italic">{scene.visualDescription}</p>
                                    </div>
                                    <div className="border-t border-slate-200 pt-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Audio / Voiceover</span>
                                        <p className="text-sm text-slate-900 font-medium">"{scene.voiceoverText}"</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-end pt-2">
                            <button 
                                onClick={() => copyToClipboard(result.videoScript.map(s => `Scene ${s.sceneNumber}:\nVisual: ${s.visualDescription}\nAudio: ${s.voiceoverText}\n`).join('\n---\n'))}
                                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-md transition-colors"
                            >
                                <Copy size={14} /> Copy Full Script
                            </button>
                        </div>
                    </div>
                    )}
                </div>
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Sub-component for Social Cards
const SocialCard = ({ platform, icon: Icon, content, color, onCopy }: any) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors group relative">
            <div className="flex items-center justify-between mb-3">
            <div className={`flex items-center gap-2 ${color}`}>
                <Icon size={18} />
                <span className="font-semibold text-sm text-slate-700">{platform}</span>
            </div>
            <button onClick={handleCopy} className="text-slate-400 hover:text-blue-600 transition-colors">
                {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14} />}
            </button>
            </div>
            <div className="text-sm text-slate-600 leading-relaxed max-h-40 overflow-y-auto pr-1">
            {content}
            </div>
        </div>
    );
};

export default App;