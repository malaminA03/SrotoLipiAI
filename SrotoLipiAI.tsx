import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";
import { 
  Send, 
  Sparkles, 
  Loader2, 
  Copy, 
  RefreshCw, 
  Settings2, 
  Terminal, 
  AlertTriangle,
  CheckCircle2,
  Trash2,
  StopCircle,
  Youtube
} from 'lucide-react';

// --- Types ---
type Tone = 'Professional' | 'Creative' | 'Casual';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface InitProgress {
  progress: number;
  text: string;
}

// --- Constants ---
// Using Llama-3.2-3B-Instruct for a balance of speed (browser) and Bengali reasoning capability.
const SELECTED_MODEL = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

const PROMPT_TEMPLATES = [
  { 
    label: "YouTube Script", 
    text: `একটি প্রফেশনাল ইউটিউব ভিডিও স্ক্রিপ্ট তৈরি করো।
বিষয়: [এখানে বিষয় লিখুন]

স্ট্রাকচার:
১. হুক (Hook) - দর্শকদের মনোযোগ আকর্ষণের জন্য।
২. ইন্ট্রো (Introduction)
৩. মূল কন্টেন্ট (৩-৫টি পয়েন্ট)
৪. কল টু অ্যাকশন (CTA)
৫. আউট্রো (Outro)

নির্দেশনা:
- প্রতিটি সেকশনের জন্য 'Visuals' (স্ক্রিনে যা দেখা যাবে) এবং 'Narration' (ভয়েসওভার) আলাদা করে লিখবে।
- আউটপুট ফরম্যাট: সুন্দর মার্কডাউন (Markdown)।` 
  },
  { label: "Blog Post", text: "একটি ব্লগের জন্য বিস্তারিত লেখা তৈরি করো বিষয়:" },
  { label: "Social Caption", text: "ফেসবুক বা ইনস্টাগ্রামের জন্য একটি আকর্ষণীয় ক্যাপশন লিখো:" },
  { label: "Email", text: "একটি প্রফেশনাল ইমেইল ড্রাফট করো বিষয়:" },
  { label: "Summary", text: "এই টেক্সটটি সহজ বাংলায় সারসংক্ষেপ করো:" }
];

