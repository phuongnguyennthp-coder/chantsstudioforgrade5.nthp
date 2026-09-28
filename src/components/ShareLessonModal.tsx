import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Sparkles,
  Share2,
  Code,
  Music,
  AlertTriangle,
} from 'lucide-react';
import { SongLesson } from '../types/kidsMusic';

interface ShareLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: SongLesson;
}

export const ShareLessonModal: React.FC<ShareLessonModalProps> = ({
  isOpen,
  onClose,
  lesson,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);

  if (!isOpen) return null;

  // Retrieve teacher API key if set to allow seamless student evaluation without manual key entry
  const teacherApiKey = localStorage.getItem('gemini_api_key')?.trim() || '';

  // Generate lightweight base64 payload of lesson data
  const payload = {
    id: lesson.id,
    title: lesson.title,
    gradeLevel: lesson.gradeLevel,
    category: lesson.category,
    bpm: lesson.bpm,
    videoUrl: lesson.videoUrl,
    beatAudioUrl: lesson.beatAudioUrl,
    videoType: lesson.videoType,
    lyricsMode: lesson.lyricsMode || (lesson.videoUrl ? 'karaoke_video' : 'text'),
    lyrics: lesson.lyrics,
    karaokeVideoUrl: lesson.karaokeVideoUrl || lesson.videoUrl,
    missionTask: lesson.missionTask,
    teacherApiKey: teacherApiKey || undefined,
  };

  const jsonStr = JSON.stringify(payload);
  // URL safe base64
  const encodedData = btoa(encodeURIComponent(jsonStr));

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const baseUrl = `${origin}${pathname}`;

  // Direct student link
  const studentShareUrl = `${baseUrl}?lessonData=${encodedData}&view=student`;

  // Heyzine embed iframe URL
  const embedUrl = `${baseUrl}?lessonData=${encodedData}&embed=true`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="750" frameborder="0" allow="microphone; autoplay" style="border-radius: 24px; border: 4px solid #f472b6; box-shadow: 0 10px 25px rgba(0,0,0,0.1);"></iframe>`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(studentShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyIframe = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2500);
    } catch {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border-4 border-pink-400 p-6 sm:p-8 max-w-xl w-full shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b-2 border-pink-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-yellow-400 text-white flex items-center justify-center text-2xl shadow-md">
              📤
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-pink-700">
                Giao Bài Cho Học Sinh • Xuất Link Heyzine
              </h2>
              <p className="text-xs font-bold text-zinc-500">
                Nhúng bài tập vào sách tương tác Heyzine hoặc gửi link trực tiếp cho học sinh!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Assigned Lesson Badge */}
        <div className="bg-pink-50 p-3.5 rounded-2xl border-2 border-pink-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-pink-600 shrink-0" />
            <div>
              <span className="text-xs font-black text-pink-900 block">
                {lesson.title}
              </span>
              <span className="text-[11px] font-bold text-zinc-500">
                {lesson.gradeLevel} • {lesson.bpm} BPM • {lesson.lyrics.length} câu hát
              </span>
            </div>
          </div>
        {/* Warning if video is a local blob from teacher PC */}
        {(Boolean(lesson.videoUrl?.startsWith('blob:')) || Boolean(lesson.karaokeVideoUrl?.startsWith('blob:'))) && (
          <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-400 text-amber-950 space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 font-black text-xs text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>LƯU Ý: Video bài hát đang là tệp từ máy tính cá nhân (.mp4)!</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900">
              Vì tệp video này nằm trong ổ cứng máy tính của thầy/cô, nên khi học sinh mở link trên <b>Điện thoại hoặc Máy tính bảng (iPad)</b> sẽ không thể tải được video qua mạng.
            </p>
            <div className="bg-white/90 p-2.5 rounded-xl text-xs font-bold text-emerald-800 border border-amber-200">
              👉 <b>Cách khắc phục để xem được 100% trên Điện thoại & Tablet:</b>
              <br />
              Thầy/Cô hãy bấm <b>Chỉnh sửa bài học</b> ➔ dán <b>Link YouTube</b> hoặc <b>Link Google Drive</b> vào mục Video. Học sinh dùng bất kỳ thiết bị nào cũng xem mượt mà!
            </div>
          </div>
        )}

        {/* Section 1: Copy Direct Link */}
        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-700 flex items-center gap-1.5 uppercase">
            <Share2 className="w-4 h-4 text-pink-500" />
            <span>1. Đường Link trực tiếp cho học sinh:</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={studentShareUrl}
              className="w-full text-xs font-mono font-medium text-zinc-700 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 outline-none select-all"
            />
            <button
              onClick={handleCopyLink}
              className={`px-4 py-3 rounded-xl font-black text-xs flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer shrink-0 shadow-md ${
                copiedLink
                  ? 'bg-emerald-500 text-white shadow-emerald-200'
                  : 'bg-pink-600 hover:bg-pink-700 text-white shadow-pink-200'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao chép Link</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            💡 Học sinh mở link này sẽ vào ngay bài tập, không cần đăng nhập hay cài đặt tài khoản.
          </p>
        </div>

        {/* Section 2: Heyzine iFrame Embed Code */}
        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-700 flex items-center gap-1.5 uppercase">
            <Code className="w-4 h-4 text-indigo-500" />
            <span>2. Mã nhúng iFrame cho Heyzine (Flipbook Embed):</span>
          </label>
          <div className="flex items-start gap-2">
            <textarea
              readOnly
              rows={2}
              value={iframeCode}
              className="w-full text-xs font-mono font-medium text-zinc-700 bg-zinc-50 p-2.5 rounded-xl border-2 border-zinc-200 outline-none select-all resize-none"
            />
            <button
              onClick={handleCopyIframe}
              className={`px-4 py-3 rounded-xl font-black text-xs flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer shrink-0 shadow-md ${
                copiedIframe
                  ? 'bg-emerald-500 text-white shadow-emerald-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
              }`}
            >
              {copiedIframe ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao chép iFrame</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Heyzine Easy Step Guide */}
        <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-300 space-y-2">
          <span className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>Hướng dẫn 3 bước nhúng vào Heyzine:</span>
          </span>
          <div className="text-xs text-amber-900 space-y-1.5 font-medium">
            <p>
              1️⃣ <strong>Sao chép:</strong> Bấm <strong>Sao chép Link</strong> (hoặc Mã iFrame) ở trên.
            </p>
            <p>
              2️⃣ <strong>Mở Heyzine:</strong> Vào sách lật của bạn trên <em>heyzine.com</em> &gt; Chọn trang sách muốn đặt bài hát.
            </p>
            <p>
              3️⃣ <strong>Dán vào:</strong> Chọn thanh công cụ <strong>"Links"</strong> (hoặc <strong>"iFrame / Web"</strong>) và dán link vào!
            </p>
          </div>
        </div>

        {/* Preview Link Button & Close */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <a
            href={studentShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-pink-600 hover:text-pink-800 flex items-center gap-1 underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở thử trang học sinh ở tab mới</span>
          </a>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white font-black text-xs transition cursor-pointer shadow-md"
          >
            Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};
