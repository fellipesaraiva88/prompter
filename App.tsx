
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppMode, TeleprompterConfig, Script } from './types';
import RSVPDisplay from './components/RSVPDisplay';
import { enhanceScript } from './services/geminiService';

const STORAGE_KEY = 'focus_prompter_scripts';
const DEFAULT_SCRIPT = `Roteiro: A "Pizza Platinada" da Inteligência Artificial
Jamais.
Eu jamais pensaria em abrir uma "Agência de IA" hoje.
Nem que o algoritmo fosse platinado, dourado, ou fizesse café.
Sabe por quê?
Porque isso virou a "pizzaria" da nossa geração.
Todo mundo acha que vai ficar rico revendendo ChatGPT.
Isso é cultura de rebanho.
Eu não entro em negócio para brigar com a Amazon, com o Google ou com o "sobrinho" que faz mais barato.
Isso é suicídio de margem.
Minha regra é clara e matemática:
Eu só mexo em projetos que estão nos 20% de mais baixo custo...
Ou que me deixam 90% de margem.
Se a IA não me der essa margem, ela é lixo. É distração.
O problema de vocês é que vocês querem a ferramenta, mas não têm o Domínio.
Ontem eu lembrei do Lázaro do Carmo falando... e serve pra IA:
"Eu só invisto no que eu entendo."
Se você não sabe como o negócio funciona na unha, a IA só vai automatizar a sua incompetência.
Você não tem que "saber IA".
Você tem que ter capacidade de execução e domínio do mercado.
O resto é fumaça.
E cuidado para não virar um robô e esquecer o que o Silvio Santos ensinou sobre respeito.
O algoritmo não tem lealdade.
Na hora que o bicho pega, quem te salva é a mão estendida de quem você respeitou, e não o código que você copiou.
Quer usar IA? Ótimo.
Mas use para ter margem, não para ser mais uma pizzaria dourada na esquina da internet.`;

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.EDITOR);
  const [script, setScript] = useState<string>(DEFAULT_SCRIPT);
  const [savedScripts, setSavedScripts] = useState<Script[]>([]);
  const [config, setConfig] = useState<TeleprompterConfig>({
    wpm: 250,
    fontSize: 120,
    showOrp: true,
    theme: 'dark'
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Recording states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // We use a ref for the current word to access it inside the animation loop without stale closures
  const currentWordRef = useRef<string>("");

  const words = useMemo(() => {
    return script.split(/[\s\n]+/).filter(w => w.trim().length > 0);
  }, [script]);

  // Sync ref with state
  useEffect(() => {
    if (currentIndex < words.length) {
      currentWordRef.current = words[currentIndex];
    } else {
      currentWordRef.current = "";
    }
  }, [currentIndex, words]);

  // Load scripts
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedScripts(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse scripts", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedScripts));
  }, [savedScripts]);

  const timerRef = useRef<number | null>(null);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  const adjustSpeed = useCallback((delta: number) => {
    setConfig(prev => ({
      ...prev,
      wpm: Math.min(1000, Math.max(50, prev.wpm + delta))
    }));
  }, []);

  // --- Canvas Drawing Logic ---
  const drawCanvasFrame = () => {
    const canvas = canvasRef.current;
    const video = videoPreviewRef.current;
    const ctx = canvas?.getContext('2d');

    if (canvas && video && ctx && isCameraActive) {
      // 1. Draw Video Frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 2. Draw RSVP Text Overlay if playing or has a word
      const word = currentWordRef.current;
      if (word && isPlaying) {
        // Calculate dynamic scale
        // We compare the actual video width (e.g. 1920) with the user's viewport width (e.g. 400 or 1400)
        // This ensures the font size in the video feels proportionally similar to what the user sees on screen
        const screenWidth = window.innerWidth;
        const videoWidth = canvas.width;
        const scaleRatio = videoWidth / screenWidth;

        // Apply scale to the configured font size
        const drawFontSize = config.fontSize * scaleRatio;
        
        // Overlay Background Strip
        const centerY = canvas.height / 2;
        const stripHeight = drawFontSize * 1.5;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, centerY - (stripHeight / 2), canvas.width, stripHeight);

        // Font Setup
        ctx.font = `bold ${drawFontSize}px "Inter", sans-serif`;
        ctx.textBaseline = 'middle';

        // ORP Calculation (Center the focus letter)
        let orpIndex = 0;
        if (word.length > 1) {
          orpIndex = Math.floor((word.length - 1) / 2);
          if (word.length > 5) orpIndex = 2;
          if (word.length > 9) orpIndex = 3;
        }

        const before = word.substring(0, orpIndex);
        const focus = word.substring(orpIndex, orpIndex + 1);
        const after = word.substring(orpIndex + 1);

        const widthBefore = ctx.measureText(before).width;
        const widthFocus = ctx.measureText(focus).width;
        
        // Calculate X start position so 'focus' is exactly in center
        const startX = (canvas.width / 2) - widthBefore - (widthFocus / 2);

        // Draw Before (White)
        ctx.fillStyle = '#ffffff';
        ctx.fillText(before, startX, centerY);

        // Draw Focus (Red)
        ctx.fillStyle = '#ff3e3e';
        ctx.fillText(focus, startX + widthBefore, centerY);

        // Draw After (White)
        ctx.fillStyle = '#ffffff';
        ctx.fillText(after, startX + widthBefore + widthFocus, centerY);
      }

      animationFrameRef.current = requestAnimationFrame(drawCanvasFrame);
    }
  };

  // --- Camera Management ---
  const startCamera = async () => {
    try {
      // High resolution preference: Target 1080p (1920x1080) instead of 720p
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, 
        audio: true 
      });
      streamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        // Wait for video to load metadata to set canvas size
        videoPreviewRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoPreviewRef.current) {
            canvasRef.current.width = videoPreviewRef.current.videoWidth;
            canvasRef.current.height = videoPreviewRef.current.videoHeight;
            // Start the draw loop immediately so preview is visible on canvas if we were to show it
            // But we mainly use it for recording
            if (!animationFrameRef.current) {
               drawCanvasFrame();
            }
          }
        };
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      alert("Não foi possível acessar a câmera ou o microfone.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsCameraActive(false);
    setIsRecording(false);
  };

  // --- Recording Logic (Now uses Canvas Stream) ---
  const startRecording = () => {
    if (!streamRef.current || !canvasRef.current) return;
    
    // Ensure drawing loop is active
    if (!animationFrameRef.current) drawCanvasFrame();

    chunksRef.current = [];
    
    // Capture stream from Canvas (Video)
    const canvasStream = canvasRef.current.captureStream(30); // 30 FPS
    
    // Get Audio from original stream
    const audioTrack = streamRef.current.getAudioTracks()[0];
    
    // Combine
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(audioTrack ? [audioTrack] : [])
    ]);

    // Check for best available mime type
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

    const recorder = new MediaRecorder(combinedStream, { 
      mimeType: selectedMimeType,
      videoBitsPerSecond: 8000000 // 8 Mbps for high quality recording
    });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `focus-prompter-legenda-${Date.now()}.webm`;
      a.click();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    
    if (!isPlaying) setIsPlaying(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- Other Handlers ---
  const handleEnhance = async () => {
    setIsEnhancing(true);
    const newScript = await enhanceScript(script);
    setScript(newScript);
    setIsEnhancing(false);
  };

  const handleSaveScript = () => {
    const title = window.prompt("Dê um título para este roteiro:", "Novo Roteiro");
    if (!title) return;
    const newScript: Script = { title, content: script, lastUpdated: Date.now() };
    setSavedScripts(prev => {
      const filtered = prev.filter(s => s.title !== title);
      return [newScript, ...filtered];
    });
  };

  const handleLoadScript = (s: Script) => {
    if (script !== DEFAULT_SCRIPT && script !== s.content) {
      if (!window.confirm("Isso substituirá o texto atual. Continuar?")) return;
    }
    setScript(s.content);
    setCurrentIndex(0);
  };

  const handleDeleteScript = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Excluir o roteiro "${title}"?`)) {
      setSavedScripts(prev => prev.filter(s => s.title !== title));
    }
  };

  // Timing Logic
  useEffect(() => {
    if (isPlaying && currentIndex < words.length) {
      const msPerWord = (60 / config.wpm) * 1000;
      let delayFactor = 1;
      const currentWord = words[currentIndex];
      if (currentWord.endsWith('.') || currentWord.endsWith('!') || currentWord.endsWith('?')) delayFactor = 2;
      else if (currentWord.endsWith(',')) delayFactor = 1.5;

      timerRef.current = window.setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, msPerWord * delayFactor);
    } else if (currentIndex >= words.length) {
      setIsPlaying(false);
      if (isRecording) stopRecording();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentIndex, words, config.wpm, isRecording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === AppMode.READER) {
        if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
        if (e.code === 'ArrowLeft') setCurrentIndex(prev => Math.max(0, prev - 1));
        if (e.code === 'ArrowRight') setCurrentIndex(prev => Math.min(words.length - 1, prev + 1));
        if (e.code === 'ArrowUp') {
            e.preventDefault();
            adjustSpeed(10);
        }
        if (e.code === 'ArrowDown') {
            e.preventDefault();
            adjustSpeed(-10);
        }
        if (e.code === 'Escape') { setMode(AppMode.EDITOR); setIsPlaying(false); stopCamera(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, togglePlay, words.length, adjustSpeed]);

  return (
    <div className="min-h-screen flex flex-col bg-black text-white selection:bg-red-500 selection:text-white">
      {mode === AppMode.EDITOR ? (
        <div className="flex-1 flex flex-col p-6 md:p-12 max-w-7xl mx-auto w-full gap-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tighter text-white">
                FOCUS<span className="text-red-500">PROMPTER</span>
              </h1>
              <p className="text-gray-400 mt-1">Grave vídeos com legendas automáticas no estilo RSVP.</p>
            </div>
            <div className="flex gap-2">
               <button 
                onClick={handleEnhance}
                disabled={isEnhancing}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
              >
                {isEnhancing ? 'Processando...' : '✨ Melhorar com IA'}
              </button>
              <button 
                onClick={() => setMode(AppMode.READER)}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-900/20"
              >
                MODO GRAVAÇÃO
              </button>
            </div>
          </header>

          <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Editor de Roteiro</label>
                <button onClick={handleSaveScript} className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Salvar
                </button>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-lg font-medium focus:ring-2 focus:ring-red-500/50 outline-none resize-none min-h-[500px]"
              />
            </div>

            <aside className="lg:col-span-1 flex flex-col gap-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 max-h-[400px]">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Biblioteca</h2>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {savedScripts.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic py-4 text-center">Vazio.</p>
                  ) : (
                    savedScripts.map((s) => (
                      <div key={s.title} onClick={() => handleLoadScript(s)} className="group relative flex flex-col p-3 bg-zinc-800/40 hover:bg-zinc-800 rounded-xl border border-zinc-800/50 cursor-pointer transition-all">
                        <span className="text-sm font-bold truncate pr-6">{s.title}</span>
                        <span className="text-[10px] text-zinc-500 mt-1">{new Date(s.lastUpdated).toLocaleDateString()}</span>
                        <button onClick={(e) => handleDeleteScript(e, s.title)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Ajustes</h2>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-medium text-zinc-400">
                      <label>WPM</label><span className="text-red-500 font-bold">{config.wpm}</span>
                    </div>
                    <input type="range" min="100" max="800" step="10" value={config.wpm} onChange={(e) => setConfig({...config, wpm: Number(e.target.value)})} className="w-full accent-red-500" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-medium text-zinc-400">
                      <label>Fonte</label><span className="text-red-500 font-bold">{config.fontSize}px</span>
                    </div>
                    <input type="range" min="40" max="300" step="5" value={config.fontSize} onChange={(e) => setConfig({...config, fontSize: Number(e.target.value)})} className="w-full accent-red-500" />
                  </div>
                </div>
              </div>
            </aside>
          </main>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
          
          {/* Hidden Canvas for Composition */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Preview (Source for Canvas) */}
          <video 
            ref={videoPreviewRef}
            autoPlay 
            muted 
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Overlay Interface (Only visible to user, not recorded) */}
          <div className="absolute inset-0 z-40 pointer-events-none">
             {/* Progress Bar */}
             <div className="fixed top-0 left-0 right-0 h-1 bg-zinc-900/50">
               <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${(currentIndex / words.length) * 100}%` }} />
             </div>

             {/* HTML RSVP Display for user feedback */}
             <div className="absolute inset-0 flex items-center justify-center">
                <RSVPDisplay word={words[currentIndex]} fontSize={config.fontSize} showOrp={config.showOrp} />
             </div>
          </div>

          {/* REC Indicator */}
          {isRecording && (
            <div className="fixed top-6 right-6 flex items-center gap-2 px-3 py-1 bg-red-600/90 border border-red-500 rounded-full animate-pulse z-50 shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span className="text-[10px] text-white font-bold tracking-widest uppercase">Gravando + Legenda</span>
            </div>
          )}

          {/* Enhanced Control Bar */}
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 bg-zinc-900/90 backdrop-blur-xl rounded-3xl border border-zinc-800/50 shadow-2xl z-50 transition-opacity">
             <button onClick={() => { setMode(AppMode.EDITOR); setIsPlaying(false); stopCamera(); }} className="p-3 text-zinc-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            </button>

            <button 
              onClick={isCameraActive ? stopCamera : startCamera} 
              className={`p-3 rounded-xl transition-all ${isCameraActive ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-400 hover:text-white'}`}
              title={isCameraActive ? "Desativar Câmera" : "Ativar Câmera"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>

            <div className="w-px h-8 bg-zinc-800" />

            <button onClick={togglePlay} className="w-14 h-14 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all active:scale-95 shadow-inner">
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
              )}
            </button>

            {isCameraActive && (
              <button 
                onClick={isRecording ? stopRecording : startRecording} 
                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all active:scale-95 shadow-lg ${isRecording ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}
                title={isRecording ? "Parar Gravação" : "Gravar c/ Legenda"}
              >
                {isRecording ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                ) : (
                  <div className="w-5 h-5 bg-white rounded-full" />
                )}
              </button>
            )}

            <div className="w-px h-8 bg-zinc-800" />

            <div className="flex flex-col items-center">
               <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-tighter mb-1">Velocidade</span>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => adjustSpeed(-10)}
                   className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                 </button>
                 
                 <div className="w-12 text-center font-bold text-lg tabular-nums">
                   {config.wpm}
                 </div>

                 <button 
                   onClick={() => adjustSpeed(10)}
                   className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                 </button>
               </div>
            </div>
          </div>

          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-zinc-600 uppercase tracking-[0.2em] pointer-events-none z-50">
            {isRecording ? "Gerando vídeo com legenda..." : "Setas ↑ ↓ ajustam velocidade"}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
