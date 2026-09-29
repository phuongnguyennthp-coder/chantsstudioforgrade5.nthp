import React, { useState, useEffect } from 'react';
import { Key, Sparkles, ExternalLink, X, Check, Shield } from 'lucide-react';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  isMandatory = false,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    const savedModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
    setApiKey(savedKey);
    setSelectedModel(savedModel);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gemini_api_key', apiKey.trim());
    localStorage.setItem('gemini_model', selectedModel);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  const models = [
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      badge: 'Latest • Ultra Fast',
      desc: 'Google next-gen model, optimized for fast feedback and real-time chant scoring.',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      badge: 'Super Stable',
      desc: 'Standard Google AI Studio model with high reliability and generous quotas.',
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini 2.0 Flash Lite',
      badge: 'Quota Efficient',
      desc: 'Lightweight model with quick responses and minimal quota consumption.',
    },
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      badge: 'Google Recommended',
      desc: 'New model directly recommended in Google Gemini documentation.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border-4 border-yellow-400 p-6 sm:p-7 max-w-lg w-full shadow-2xl relative space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-pink-500 flex items-center justify-center text-white shadow">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-900">
                Gemini API Key & Model Settings
              </h2>
              <span className="text-xs text-rose-600 font-bold block">
                Connect your API key for AI feedback
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guide Link */}
        <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-950 leading-relaxed">
          <span className="font-black block mb-1">🔑 Free API Key Guide:</span>
          Visit Google AI Studio to generate or view your free API key:
          <a
            href="https://aistudio.google.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-pink-600 hover:text-pink-700 font-black underline block"
          >
            <span>https://aistudio.google.com/api-keys</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Key Input */}
          <div>
            <label className="text-xs font-black text-zinc-700 block mb-1">
              Google Gemini API Key:
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full text-xs font-mono font-medium p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none bg-zinc-50"
            />
            <span className="text-[10px] text-zinc-400 block mt-1">
              Your API key is stored securely in your browser's local storage (localStorage).
            </span>
          </div>

          {/* Model Selection Cards */}
          <div>
            <label className="text-xs font-black text-zinc-700 block mb-2">
              Select AI Model:
            </label>
            <div className="space-y-2">
              {models.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-center justify-between gap-3 ${
                    selectedModel === m.id
                      ? 'border-pink-500 bg-pink-50/50 shadow-sm'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-zinc-900">{m.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-900 border border-yellow-300">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{m.desc}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedModel === m.id
                        ? 'border-pink-500 bg-pink-500 text-white'
                        : 'border-zinc-300'
                    }`}
                  >
                    {selectedModel === m.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-sm shadow-lg shadow-pink-300 flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-95"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save API Key Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
