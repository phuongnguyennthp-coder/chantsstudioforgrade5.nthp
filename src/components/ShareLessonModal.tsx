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
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="750" frameborder="0" allow="camera; microphone; autoplay; fullscreen" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" style="border-radius: 24px; border: 4px solid #f472b6; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 100%; height: 750px;"></iframe>`;

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
                Share Lesson • Xuất Link Heyzine
              </h2>
              <p className="text-xs font-bold text-zinc-500">
                Embed interactive chant into Heyzine Flipbook or share direct link to students! • Nhúng vào sách Heyzine hoặc gửi link trực tiếp!
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

        {/* Assigned Lesson Badge */}
        <div className="bg-pink-50 p-3.5 rounded-2xl border-2 border-pink-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-pink-600 shrink-0" />
            <div>
              <span className="text-xs font-black text-pink-900 block">
                {lesson.title}
              </span>
              <span className="text-[11px] font-bold text-zinc-500">
                {lesson.gradeLevel} • {lesson.bpm} BPM • {lesson.lyrics.length} lines • câu hát
              </span>
            </div>
          </div>
          <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
            Ready to Share • Sẵn sàng giao
          </span>
        </div>

        {/* Warning if video is a local blob from teacher PC */}
        {(Boolean(lesson.videoUrl?.startsWith('blob:')) || Boolean(lesson.karaokeVideoUrl?.startsWith('blob:'))) && (
          <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-400 text-amber-950 space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 font-black text-xs text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>NOTE: Video is a local file (.mp4) • LƯU Ý: Video bài hát đang là tệp từ máy tính cá nhân!</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900">
              Because this video file is stored on your local computer, students on <b>Phones or Tablets (iPad)</b> cannot stream it over the internet. (Vì tệp video này nằm trong máy tính cá nhân, học sinh dùng điện thoại hoặc iPad sẽ không tải được qua mạng).
            </p>
            <div className="bg-white/90 p-2.5 rounded-xl text-xs font-bold text-emerald-800 border border-amber-200">
              👉 <b>Solution for 100% Mobile & Tablet Support • Cách khắc phục:</b>
              <br />
              In Teacher Studio, paste a <b>YouTube Link</b> or <b>Google Drive Link</b> into the Video field so students on any device can watch smoothly! (Dán link YouTube hoặc Google Drive để xem mượt mà trên mọi máy!)
            </div>
          </div>
        )}

        {/* Warning if beat audio is a local blob from teacher PC */}
        {Boolean(lesson.beatAudioUrl?.startsWith('blob:')) && (
          <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-400 text-emerald-950 space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 font-black text-xs text-emerald-800">
              <Music className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>NOTE: Beat audio is a local file • LƯU Ý: Nhạc Beat đang là file từ máy tính (blob)!</span>
            </div>
            <p className="text-xs leading-relaxed text-emerald-900">
              On <b>Mobile phones or Tablets (iPad)</b>, the app will <b>automatically play the Smart Procedural Beat</b> (drum groove) so students can always practice with full sound! (Ứng dụng sẽ tự động phát Beat Nhịp Điệu Thông Minh để học sinh luôn nghe rõ nhạc và thực hành tốt!)
            </p>
            <div className="bg-white/90 p-2.5 rounded-xl text-xs font-bold text-emerald-900 border border-emerald-200">
              💡 <b>To stream a custom MP3 • Để học sinh nghe MP3 riêng:</b>
              <br />
              Upload MP3 to Google Drive (set to <i>"Anyone with the link can view"</i>) and paste the link into <b>2. Backing Beat</b> in Teacher Studio.
            </div>
          </div>
        )}

        {/* Section 1: Copy Direct Link */}
        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-700 flex items-center gap-1.5 uppercase">
            <Share2 className="w-4 h-4 text-pink-500" />
            <span>1. Direct Student Link • Link trực tiếp cho học sinh:</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={studentShareUrl}
              className="w-full text-xs font-mono font-medium text-zinc-700 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 outline-none select-all"
            />
            <button
              type="button"
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
                  <span>Copied! • Đã chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link • Sao chép Link</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            💡 Students open this link to practice directly without requiring any login. • Học sinh mở link này sẽ vào ngay bài tập, không cần đăng nhập.
          </p>
        </div>

        {/* Section 2: Heyzine iFrame Embed Code */}
        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-700 flex items-center gap-1.5 uppercase">
            <Code className="w-4 h-4 text-indigo-500" />
            <span>2. Heyzine iFrame Code • Mã nhúng iFrame cho Heyzine (Flipbook Embed):</span>
          </label>
          <div className="flex items-start gap-2">
            <textarea
              readOnly
              rows={2}
              value={iframeCode}
              className="w-full text-xs font-mono font-medium text-zinc-700 bg-zinc-50 p-2.5 rounded-xl border-2 border-zinc-200 outline-none select-all resize-none"
            />
            <button
              type="button"
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
                  <span>Copied! • Đã chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy iFrame • Sao chép iFrame</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Heyzine Easy Step Guide */}
        <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-300 space-y-2">
          <span className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>3-Step Heyzine Integration Guide • Hướng dẫn 3 bước nhúng vào Heyzine:</span>
          </span>
          <div className="text-xs text-amber-900 space-y-1.5 font-medium">
            <p>
              1️⃣ <strong>Copy • Sao chép:</strong> Tap <strong>"Copy Link"</strong> (or iFrame code) above.
            </p>
            <p>
              2️⃣ <strong>Open Heyzine • Mở Heyzine:</strong> Go to your flipbook on <em>heyzine.com</em> &gt; Choose the page for this chant song.
            </p>
            <p>
              3️⃣ <strong>Paste • Dán vào:</strong> Select <strong>"Links"</strong> (or <strong>"iFrame / Web"</strong>) toolbar and paste the URL!
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
            <span>Test Student View in New Tab • Mở thử trang học sinh ở tab mới</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white font-black text-xs transition cursor-pointer shadow-md"
          >
            Close • Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};
