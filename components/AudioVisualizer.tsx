import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !isActive || !canvasRef.current) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isActive) return;
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear with white/light gray matching the bg
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];

        // Gradient color: Blue to Purple for a modern clean look
        const r = 59; // Blue-ish
        const g = 130 - (barHeight / 2);
        const b = 246; 

        // Use standard blue for simple visualization
        ctx.fillStyle = `rgb(37, 99, 235)`; // Blue-600
        ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      source.disconnect();
    };
  }, [stream, isActive]);

  return (
    <div className="w-full h-16 bg-slate-50 rounded-lg overflow-hidden border border-slate-200 relative">
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-medium">
          Audio Input Visualization
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={600}
        height={100}
        className="w-full h-full"
      />
    </div>
  );
};

export default AudioVisualizer;