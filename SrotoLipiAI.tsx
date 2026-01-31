import React, { useState, useRef } from 'react';
import { 
  Mic, 
  Image as ImageIcon, 
  Video, 
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
  Check,
  Zap
} from 'lucide-react';
import { generateContent, generateSpeech } from './services/geminiService';
import AudioVisualizer from './components/AudioVisualizer';
import { GeneratedContent, Tone } from './types';

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

function SrotoLipiAI() {
  // State
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [tone, setTone] = useState<Tone>(Tone.CREATIVE);
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
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); 
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

      const generatedData = await generateContent(inputText, mediaData, audioData, tone);
      setResult(generatedData);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Failed to generate content. Please check if API Key is set in .env");
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans">
      
      {/* Simple Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Zap size={20} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">SrotoLipi AI</h1>
              <p className="text-xs text-slate-500">Super Fast Content Factory</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
             <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold">Online (Cloud)</span>
             </div>
             <span className="hidden md:inline text-slate-500 text-xs">Gemini 3 Flash</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: INPUT ZONE */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
                <Sparkles size={18} className="text-blue-500" />
                Create New Content
            </h2>

            {/* Text Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Topic or Context (Bangla/English)</label>
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
                     {selectedFile ? selectedFile.name : 'Upload Image/Video'}
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
                   {isRecording ? 'Stop Recording' : recordedAudio ? 'Audio Saved' : 'Record Voice'}
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
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
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
              <div className="col-span-2 flex items-end">
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        Processing...
                    </>
                    ) : (
                    <>
                        <Zap size={18} fill="currentColor" />
                        Generate Fast
                    </>
                    )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: OUTPUT PORTALS */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-h-[600px] flex flex-col">
            {/* Output Tabs */}
            <div className="flex border-b border-slate-200 px-2 pt-2">
                <TabButton id="social" label="Social Suite" icon={Facebook} />
                <TabButton id="youtube" label="YouTube" icon={Youtube} />
                <TabButton id="script" label="Video Script" icon={FileVideo} />
            </div>

            <div className="p-6 flex-1 bg-slate-50/50">
                {!result ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <div className="w-20 h-20 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                        <Sparkles size={32} className="text-blue-300" />
                    </div>
                    <p className="text-sm font-medium">Ready to create magic</p>
                </div>
                ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    
                    {/* TTS Player Header */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleTTS}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlayingAudio ? 'bg-red-100 text-red-600' : 'bg-blue-600 text-white shadow-md hover:bg-blue-700'}`}
                            >
                                {isPlayingAudio ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                            </button>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Audio Summary</p>
                                <p className="text-sm font-medium text-slate-800">Listen to Generated Content</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">Gemini 2.5 TTS</span>
                        </div>
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
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Video Title</span>
                                <button onClick={() => copyToClipboard(result.youtubeTitle)} className="text-slate-400 hover:text-blue-600 p-1"><Copy size={14}/></button>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 border border-slate-200 rounded-xl p-5 bg-white shadow-sm">{result.youtubeTitle}</h3>
                        </div>
                        <div className="group relative">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Description</span>
                                <button onClick={() => copyToClipboard(result.youtubeDescription)} className="text-slate-400 hover:text-blue-600 p-1"><Copy size={14}/></button>
                            </div>
                            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                                {result.youtubeDescription}
                            </div>
                        </div>
                    </div>
                    )}

                    {activeTab === 'script' && (
                    <div className="space-y-4">
                        {result.videoScript.map((scene, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                                    {scene.sceneNumber}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <span className="text-xs font-bold text-blue-600 uppercase block mb-1">Visual Scene</span>
                                        <p className="text-sm text-slate-800">{scene.visualDescription}</p>
                                    </div>
                                    <div className="border-t border-slate-100 pt-3">
                                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Voiceover</span>
                                        <p className="text-sm text-slate-600 font-medium italic">"{scene.voiceoverText}"</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-end pt-2">
                            <button 
                                onClick={() => copyToClipboard(result.videoScript.map(s => `Scene ${s.sceneNumber}:\nVisual: ${s.visualDescription}\nAudio: ${s.voiceoverText}\n`).join('\n---\n'))}
                                className="text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm"
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-3">
            <div className={`flex items-center gap-2 ${color}`}>
                <Icon size={18} />
                <span className="font-semibold text-sm text-slate-700">{platform}</span>
            </div>
            <button onClick={handleCopy} className="text-slate-400 hover:text-blue-600 transition-colors">
                {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14} />}
            </button>
            </div>
            <div className="text-sm text-slate-600 leading-relaxed max-h-40 overflow-y-auto pr-1 scrollbar-thin">
            {content}
            </div>
        </div>
    );
};

export default SrotoLipiAI;