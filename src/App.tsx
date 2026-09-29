import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Music,
  Star,
  Award,
  Heart,
  RefreshCw,
  Key,
  Share2,
  ExternalLink,
  Lock,
  Eye,
  Palette,
  Upload,
  RotateCcw,
  Check,
  X,
  Maximize,
  Minimize,
} from 'lucide-react';
import { SongLesson } from './types/kidsMusic';
import { INITIAL_LESSONS } from './data/kidLessons';
import { StudentMissionView } from './components/StudentMissionView';
import { TeacherStudioModal } from './components/TeacherStudioModal';
import { ApiKeySettingsModal } from './components/ApiKeySettingsModal';
import { ShareLessonModal } from './components/ShareLessonModal';

interface BackgroundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBg: string;
  onApplyBg: (bgUrl: string) => void;
}

const PRESET_BACKGROUNDS = [
  {
    id: 'classroom',
    name: 'Classroom 🏫',
    url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1920&q=80',
    desc: 'Cozy and colorful classroom environment',
  },
  {
    id: 'music-world',
    name: 'Music World 🎵',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1920&q=80',
    desc: 'Lively musical instruments and stage',
  },
  {
    id: 'starry-sky',
    name: 'Starry Sky ✨',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80',
    desc: 'Dreamy starry night backdrop',
  },
  {
    id: 'pastel-rainbow',
    name: 'Pastel Rainbow 🌈',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1920&q=80',
    desc: 'Bright and cheerful pastel rainbow',
  },
];

