
import React, { useState, useRef, useCallback } from 'react';
import { RedactionIntensity, RedactionMode } from './types';
import { processPdfFile, applyCanvasRedaction } from './services/pdfService';
import { detectSensitiveData } from './services/geminiService';

// External libs declared in index.html
declare const jspdf: any;

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [intensity, setIntensity] = useState<RedactionIntensity>(30);
  const [mode, setMode] = useState<RedactionMode>(RedactionMode.RANDOM);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputCanvases, setOutputCanvases] = useState<HTMLCanvasElement[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setOutputCanvases([]); // Clear previous output
    }
  };

  const redactTextToCanvas = useCallback(async (text: string, currentIntensity: number, currentMode: RedactionMode) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set page size (A4-ish)
    canvas.width = 800;
    canvas.height = 1100;
    
    // Background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentIntensity === 100) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      return canvas;
    }

    ctx.font = '16px "JetBrains Mono"';
    ctx.fillStyle = 'black';
    const lines = text.split('\n');
    let y = 50;
    const margin = 50;
    const maxWidth = canvas.width - (margin * 2);

    let phrasesToRedact: string[] = [];
    if (currentMode === RedactionMode.AI_SENSITIVE) {
      phrasesToRedact = await detectSensitiveData(text);
    }

    for (const line of lines) {
      const words = line.split(' ');
      let x = margin;
      
      for (const word of words) {
        const metrics = ctx.measureText(word + ' ');
        if (x + metrics.width > maxWidth) {
          x = margin;
          y += 25;
        }

        const isSensitive = phrasesToRedact.some(p => word.toLowerCase().includes(p.toLowerCase()));
        const shouldRedact = (currentMode === RedactionMode.RANDOM && Math.random() * 100 < currentIntensity) ||
                           (currentMode === RedactionMode.AI_SENSITIVE && isSensitive);

        if (shouldRedact) {
          ctx.fillStyle = 'black';
          ctx.fillRect(x - 2, y - 18, metrics.width, 22);
        } else {
          ctx.fillStyle = 'black';
          ctx.fillText(word + ' ', x, y);
        }
        x += metrics.width;
      }
      y += 30;
    }

    return canvas;
  }, []);

  const handleGenerate = async () => {
    setIsProcessing(true);
    setProgress(0);
    try {
      if (uploadedFile) {
        const canvases = await processPdfFile(uploadedFile, intensity, setProgress);
        setOutputCanvases(canvases);
      } else if (inputText.trim()) {
        const canvas = await redactTextToCanvas(inputText, intensity, mode);
        if (canvas) setOutputCanvases([canvas]);
        setProgress(100);
      }
    } catch (err) {
      console.error(err);
      alert("Error processing file. Please ensure it is a valid PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    if (outputCanvases.length === 0) return;
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
        orientation: outputCanvases[0].width > outputCanvases[0].height ? 'l' : 'p',
        unit: 'px',
        format: [outputCanvases[0].width, outputCanvases[0].height]
    });

    outputCanvases.forEach((canvas, index) => {
      if (index > 0) doc.addPage([canvas.width, canvas.height], canvas.width > canvas.height ? 'l' : 'p');
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    });

    doc.save('redacted_document.pdf');
  };

  const handleDownloadJPG = () => {
    outputCanvases.forEach((canvas, index) => {
      const link = document.createElement('a');
      link.download = `redacted_page_${index + 1}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 flex flex-col p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-white flex items-center gap-2">
            <span className="bg-white text-black px-2 rounded">TRUMPSTEIN</span> REDACTOR
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Professional grade document obfuscation & sanitization.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
           >
             Upload PDF
           </button>
           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleFileUpload} 
             className="hidden" 
             accept=".pdf"
           />
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls & Input */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Input Source</label>
              {uploadedFile ? (
                <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-xl border border-zinc-700">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <svg className="w-6 h-6 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm4-7h4v2H8v-2zm0-4h4v2H8V7z"/></svg>
                    <span className="truncate text-sm font-medium">{uploadedFile.name}</span>
                  </div>
                  <button onClick={() => setUploadedFile(null)} className="text-zinc-500 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ) : (
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste or write text here..."
                  className="w-full h-64 bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-white focus:outline-none mono resize-none"
                />
              )}
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500">Redaction Intensity</label>
                <span className="text-sm font-bold mono text-white">{intensity}%</span>
               </div>
               <input 
                type="range" 
                min="0" 
                max="100" 
                value={intensity}
                onChange={(e) => setIntensity(parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
               />
               <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                <span>0% CLEAR</span>
                <span>50% MEDIUM</span>
                <span>100% TOTAL</span>
               </div>
            </div>

            {!uploadedFile && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setMode(RedactionMode.RANDOM)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === RedactionMode.RANDOM ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    Random Hash
                  </button>
                  <button 
                    onClick={() => setMode(RedactionMode.AI_SENSITIVE)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === RedactionMode.AI_SENSITIVE ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    AI Sensitive (Gemini)
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isProcessing || (!inputText && !uploadedFile)}
              className="w-full py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-white/5 active:scale-[0.98]"
            >
              {isProcessing ? `Processing ${progress}%...` : 'Generate Redactions'}
            </button>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Live Preview</h2>
            {outputCanvases.length > 0 && (
              <div className="flex gap-3">
                <button onClick={handleDownloadPDF} className="text-xs font-bold text-white hover:underline">Download PDF</button>
                <button onClick={handleDownloadJPG} className="text-xs font-bold text-white hover:underline">Download JPGs</button>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 min-h-[500px] overflow-y-auto flex flex-col items-center gap-8 shadow-inner">
            {outputCanvases.length > 0 ? (
              outputCanvases.map((canvas, idx) => (
                <div key={idx} className="relative group shadow-2xl">
                   <div className="absolute -top-3 left-4 bg-zinc-800 text-[10px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 font-mono uppercase">
                     Page {idx + 1}
                   </div>
                   <img 
                    src={canvas.toDataURL()} 
                    alt={`Redacted preview page ${idx + 1}`} 
                    className="max-w-full rounded-sm border border-zinc-700"
                   />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-zinc-600 gap-4 opacity-50">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                <p className="text-sm font-medium">Redacted output will appear here</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Security Footer */}
      <footer className="max-w-7xl mx-auto w-full mt-12 pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
        <div className="flex items-center gap-4">
          <span>Client-Side Processing Only</span>
          <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
          <span>AES-256 Mocked Architecture</span>
        </div>
        <div>
          &copy; {new Date().getFullYear()} TRUMPSTEIN REDACTOR Advanced Defense
        </div>
      </footer>
    </div>
  );
};

export default App;
