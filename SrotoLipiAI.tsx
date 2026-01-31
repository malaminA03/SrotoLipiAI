import React, { useState, useRef, useEffect } from 'react';
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
  Zap,
  History,
  Clock,
  Trash2,
  X,
  RotateCcw,
  RefreshCw,
  Music,
  UploadCloud,
  ChevronRight,
  ShieldAlert,
  Copyright,
  Check,
  Download
} from 'lucide-react';
import { generateContent, generateSpeech } from './services/geminiService';
import AudioVisualizer from './components/AudioVisualizer';
import { GeneratedContent, Tone, HistoryItem } from './types';

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
  
  // Generation Settings
  const [tone, setTone] = useState<Tone>(Tone.CREATIVE);
  const [duration, setDuration] = useState<string>('Short (< 2 min)');
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioDownloadUrl, setAudioDownloadUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'social' | 'youtube' | 'script'>('social');
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('srotolipi_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Mobile drawer state
  const [showMobileHistory, setShowMobileHistory] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Effects
  useEffect(() => {
    localStorage.setItem('srotolipi_history', JSON.stringify(history));
  }, [history]);

  // Clean up audio URL on unmount or new result
  useEffect(() => {
    return () => {
      if (audioDownloadUrl) URL.revokeObjectURL(audioDownloadUrl);
    };
  }, [audioDownloadUrl]);

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
    setAudioDownloadUrl(null); // Reset previous download

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

      // Add to History
      const historyPreview = inputText.slice(0, 60) + (inputText.length > 60 ? '...' : '') || 
                             (selectedFile ? `File: ${selectedFile.name}` : 'Audio Recording');
      
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        preview: historyPreview,
        tone: tone,
        data: generatedData
      };

      setHistory(prev => [newHistoryItem, ...prev]);

    } catch (error) {
      console.error("Generation failed:", error);
      alert("Failed to generate content. Please check if API Key is set correctly.");
    } finally {
      setIsLoading(false);
    }
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    setResult(item.data);
    setTone(item.tone);
    setAudioDownloadUrl(null);
    if(window.innerWidth < 1024) setShowMobileHistory(false);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if(confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
    }
  };

  const handleTTS = async () => {
    if (!result?.summary) return;
    
    // Stop playback if currently playing
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
      
      // Decode Base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create Blob for Download if not already created
      if (!audioDownloadUrl) {
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          const url = URL.createObjectURL(blob);
          setAudioDownloadUrl(url);
      }

      // Setup Audio Context for Playback
      if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume context if suspended (browser policy)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Decode audio data for playback
      // We copy the buffer because decodeAudioData detaches the buffer
      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer.slice(0));
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => setIsPlayingAudio(false);
      source.start(0);
      audioSourceRef.current = source;

    } catch (e) {
      console.error("TTS Playback failed", e);
      setIsPlayingAudio(false);
      alert("Failed to play audio. Please try again.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // --- UI COMPONENTS ---

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all rounded-t-lg relative ${
        activeTab === id 
          ? 'text-blue-600 bg-white border-t-2 border-blue-600 shadow-sm' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );

  // Determine Icon for Uploaded File
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon size={24} className="text-purple-500" />;
    if (file.type.startsWith('video/')) return <Video size={24} className="text-pink-500" />;
    if (file.type.startsWith('audio/')) return <Music size={24} className="text-amber-500" />;
    return <UploadCloud size={24} className="text-blue-500" />;
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="w-80 bg-white border-r border-slate-200 hidden lg:flex flex-col z-20 shadow-xl">
        {/* Brand */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <Zap size={24} fill="currentColor" className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SrotoLipi AI</h1>
              <p className="text-xs text-blue-100 opacity-90">Content Factory Pro</p>
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <History size={14} /> Recent Projects
            </h2>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear All</button>
            )}
          </div>
          
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Clock size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No recent history</p>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => restoreHistoryItem(item)}
                  className="bg-slate-50 hover:bg-white border border-transparent hover:border-blue-200 p-3 rounded-lg cursor-pointer transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{item.tone}</span>
                    <button onClick={(e) => deleteHistoryItem(item.id, e)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <h3 className="text-xs font-medium text-slate-700 line-clamp-2 mb-2">{item.preview}</h3>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
           <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              System Online • v2.1.0
           </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Mobile Header (Only visible on small screens) */}
        <div className="lg:hidden bg-white p-4 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Zap className="text-blue-600" size={20} />
                <span className="font-bold text-slate-800">SrotoLipi AI</span>
            </div>
            <button onClick={() => setShowMobileHistory(true)} className="p-2 bg-slate-100 rounded-full">
                <History size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
           <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              
              {/* --- LEFT COLUMN: INPUT STUDIO --- */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                 
                 {/* Input Card */}
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={20} className="text-blue-600" />
                        <h2 className="text-lg font-bold text-slate-800">Content Studio</h2>
                    </div>

                    {/* Text Input */}
                    <div className="relative">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Describe your content idea here..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none h-40 text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                        />
                        <div className="absolute bottom-3 right-3 text-xs text-slate-400 font-medium">
                            {inputText.length} chars
                        </div>
                    </div>

                    {/* Media Dropzone Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* File Upload */}
                        <div className="relative group">
                            <input 
                                type="file" 
                                id="file-upload" 
                                className="hidden" 
                                accept="image/*,video/*,audio/*"
                                onChange={handleFileChange}
                            />
                            <label 
                                htmlFor="file-upload"
                                className={`flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                                    selectedFile 
                                    ? 'border-blue-500 bg-blue-50/50' 
                                    : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                                }`}
                            >
                                {selectedFile ? (
                                    <div className="flex flex-col items-center text-center px-2">
                                        {getFileIcon(selectedFile)}
                                        <span className="text-xs font-semibold text-slate-700 mt-2 truncate max-w-full">{selectedFile.name}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                        <UploadCloud size={24} className="mb-2" />
                                        <span className="text-xs font-semibold">Upload Media</span>
                                        <span className="text-[10px] opacity-70">Audio • Video • Image</span>
                                    </div>
                                )}
                            </label>
                            {selectedFile && (
                                <button 
                                    onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                                    className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full p-1 shadow border border-slate-200 hover:bg-red-50"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Mic Recording */}
                        <button
                            onClick={toggleRecording}
                            className={`flex flex-col items-center justify-center h-24 rounded-xl border-2 transition-all ${
                                isRecording 
                                ? 'border-red-500 bg-red-50 animate-pulse' 
                                : recordedAudio 
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <div className={`p-2 rounded-full mb-1 ${isRecording ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Mic size={20} />
                            </div>
                            <span className={`text-xs font-semibold ${isRecording ? 'text-red-600' : 'text-slate-500'}`}>
                                {isRecording ? 'Recording...' : recordedAudio ? 'Audio Recorded' : 'Record Voice'}
                            </span>
                        </button>
                    </div>

                    {/* Audio Visualizer */}
                    {isRecording && (
                        <div className="h-16 bg-slate-900 rounded-lg overflow-hidden relative">
                             <AudioVisualizer stream={audioStream} isActive={isRecording} />
                        </div>
                    )}

                    {/* Settings Row */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Style & Tone</label>
                            <select 
                                value={tone}
                                onChange={(e) => setTone(e.target.value as Tone)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 outline-none"
                            >
                                {Object.values(Tone).map((t) => (
                                <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Duration</label>
                            <select 
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 outline-none"
                            >
                                <option value="Short (< 2 min)">Short (&lt; 2 min)</option>
                                <option value="Medium (5 min)">Medium (5 min)</option>
                                <option value="Long (10 min)">Long (10 min)</option>
                                <option value="Extra Long (15 min)">Extra Long (15 min)</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span className="text-sm">Generating Content...</span>
                            </>
                        ) : (
                            <>
                                <Zap size={20} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                                <span className="text-sm">Generate Magic</span>
                            </>
                        )}
                    </button>
                 </div>

                 {/* Disclaimer */}
                 <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex gap-3">
                    <ShieldAlert size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-yellow-800 leading-relaxed">
                        <strong className="block mb-1">Disclaimer</strong>
                        AI generated content may contain inaccuracies. Please review and verify all information before publishing. SrotoLipi AI is an assistance tool.
                    </div>
                 </div>

                 <div className="text-center mt-auto pb-4 text-xs text-slate-400 flex items-center justify-center gap-1">
                    <Copyright size={10} /> 2026 SrotoLipi AI. All Rights Reserved.
                 </div>
              </div>

              {/* --- RIGHT COLUMN: OUTPUT DECK --- */}
              <div className="lg:col-span-7 flex flex-col h-full min-h-[600px]">
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    
                    {/* Header & Tabs */}
                    <div className="bg-slate-50 border-b border-slate-200 px-4 pt-4 flex items-center justify-between">
                        <div className="flex space-x-1">
                            <TabButton id="social" label="Social" icon={Facebook} />
                            <TabButton id="youtube" label="YouTube" icon={Youtube} />
                            <TabButton id="script" label="Script" icon={FileVideo} />
                        </div>
                        
                        {result && !isLoading && (
                            <button 
                                onClick={handleGenerate}
                                className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                            >
                                <RefreshCw size={14} />
                                Regenerate
                            </button>
                        )}
                    </div>

                    {/* Content Viewer */}
                    <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 custom-scrollbar">
                        {!result ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                {isLoading ? (
                                    <div className="text-center">
                                        <div className="relative w-20 h-20 mx-auto mb-4">
                                            <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                                            <Sparkles className="absolute inset-0 m-auto text-blue-600 animate-pulse" size={24} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-700 mb-1">Creating Masterpiece</h3>
                                        <p className="text-sm">Analyzing input & crafting content...</p>
                                    </div>
                                ) : (
                                    <div className="text-center opacity-60">
                                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
                                            <Sparkles size={40} className="text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-600">Preview Deck</h3>
                                        <p className="text-sm max-w-xs mx-auto mt-2">Generated content will appear here instantly ready for publishing.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                
                                {/* Audio Player */}
                                {result.summary && (
                                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-4 text-white shadow-lg flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={handleTTS}
                                                className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-400 flex items-center justify-center shadow-md transition-all active:scale-95"
                                            >
                                                {isPlayingAudio ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                                            </button>
                                            
                                            {audioDownloadUrl && (
                                                <a 
                                                    href={audioDownloadUrl} 
                                                    download={`SrotoLipi-Audio-${Date.now()}.mp3`}
                                                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shadow-md transition-all active:scale-95"
                                                    title="Download Audio"
                                                >
                                                    <Download size={20} className="text-white" />
                                                </a>
                                            )}

                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Audio Summary</div>
                                                <div className="text-sm font-medium">Listen to AI overview</div>
                                            </div>
                                        </div>
                                        <div className="hidden sm:block">
                                            <AudioVisualizer stream={null} isActive={isPlayingAudio} /> 
                                            {/* Note: Visualizer here acts as a dummy active indicator if stream is null, or can be improved later */}
                                            <div className="flex gap-1 h-4 items-end">
                                                {[...Array(5)].map((_, i) => (
                                                    <div key={i} className={`w-1 bg-blue-500 rounded-full transition-all duration-300 ${isPlayingAudio ? 'animate-bounce' : 'h-1'}`} style={{height: isPlayingAudio ? `${Math.random() * 10 + 4}px` : '4px', animationDelay: `${i*0.1}s`}}></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Social Tab Content */}
                                {activeTab === 'social' && (
                                    <div className="grid grid-cols-1 gap-6">
                                        {/* Facebook with Title */}
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                            <div className="bg-[#1877F2] text-white px-4 py-2 flex justify-between items-center">
                                                <div className="flex items-center gap-2 font-bold text-sm"><Facebook size={16}/> Facebook</div>
                                                <button onClick={() => copyToClipboard(result.facebookTitle + "\n\n" + result.facebookPost)} className="text-white/80 hover:text-white"><Copy size={14}/></button>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2">
                                                    {result.facebookTitle}
                                                </div>
                                                <div className="text-slate-600 text-sm whitespace-pre-line leading-relaxed">
                                                    {result.facebookPost}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <SocialCard platform="Instagram" icon={ImageIcon} content={result.instagramCaption} color="text-pink-600" bgColor="bg-pink-50" borderColor="border-pink-100" onCopy={() => copyToClipboard(result.instagramCaption)} />
                                            <SocialCard platform="LinkedIn" icon={Linkedin} content={result.linkedinPost} color="text-blue-700" bgColor="bg-blue-50" borderColor="border-blue-100" onCopy={() => copyToClipboard(result.linkedinPost)} />
                                            <SocialCard platform="X (Twitter)" icon={Twitter} content={result.twitterPost} color="text-slate-900" bgColor="bg-slate-100" borderColor="border-slate-200" onCopy={() => copyToClipboard(result.twitterPost)} />
                                        </div>
                                    </div>
                                )}

                                {/* YouTube Tab Content */}
                                {activeTab === 'youtube' && (
                                    <div className="space-y-6">
                                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-xs font-bold text-red-600 uppercase tracking-wider bg-red-50 px-2 py-1 rounded">Video Title</span>
                                                <button onClick={() => copyToClipboard(result.youtubeTitle)} className="text-slate-400 hover:text-blue-600"><Copy size={16}/></button>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 leading-snug">{result.youtubeTitle}</h3>
                                        </div>

                                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video Description</span>
                                                <div className="flex gap-2">
                                                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">{result.youtubeDescription.split(' ').length} words</span>
                                                    <button onClick={() => copyToClipboard(result.youtubeDescription)} className="text-slate-400 hover:text-blue-600"><Copy size={16}/></button>
                                                </div>
                                            </div>
                                            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {result.youtubeDescription}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Script Tab Content */}
                                {activeTab === 'script' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between text-sm text-slate-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100 mb-4">
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} className="text-yellow-600"/> 
                                                <span className="font-semibold">Target Duration: {duration}</span>
                                            </div>
                                            <button 
                                                onClick={() => copyToClipboard(result.videoScript.map(s => `Scene ${s.sceneNumber}:\nVisual: ${s.visualDescription}\nAudio: ${s.voiceoverText}\n`).join('\n---\n'))}
                                                className="text-xs font-bold text-yellow-700 hover:text-yellow-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded-md shadow-sm border border-yellow-200"
                                            >
                                                <Copy size={12} /> Copy Full Script
                                            </button>
                                        </div>

                                        {result.videoScript.map((scene, idx) => (
                                            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6 flex gap-6 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-lg shadow-slate-900/20">
                                                    {scene.sceneNumber}
                                                </div>
                                                <div className="flex-1 space-y-4">
                                                    <div>
                                                        <span className="text-xs font-bold text-blue-600 uppercase block mb-1 flex items-center gap-1">
                                                            <Video size={12} /> Visual Scene ({scene.duration})
                                                        </span>
                                                        <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{scene.visualDescription}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-green-600 uppercase block mb-1 flex items-center gap-1">
                                                            <Mic size={12} /> Voiceover
                                                        </span>
                                                        <p className="text-slate-700 font-medium italic pl-4 border-l-4 border-green-200 py-1">"{scene.voiceoverText}"</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </main>

      {/* --- MOBILE HISTORY DRAWER --- */}
      {showMobileHistory && (
        <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileHistory(false)} />
            <div className="absolute top-0 right-0 w-3/4 max-w-sm h-full bg-white shadow-2xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold">Project History</h2>
                    <button onClick={() => setShowMobileHistory(false)}><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                    {history.map(item => (
                        <div key={item.id} onClick={() => restoreHistoryItem(item)} className="p-4 bg-slate-50 rounded-lg border border-slate-200 active:bg-blue-50">
                            <div className="text-xs font-bold text-blue-600 mb-1">{item.tone}</div>
                            <div className="text-sm font-medium line-clamp-2">{item.preview}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

// Sub-component for Social Cards
const SocialCard = ({ platform, icon: Icon, content, color, bgColor, borderColor, onCopy }: any) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`bg-white border ${borderColor || 'border-slate-200'} rounded-xl p-5 hover:shadow-md transition-all group relative h-full flex flex-col`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`flex items-center gap-2 ${color} ${bgColor} px-2 py-1 rounded-lg`}>
                    <Icon size={16} />
                    <span className="font-bold text-xs">{platform}</span>
                </div>
                <button onClick={handleCopy} className="text-slate-400 hover:text-blue-600 transition-colors">
                    {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16} />}
                </button>
            </div>
            <div className="text-sm text-slate-600 leading-relaxed overflow-y-auto pr-1 custom-scrollbar flex-1 max-h-48">
                {content}
            </div>
        </div>
    );
};

export default SrotoLipiAI;