const SrotoLipiAI: React.FC = () => {
  // --- State ---
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [initProgress, setInitProgress] = useState<InitProgress>({ progress: 0, text: '' });
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tone, setTone] = useState<Tone>('Creative');
  const [showSidebar, setShowSidebar] = useState(true);

  // Refs for auto-scrolling and aborting
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Initialization ---

  const initializeEngine = useCallback(async () => {
    try {
      setIsModelLoading(true);
      setError(null);

      const initProgressCallback = (report: { progress: number; text: string }) => {
        setInitProgress({
          progress: report.progress,
          text: report.text,
        });
      };

      const newEngine = await CreateMLCEngine(SELECTED_MODEL, {
        initProgressCallback,
        logLevel: "INFO", // Keep console clean in prod
      });

      setEngine(newEngine);
      setIsModelLoaded(true);
    } catch (err: any) {
      console.error("Failed to load model:", err);
      // Handle low memory or WebGPU support issues
      if (err.message?.includes("WebGPU")) {
        setError("আপনার ব্রাউজারে WebGPU সাপোর্ট নেই। দয়া করে Chrome বা Edge এর লেটেস্ট ভার্সন ব্যবহার করুন।");
      } else {
        setError("মডেল লোড করতে সমস্যা হয়েছে। দয়া করে পেজটি রিফ্রেশ করুন অথবা মেমরি চেক করুন।");
      }
    } finally {
      setIsModelLoading(false);
    }
  }, []);

  // --- Core Logic ---

  const getSystemPrompt = (selectedTone: Tone): string => {
    let toneInstruction = "";
    switch (selectedTone) {
      case 'Professional':
        toneInstruction = "Use formal, respectful, and sophisticated Bengali. Avoid slang. Be precise and structured.";
        break;
      case 'Creative':
        toneInstruction = "Use descriptive, engaging, and rich Bengali vocabulary. Be imaginative and storytelling-oriented. Focus on visual storytelling.";
        break;
      case 'Casual':
        toneInstruction = "Use friendly, conversational, and everyday Bengali. You can use common idioms but keep it polite.";
        break;
    }

    return `You are SrotoLipi AI, an expert content creator and scriptwriter. 
    IMPORTANT: You must ALWAYS answer in the BENGALI language. 
    Do not answer in English unless explicitly asked to translate.
    ${toneInstruction}
    When asked for scripts, ensure you provide detailed visual instructions and natural narration.`;
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if ((!textToSend.trim()) || !engine || isGenerating) return;

    // Reset abort controller
    abortControllerRef.current = new AbortController();

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: textToSend }
    ];

    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);
    setError(null);

    // Provide context window (last 5 messages + system prompt)
    const contextMessages: Message[] = [
      { role: 'system', content: getSystemPrompt(tone) },
      ...newMessages.slice(-5) // Simple context window management
    ];

    try {
      const chunks = await engine.chat.completions.create({
        messages: contextMessages,
        stream: true,
        temperature: tone === 'Creative' ? 0.7 : 0.5,
        max_tokens: 4000, // Increased for long scripts
      });

      // Add placeholder for assistant response
      let fullResponse = "";
      setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

      for await (const chunk of chunks) {
        // Check for abort
        if (abortControllerRef.current?.signal.aborted) {
            break;
        }

        const delta = chunk.choices[0]?.delta?.content || "";
        fullResponse += delta;
        
        // Update the last message with new token
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
          return updated;
        });
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      setError("AI উত্তর তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    if (messages.length === 0) return;
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
        // Remove last assistant message if it exists
        const cleanMessages = messages.length > 0 && messages[messages.length - 1].role === 'assistant' 
            ? messages.slice(0, -1) 
            : messages;
        setMessages(cleanMessages); 
        handleSend(lastUserMessage.content); 
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // --- Effects ---

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // --- UI Components ---

  const LoadingScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
        <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center relative z-10 border border-slate-100">
          <Loader2 size={40} className="text-blue-600 animate-spin" />
        </div>
      </div>
      <div className="max-w-md w-full space-y-2">
        <h2 className="text-xl font-bold text-slate-800">AI ইঞ্জিন লোড হচ্ছে...</h2>
        <p className="text-sm text-slate-500">এটি আপনার ব্রাউজারে সম্পূর্ণ লোকালভাবে চলবে। প্রথমবার লোড হতে একটু সময় লাগতে পারে (1.7GB)।</p>
        
        <div className="w-full bg-slate-200 rounded-full h-2.5 mt-4 overflow-hidden">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${initProgress.progress * 100}%` }}
          ></div>
        </div>
        <p className="text-xs text-slate-400 font-mono pt-2">{initProgress.text}</p>
      </div>
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
           <AlertTriangle size={16} /> {error}
        </div>
      )}
    </div>
  );

  const IntroScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6 opacity-80">
       <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg text-white mb-4">
          <Sparkles size={32} />
       </div>
       <h1 className="text-2xl font-bold text-slate-800">SrotoLipi AI - লোকাল ইঞ্জিন</h1>
       <p className="max-w-lg text-slate-500 leading-relaxed">
          আপনার ব্যক্তিগত কন্টেন্ট অ্যাসিস্ট্যান্ট। কোনো সার্ভার নেই, কোনো ডেটা লিক নেই। 
          সম্পূর্ণ অফলাইন-রেডি AI যা আপনার ব্রাউজারে চলে।
       </p>
       <button 
          onClick={initializeEngine}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2"
       >
          <Terminal size={18} />
          ইঞ্জিন স্টার্ট করুন
       </button>
       <p className="text-xs text-slate-400 mt-8">Powered by WebLLM & Llama 3.2</p>
    </div>
  );

  // --- Render ---

  if (!isModelLoaded && !isModelLoading) {
     return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
           <IntroScreen />
        </div>
     );
  }

  if (isModelLoading) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <LoadingScreen />
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar Controls */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col overflow-hidden shadow-xl z-20`}>
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Sparkles size={16} /></div>
            <span className="font-bold text-slate-800">SrotoLipi AI</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-8">
            {/* Tone Selector */}
            <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block flex items-center gap-1">
                    <Settings2 size={12} /> Tone Control
                </label>
                <div className="space-y-2">
                    {(['Professional', 'Creative', 'Casual'] as Tone[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTone(t)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium flex items-center justify-between ${
                                tone === t 
                                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            {t}
                            {tone === t && <CheckCircle2 size={16} />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Templates */}
            <div>
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Quick Prompts</label>
                 <div className="grid grid-cols-1 gap-2">
                    {PROMPT_TEMPLATES.map((tpl, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setInput(tpl.text);
                                textareaRef.current?.focus();
                            }}
                            className="text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs border border-slate-200 transition-colors flex items-center gap-2"
                        >
                            {tpl.label === "YouTube Script" && <Youtube size={14} className="text-red-500" />}
                            {tpl.label}
                        </button>
                    ))}
                 </div>
            </div>

            {/* Status */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-700">System Ready</span>
                </div>
                <p className="text-[10px] text-slate-400">Model: Llama 3.2 3B Quantized</p>
                <p className="text-[10px] text-slate-400">Memory: Browser/WebGPU</p>
            </div>
        </div>

        <div className="p-4 border-t border-slate-100">
            <button 
                onClick={clearChat}
                className="w-full py-2 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
            >
                <Trash2 size={16} /> Clear Conversation
            </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-10">
            <button 
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
            >
                <Settings2 size={20} />
            </button>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
                 <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                 <span className="text-xs font-medium text-slate-600">{tone} Mode</span>
            </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                    <Terminal size={48} className="mb-4" />
                    <p>Start a conversation to generate content</p>
                </div>
            ) : (
                messages.map((msg, idx) => (
                    <div 
                        key={idx} 
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div 
                            className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 md:p-5 shadow-sm relative group leading-relaxed text-sm md:text-base ${
                                msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                            }`}
                        >
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                            
                            {/* Actions for assistant messages */}
                            {msg.role === 'assistant' && !isGenerating && (
                                <div className="absolute -bottom-8 left-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => copyToClipboard(msg.content)}
                                        className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600"
                                        title="Copy"
                                    >
                                        <Copy size={14} />
                                    </button>
                                    {idx === messages.length - 1 && (
                                        <button 
                                            onClick={handleRegenerate}
                                            className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600"
                                            title="Regenerate"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
            
            {/* Loading/Thinking Indicator */}
            {isGenerating && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin text-blue-500" />
                        <span className="text-xs text-slate-500">SrotoLipi is typing...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
            <div className="max-w-4xl mx-auto relative">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="বাংলায় কিছু লিখুন... (Ctrl+Enter to send)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none max-h-32 min-h-[56px] shadow-inner text-slate-800"
                    rows={1}
                />
                
                <div className="absolute right-2 bottom-2">
                    {isGenerating ? (
                        <button 
                            onClick={stopGeneration}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow transition-all"
                        >
                            <StopCircle size={20} />
                        </button>
                    ) : (
                        <button 
                            onClick={() => handleSend()}
                            disabled={!input.trim()}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={20} />
                        </button>
                    )}
                </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">
                SrotoLipi AI can make mistakes. Verify important information. | WebLLM Core
            </p>
        </div>
      </div>
    </div>
  );
};

export default SrotoLipiAI;