function BackgroundSettingsModal({
  isOpen,
  onClose,
  currentBg,
  onApplyBg,
}: BackgroundSettingsModalProps) {
  const [selectedBg, setSelectedBg] = useState<string>(currentBg || '');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPreviewError('Please select a valid image file (PNG, JPG, WebP)!');
      return;
    }

    setPreviewError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSelectedBg(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!customUrlInput.trim()) return;
    setSelectedBg(customUrlInput.trim());
    setCustomUrlInput('');
  };

  const handleSave = () => {
    onApplyBg(selectedBg);
    localStorage.setItem('chantsstudio_custom_bg', selectedBg);
    onClose();
  };

  const handleResetToDefault = () => {
    setSelectedBg('');
    onApplyBg('');
    localStorage.removeItem('chantsstudio_custom_bg');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border-4 border-amber-400 p-6 sm:p-7 max-w-xl w-full shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center text-xl shadow-md">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-zinc-900">
                Change Background
              </h3>
              <p className="text-xs font-bold text-zinc-500">
                Upload an image or choose a theme for students!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-zinc-700 block">
            Preview Background:
          </label>
          <div
            className="w-full h-32 rounded-2xl border-2 border-dashed border-amber-300 relative overflow-hidden flex items-center justify-center shadow-inner"
            style={{
              backgroundColor: '#fdfbf7',
              backgroundImage: selectedBg ? `url(${selectedBg})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-xl border border-zinc-200 text-center shadow-sm">
              <span className="text-xs font-black text-pink-700 block">
                🎵 chantsstudioforgrade5
              </span>
              <span className="text-[10px] font-bold text-zinc-600">
                {selectedBg ? 'Custom background selected' : 'Default warm background (#fdfbf7)'}
              </span>
            </div>
          </div>
        </div>

        {/* Upload Custom File from Device */}
        <div className="space-y-2 pt-1 border-t border-zinc-100">
          <label className="text-xs font-black text-zinc-700 block">
            Option 1: Upload from device (JPG, PNG, WebP):
          </label>
          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-300 rounded-2xl bg-emerald-50/50 hover:bg-emerald-100/50 transition cursor-pointer text-center">
            <Upload className="w-6 h-6 text-emerald-600 mb-1" />
            <span className="text-xs font-black text-zinc-800">
              Select Background Image
            </span>
            <span className="text-[10px] text-zinc-500">
              High-resolution wallpaper automatically fitted
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Or Enter Custom Image URL */}
        <div className="space-y-2 pt-1 border-t border-zinc-100">
          <label className="text-xs font-black text-zinc-700 block">
            Option 2: Enter online Image URL:
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://.../background.jpg"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              className="flex-1 text-xs p-2.5 rounded-xl border border-zinc-300 outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-black rounded-xl transition cursor-pointer shadow-sm"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Preset Theme Selection */}
        <div className="space-y-2 pt-1 border-t border-zinc-100">
          <label className="text-xs font-black text-zinc-700 block">
            Option 3: Choose preset animated themes:
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {PRESET_BACKGROUNDS.map((theme) => (
              <button
                type="button"
                key={theme.id}
                onClick={() => setSelectedBg(theme.url)}
                className={`p-2.5 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col gap-1 relative overflow-hidden group ${
                  selectedBg === theme.url
                    ? 'border-amber-500 bg-amber-50 shadow-md ring-2 ring-amber-300'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div
                  className="w-full h-16 rounded-xl overflow-hidden bg-cover bg-center border border-zinc-200"
                  style={{ backgroundImage: `url(${theme.url})` }}
                />
                <span className="text-xs font-black text-zinc-800 block truncate">
                  {theme.name}
                </span>
                <span className="text-[10px] text-zinc-500 block truncate">
                  {theme.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {previewError && (
          <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">
            {previewError}
          </p>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t-2 border-zinc-100 flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            title="Reset to default background"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white text-xs font-black shadow-md cursor-pointer transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Background</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [lessons, setLessons] = useState<SongLesson[]>(() => {
    const saved =
      localStorage.getItem('chantsstudioforgrade5_lessons') ||
      localStorage.getItem('singbuddy_lessons');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        return INITIAL_LESSONS;
      } catch {
        return INITIAL_LESSONS;
      }
    }
    return INITIAL_LESSONS;
  });

  const [activeLesson, setActiveLesson] = useState<SongLesson>(() => {
    return lessons && lessons.length > 0 ? lessons[0] : INITIAL_LESSONS[0];
  });
  const currentLesson = activeLesson || lessons[0] || INITIAL_LESSONS[0];
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);

  // Custom Background State
  const [customBackground, setCustomBackground] = useState<string>(() => {
    return localStorage.getItem('chantsstudio_custom_bg') || '';
  });

  // Check if loaded inside Heyzine iframe or student view mode
  const [isEmbedMode, setIsEmbedMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('embed') === 'true' || params.get('view') === 'student';
  });

  // Student vs Teacher Mode
  // If opened with embed=true or view=student, it is strictly student mode
  const [isStudentMode, setIsStudentMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed') === 'true' || params.get('view') === 'student') {
      return true;
    }
    const saved = localStorage.getItem('chantsstudio_mode');
    return saved ? saved === 'student' : true;
  });

  // Teacher PIN verification modal
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Fullscreen State & Handler
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    const doc = document as any;
    const docEl = document.documentElement as any;
    const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement);
    if (!isFs) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Decode lessonData from URL parameter if opened from Heyzine / shared link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lessonDataRaw = params.get('lessonData');
    if (lessonDataRaw) {
      try {
        const decoded = decodeURIComponent(atob(lessonDataRaw));
        const sharedLesson: SongLesson & { teacherApiKey?: string } = JSON.parse(decoded);
        if (sharedLesson.teacherApiKey && !localStorage.getItem('gemini_api_key')) {
          localStorage.setItem('gemini_api_key', sharedLesson.teacherApiKey);
        }
        setLessons((prev) => {
          const exists = prev.some((l) => l.id === sharedLesson.id);
          return exists ? prev : [sharedLesson, ...prev];
        });
        setActiveLesson(sharedLesson);
      } catch (e) {
        console.warn('Failed to parse shared lesson data from URL', e);
      }
    } else {
      const lessonId = params.get('lessonId');
      if (lessonId) {
        const found = lessons.find((l) => l.id === lessonId);
        if (found) setActiveLesson(found);
      }
    }
  }, []);

  // Save lessons to localStorage under chantsstudioforgrade5_lessons
  useEffect(() => {
    localStorage.setItem('chantsstudioforgrade5_lessons', JSON.stringify(lessons));
  }, [lessons]);

  const handleAddLesson = (newLesson: SongLesson) => {
    setLessons((prev) => [newLesson, ...prev]);
  };

  const handleUpdateLesson = (updatedLesson: SongLesson) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === updatedLesson.id ? updatedLesson : l))
    );
    if (activeLesson.id === updatedLesson.id) {
      setActiveLesson(updatedLesson);
    }
  };

  const handleDeleteLesson = (id: string) => {
    setLessons((prev) => {
      const filtered = prev.filter((l) => l.id !== id);
      if (activeLesson.id === id && filtered.length > 0) {
        setActiveLesson(filtered[0]);
      }
      return filtered;
    });
  };

  const handleSelectAndAssign = (lesson: SongLesson) => {
    setActiveLesson(lesson);
  };

  return (
    <div
      className="min-h-screen text-zinc-900 font-sans selection:bg-pink-300 selection:text-pink-900 pb-16 transition-all duration-300 relative"
      style={{
        backgroundColor: '#fdfbf7',
        backgroundImage: customBackground ? `url(${customBackground})` : undefined,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
      }}
    >
      {/* Light soft backdrop overlay to guarantee text readability when custom background is set */}
      {customBackground && (
        <div className="fixed inset-0 bg-[#fdfbf7]/80 backdrop-blur-[2px] pointer-events-none z-0" />
      )}

      <div className="relative z-10">
        {/* Playful Floating Cloud / Star Header Bar */}
        <header className="border-b-4 border-yellow-300 bg-white/95 backdrop-blur sticky top-0 z-30 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
            {/* Logo & Brand: chantsstudioforgrade5 */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-yellow-400 flex items-center justify-center text-white shadow-lg shadow-pink-300 rotate-2 hover:rotate-6 transition">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-xl sm:text-2xl text-pink-600 tracking-tight">
                    chantsstudioforgrade5
                  </span>
                  <span className="bg-yellow-400 text-yellow-950 font-black text-[11px] px-2.5 py-0.5 rounded-full shadow-sm">
                    Grade 5 Elementary Music ⭐
                  </span>
                  <span className="bg-purple-100 text-purple-700 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full border border-purple-200 shadow-sm flex items-center gap-1">
                    ✨ Designed by Tím
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-500 hidden sm:block">
                  Watch video, chant along with the beats, record your voice and get AI Buddy feedback!
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {isStudentMode ? (
                <div className="flex items-center gap-2">
                  {isEmbedMode ? (
                    <span className="bg-pink-100 text-pink-700 text-xs font-black px-3 py-1.5 rounded-full border border-pink-200">
                      📖 Heyzine Flipbook
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1 shadow-sm">
                      🎓 Student View
                    </span>
                  )}
                  {/* Fullscreen Button for Student */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-emerald-600" /> : <Maximize className="w-3.5 h-3.5 text-emerald-600" />}
                    <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                  </button>
                  {/* Discrete Teacher switch with PIN lock */}
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                    title="Teacher Studio with PIN lock"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="hidden sm:inline">Teacher</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Fullscreen Button for Teacher */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="px-3 py-2 rounded-2xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-emerald-600" /> : <Maximize className="w-3.5 h-3.5 text-emerald-600" />}
                    <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                  </button>
                  {/* Switch back to Student View */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsStudentMode(true);
                      localStorage.setItem('chantsstudio_mode', 'student');
                    }}
                    className="px-3 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-black transition cursor-pointer flex items-center gap-1 border border-zinc-200 shadow-sm"
                    title="Switch to Student View"
                  >
                    <Eye className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="hidden sm:inline">Student View</span>
                  </button>

                  {/* Change Background Button */}
                  <button
                    type="button"
                    onClick={() => setIsBgModalOpen(true)}
                    className="px-3 py-2 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-black transition cursor-pointer flex items-center gap-1.5 border border-amber-300 shadow-sm"
                    title="Change background wallpaper"
                  >
                    <Palette className="w-3.5 h-3.5 text-amber-700" />
                    <span className="hidden sm:inline">Background</span>
                    <span className="sm:hidden">Theme</span>
                  </button>

                  {/* Share Link for Heyzine Button */}
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(true)}
                    className="px-3 py-2 rounded-2xl bg-pink-100 hover:bg-pink-200 text-pink-800 text-xs font-black transition cursor-pointer flex items-center gap-1.5 border border-pink-300 shadow-sm"
                    title="Export Heyzine link or share with students"
                  >
                    <Share2 className="w-3.5 h-3.5 text-pink-600" />
                    <span className="hidden sm:inline">Share Link</span>
                    <span className="sm:hidden">Share</span>
                  </button>

                  {/* API Key Settings Button */}
                  <button
                    type="button"
                    onClick={() => setIsApiKeyModalOpen(true)}
                    className="flex flex-col items-end px-3 py-1.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 transition cursor-pointer text-right shadow-sm"
                    title="API Key & AI Settings"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-700">
                      <Key className="w-3.5 h-3.5 text-rose-600" />
                      <span>Settings</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-600">
                      API Key Config
                    </span>
                  </button>

                  {/* Teacher Studio Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsTeacherModalOpen(true)}
                    className="px-3.5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 text-xs font-black shadow-md shadow-amber-200 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>🍎 Teacher Studio</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Student Mission Playground */}
        <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-6">
          <StudentMissionView
            lesson={currentLesson}
            allLessons={lessons}
            onSelectLesson={(l) => setActiveLesson(l)}
            onUpdateLesson={handleUpdateLesson}
            onOpenTeacherStudio={() => setIsTeacherModalOpen(true)}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            isStudentMode={isStudentMode}
          />
        </main>

        {/* Subtle App Footer with Designed by Tím */}
        <footer className="mt-12 text-center text-xs font-bold text-zinc-400 py-6 border-t border-zinc-200/60 flex items-center justify-center gap-2 flex-wrap">
          <span>chantsstudioforgrade5</span>
          <span>•</span>
          <span>Grade 5 Elementary Music</span>
          <span>•</span>
          <span className="text-purple-600 font-black bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 shadow-xs">
            ✨ Designed by Tím
          </span>
        </footer>
      </div>

      {/* Teacher PIN Access Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border-4 border-amber-400 p-6 sm:p-7 max-w-sm w-full text-center shadow-2xl relative space-y-4 animate-scale-up">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-3xl shadow-inner">
              🍎
            </div>
            <div>
              <h3 className="text-xl font-black text-amber-950">
                Teacher Zone
              </h3>
              <p className="text-xs font-bold text-zinc-500 mt-1">
                Enter PIN to open Teacher Studio (Default: 1234):
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pinInput.trim() === '1234') {
                  setIsStudentMode(false);
                  localStorage.setItem('chantsstudio_mode', 'teacher');
                  setIsPinModalOpen(false);
                  setPinInput('');
                  setPinError('');
                } else {
                  setPinError('Incorrect PIN! (Default: 1234)');
                }
              }}
              className="space-y-3"
            >
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="PIN (1234)"
                autoFocus
                className="w-full text-center tracking-widest text-xl font-black py-2.5 px-4 rounded-xl border-2 border-amber-300 focus:border-amber-500 outline-none"
              />
              {pinError && (
                <p className="text-xs font-black text-rose-600 animate-shake">
                  {pinError}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-black shadow-md cursor-pointer transition"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Studio Modal */}
      <TeacherStudioModal
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        lessons={lessons}
        onAddLesson={handleAddLesson}
        onUpdateLesson={handleUpdateLesson}
        onDeleteLesson={handleDeleteLesson}
        onSelectAndAssign={handleSelectAndAssign}
      />

      {/* Background Settings Modal */}
      <BackgroundSettingsModal
        isOpen={isBgModalOpen}
        onClose={() => setIsBgModalOpen(false)}
        currentBg={customBackground}
        onApplyBg={(bg) => setCustomBackground(bg)}
      />

      {/* Gemini API Key & Model Settings Modal */}
      <ApiKeySettingsModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        isMandatory={!localStorage.getItem('gemini_api_key')}
      />

      {/* Heyzine Share Lesson Modal */}
      <ShareLessonModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        lesson={currentLesson}
      />
    </div>
  );
}
