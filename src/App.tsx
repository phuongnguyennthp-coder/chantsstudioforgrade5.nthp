import React, { useState, useEffect } from 'react';
import { Sparkles, Music, Star, Award, Heart, RefreshCw, Key, Share2, ExternalLink } from 'lucide-react';
import { SongLesson } from './types/kidsMusic';
import { INITIAL_LESSONS } from './data/kidLessons';
import { StudentMissionView } from './components/StudentMissionView';
import { TeacherStudioModal } from './components/TeacherStudioModal';
import { ApiKeySettingsModal } from './components/ApiKeySettingsModal';
import { ShareLessonModal } from './components/ShareLessonModal';

export default function App() {
  const [lessons, setLessons] = useState<SongLesson[]>(() => {
    const saved =
      localStorage.getItem('chantsstudioforgrade5_lessons') ||
      localStorage.getItem('singbuddy_lessons');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_LESSONS;
      }
    }
    return INITIAL_LESSONS;
  });

  const [activeLesson, setActiveLesson] = useState<SongLesson>(lessons[0]);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Check if loaded inside Heyzine iframe or student view mode
  const [isEmbedMode, setIsEmbedMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('embed') === 'true' || params.get('view') === 'student';
  });

  // Decode lessonData from URL parameter if opened from Heyzine / shared link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lessonDataRaw = params.get('lessonData');
    if (lessonDataRaw) {
      try {
        const decoded = decodeURIComponent(atob(lessonDataRaw));
        const sharedLesson: SongLesson = JSON.parse(decoded);
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
    <div className="min-h-screen bg-[#fdfbf7] text-zinc-900 font-sans selection:bg-pink-300 selection:text-pink-900 pb-16">
      {/* Playful Floating Cloud / Star Header Bar */}
      <header className="border-b-4 border-yellow-300 bg-white/90 backdrop-blur sticky top-0 z-30 shadow-sm">
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
              </div>
              <p className="text-xs font-bold text-zinc-500 hidden sm:block">
                Xem video, hát theo beat nhạc bài hát, thu âm giọng hát và nộp bài để AI Buddy phản hồi!
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {isEmbedMode ? (
              <div className="flex items-center gap-2">
                <span className="bg-pink-100 text-pink-700 text-xs font-black px-3 py-1.5 rounded-full border border-pink-200">
                  📖 Heyzine Interactive Flipbook
                </span>
                <a
                  href={window.location.href.replace('&embed=true', '').replace('embed=true', '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200 shadow-sm"
                  title="Mở toàn màn hình"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <>
                {/* Share Link for Heyzine Button */}
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-3 py-2 rounded-2xl bg-pink-100 hover:bg-pink-200 text-pink-800 text-xs font-black transition cursor-pointer flex items-center gap-1.5 border border-pink-300 shadow-sm"
                  title="Xuất link bài hát hiện tại để nhúng vào Heyzine hoặc gửi cho học sinh"
                >
                  <Share2 className="w-3.5 h-3.5 text-pink-600" />
                  <span className="hidden sm:inline">Xuất Link Heyzine</span>
                  <span className="sm:hidden">Giao bài</span>
                </button>

                {/* API Key Settings Button with red notice */}
                <button
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="flex flex-col items-end px-3 py-1.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 transition cursor-pointer text-right shadow-sm"
                  title="Cài đặt API key và chọn model AI"
                >
                  <div className="flex items-center gap-1.5 text-xs font-black text-rose-700">
                    <Key className="w-3.5 h-3.5 text-rose-600" />
                    <span>Settings (API Key)</span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 animate-pulse">
                    Lấy API key để sử dụng app
                  </span>
                </button>

                {/* Teacher Studio Trigger */}
                <button
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
          lesson={activeLesson}
          allLessons={lessons}
          onSelectLesson={(l) => setActiveLesson(l)}
          onOpenTeacherStudio={() => setIsTeacherModalOpen(true)}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        />
      </main>

      {/* Teacher Modal */}
      <TeacherStudioModal
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        lessons={lessons}
        onAddLesson={handleAddLesson}
        onDeleteLesson={handleDeleteLesson}
        onSelectAndAssign={handleSelectAndAssign}
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
        lesson={activeLesson}
      />
    </div>
  );
}
