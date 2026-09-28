import React, { useState } from 'react';
import {
  X,
  Upload,
  Video,
  Music,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  Play,
  Pause,
  Loader2,
  Scissors,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import { SongLesson } from '../types/kidsMusic';
import { extractAudioFromMedia } from '../utils/audioExtractor';

interface TeacherStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessons: SongLesson[];
  onAddLesson: (lesson: SongLesson) => void;
  onDeleteLesson: (id: string) => void;
  onSelectAndAssign: (lesson: SongLesson) => void;
}

export const TeacherStudioModal: React.FC<TeacherStudioModalProps> = ({
  isOpen,
  onClose,
  lessons,
  onAddLesson,
  onDeleteLesson,
  onSelectAndAssign,
}) => {
  const [title, setTitle] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Grade 5');
  const [category, setCategory] = useState('Vocal Melody & Rhythm');
  const [bpm, setBpm] = useState(90);
  const [lyricsText, setLyricsText] = useState('');
  const [missionTask, setMissionTask] = useState(
    'Watch the video carefully, practice singing along with the drum beat, and record your joyful voice!',
  );

  // Video and audio files / URLs
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoFileObj, setVideoFileObj] = useState<File | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  const [beatFileUrl, setBeatFileUrl] = useState<string | null>(null);
  const [beatFileName, setBeatFileName] = useState<string | null>(null);
  const [beatDuration, setBeatDuration] = useState<number | null>(null);

  // Audio Extraction States
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractionMode, setExtractionMode] = useState<'original' | 'vocal_reduced'>('original');

  // Preview Audio state
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  if (!isOpen) return null;

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoFileUrl(url);
      setVideoFileName(file.name);
      setVideoFileObj(file);
      setExtractError(null);
    }
  };

  // Extract beat directly from Step 1's uploaded video or video URL
  const handleExtractFromStep1Video = async (mode: 'original' | 'vocal_reduced') => {
    const source = videoFileObj || customVideoUrl.trim() || videoFileUrl;
    if (!source) {
      setExtractError('Vui lòng tải video ở Bước 1 trước khi trích xuất beat!');
      return;
    }

    try {
      setIsExtracting(true);
      setExtractError(null);
      setExtractionMode(mode);

      if (previewAudio) {
        previewAudio.pause();
        setIsPreviewPlaying(false);
      }

      const result = await extractAudioFromMedia(source, mode);
      setBeatFileUrl(result.url);
      setBeatDuration(Math.round(result.duration));
      const modeLabel = mode === 'vocal_reduced' ? 'Karaoke Beat (Tách lời)' : 'Audio gốc';
      setBeatFileName(`${modeLabel} • ${videoFileName || 'Video bài hát'}`);
    } catch (err: any) {
      console.error('Audio extraction error:', err);
      setExtractError(
        err?.message || 'Không thể trích xuất âm thanh từ video. Vui lòng tải file MP4/WebM trực tiếp.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  // Upload custom beat (Audio or Video file)
  const handleBeatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractError(null);

    // If video file, extract audio automatically
    if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name)) {
      try {
        setIsExtracting(true);
        if (previewAudio) {
          previewAudio.pause();
          setIsPreviewPlaying(false);
        }
        const result = await extractAudioFromMedia(file, extractionMode);
        setBeatFileUrl(result.url);
        setBeatDuration(Math.round(result.duration));
        const modeLabel = extractionMode === 'vocal_reduced' ? 'Karaoke Beat' : 'Beat trích xuất';
        setBeatFileName(`${modeLabel} • ${file.name}`);
      } catch (err: any) {
        console.error(err);
        setExtractError('Lỗi trích xuất từ file video: ' + (err?.message || 'Không hỗ trợ định dạng'));
      } finally {
        setIsExtracting(false);
      }
    } else {
      // Normal audio file (mp3, wav, etc.)
      const url = URL.createObjectURL(file);
      setBeatFileUrl(url);
      setBeatFileName(file.name);
      setBeatDuration(null);
    }
  };

  const handleTogglePreview = () => {
    if (!beatFileUrl) return;

    if (isPreviewPlaying && previewAudio) {
      previewAudio.pause();
      setIsPreviewPlaying(false);
    } else {
      if (previewAudio) {
        previewAudio.pause();
      }
      const audio = new Audio(beatFileUrl);
      audio.onended = () => setIsPreviewPlaying(false);
      audio.play().then(() => {
        setPreviewAudio(audio);
        setIsPreviewPlaying(true);
      }).catch(err => {
        console.error('Preview error:', err);
        setIsPreviewPlaying(false);
      });
    }
  };

  const handleResetBeat = () => {
    if (previewAudio) {
      previewAudio.pause();
      setIsPreviewPlaying(false);
    }
    setBeatFileUrl(null);
    setBeatFileName(null);
    setBeatDuration(null);
    setExtractError(null);
  };

  const handleSaveAndAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const lyricsArray = lyricsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newLesson: SongLesson = {
      id: `lesson-${Date.now()}`,
      title: title.trim(),
      gradeLevel,
      category,
      bpm,
      videoType: 'file',
      videoUrl:
        videoFileUrl ||
        customVideoUrl.trim() ||
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      beatAudioUrl: beatFileUrl || undefined,
      lyrics:
        lyricsArray.length > 0
          ? lyricsArray
          : [
              'Sing along with the happy beat,',
              'Clap your hands and stamp your feet!',
              'RoboBuddy loves your sweet song,',
              'Come and sing all day long!',
            ],
      missionTask:
        missionTask.trim() ||
        'Listen to the beat and sing your best into the microphone!',
      thumbnailColor: 'from-pink-500 to-yellow-400',
      createdAt: 'Custom Teacher Assignment',
    };

    onAddLesson(newLesson);
    onSelectAndAssign(newLesson);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border-4 border-yellow-400 p-6 sm:p-8 max-w-3xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black text-2xl shadow-md">
              🍎
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900">
                Teacher Studio • Video & Lesson Creator
              </h2>
              <p className="text-xs font-bold text-zinc-500">
                Upload new song videos and backing beats. Students only see the clean practice mission!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Existing Lessons Manager */}
        <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 uppercase">
              Current Assigned Lessons ({lessons.length}):
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {lessons.map((l) => (
              <div
                key={l.id}
                className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-sm"
              >
                <div className="truncate">
                  <span className="text-xs font-black text-zinc-800 block truncate">
                    🎵 {l.title}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-semibold">
                    {l.gradeLevel} • {l.bpm} BPM
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      onSelectAndAssign(l);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold cursor-pointer transition shadow"
                  >
                    Assign Now
                  </button>
                  {lessons.length > 1 && (
                    <button
                      onClick={() => onDeleteLesson(l.id)}
                      className="p-1 text-zinc-400 hover:text-rose-500 cursor-pointer"
                      title="Delete lesson"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create New Lesson Form */}
        <form onSubmit={handleSaveAndAssign} className="space-y-4">
          <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
            Add New Song & Video for Students:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Song Title */}
            <div>
              <label className="text-xs font-black text-zinc-700 block mb-1">
                Song Title:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Do Re Mi / Wheels on the Bus"
                className="w-full text-sm font-bold text-zinc-800 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none"
              />
            </div>

            {/* Target Grade & Category */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black text-zinc-700 block mb-1">
                  Grade Level:
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full text-xs font-bold text-zinc-800 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none cursor-pointer"
                >
                  <option value="Kindergarten">Kindergarten</option>
                  <option value="Grade 1">Grade 1</option>
                  <option value="Grade 2">Grade 2</option>
                  <option value="Grade 3">Grade 3</option>
                  <option value="Grade 4">Grade 4</option>
                  <option value="Grade 5">Grade 5</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-zinc-700 block mb-1">
                  Tempo (BPM):
                </label>
                <input
                  type="number"
                  min="60"
                  max="160"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="w-full text-xs font-bold text-zinc-800 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Video Upload Section */}
          <div className="p-4 bg-pink-50 rounded-2xl border-2 border-pink-200 space-y-2">
            <span className="text-xs font-black text-pink-900 uppercase flex items-center gap-1.5">
              <Video className="w-4 h-4 text-pink-600" />
              <span>1. Song Video for Students to Watch:</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              {/* File upload */}
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-pink-300 rounded-xl bg-white hover:bg-pink-100/50 transition cursor-pointer text-center">
                <Upload className="w-6 h-6 text-pink-500 mb-1" />
                <span className="text-xs font-bold text-zinc-700">
                  {videoFileName ? videoFileName : 'Upload Video File (MP4, WebM)'}
                </span>
                <span className="text-[10px] text-zinc-400">Drag & drop or click</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileUpload}
                  className="hidden"
                />
              </label>

              {/* Or direct video URL */}
              <div>
                <span className="text-[11px] font-bold text-zinc-500 block mb-1">
                  Or enter video link / URL:
                </span>
                <input
                  type="url"
                  value={customVideoUrl}
                  onChange={(e) => setCustomVideoUrl(e.target.value)}
                  placeholder="https://.../video.mp4"
                  className="w-full text-xs font-medium text-zinc-800 bg-white p-2.5 rounded-xl border border-pink-200 outline-none"
                />
                <span className="text-[10px] text-zinc-400 block mt-1">
                  (Leave empty to use built-in cheerful animated sample video)
                </span>
              </div>
            </div>
          </div>

          {/* Instrumental Beat Upload / Option */}
          <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-300 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-emerald-950 uppercase flex items-center gap-1.5">
                <Music className="w-4 h-4 text-emerald-600" />
                <span>2. Backing Beat (Nhạc đệm / Beat bài hát):</span>
              </span>
              {beatFileUrl && (
                <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Đã cài đặt beat
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
              {/* Option A: Tải file Beat (Hỗ trợ cả Audio & Video) */}
              <div className="flex flex-col justify-between">
                <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-emerald-400 rounded-xl bg-white hover:bg-emerald-100/60 transition cursor-pointer text-center group h-full">
                  <div className="flex items-center gap-2 text-emerald-600 group-hover:scale-110 transition transform mb-1">
                    <Upload className="w-5 h-5" />
                    <Video className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-zinc-800">
                    {beatFileName ? beatFileName : 'Tải Beat hoặc Video (MP3, WAV, MP4, WebM)'}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-1">
                    Hỗ trợ file âm thanh hoặc video (tự động trích xuất beat)
                  </span>
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleBeatFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Option B: Trích xuất Beat trực tiếp từ Video gốc ở Bước 1 */}
              <div className="bg-white p-3 rounded-xl border-2 border-emerald-200 flex flex-col justify-between space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Trích xuất Beat từ Video gốc (Bước 1):
                  </span>
                  {videoFileName && (
                    <span className="text-[10px] font-bold text-zinc-500 truncate max-w-[120px]" title={videoFileName}>
                      {videoFileName}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isExtracting}
                    onClick={() => handleExtractFromStep1Video('original')}
                    className="px-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
                    title="Trích xuất toàn bộ luồng âm thanh gốc từ video ở Bước 1"
                  >
                    {isExtracting && extractionMode === 'original' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Music className="w-3.5 h-3.5" />
                    )}
                    <span>1. Âm thanh gốc</span>
                  </button>

                  <button
                    type="button"
                    disabled={isExtracting}
                    onClick={() => handleExtractFromStep1Video('vocal_reduced')}
                    className="px-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
                    title="Lọc giảm lời hát để giữ lại nhịp trống & nhạc đệm karaoke"
                  >
                    {isExtracting && extractionMode === 'vocal_reduced' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Scissors className="w-3.5 h-3.5" />
                    )}
                    <span>2. Tách lời (Beat)</span>
                  </button>
                </div>

                <p className="text-[10px] text-zinc-500 leading-tight">
                  ✨ <strong>Web Audio Engine:</strong> Bóc tách luồng âm thanh/nhạc nền trực tiếp trong trình duyệt mượt mà.
                </p>
              </div>
            </div>

            {/* Error banner */}
            {extractError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5 font-bold animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{extractError}</span>
              </div>
            )}

            {/* Active Beat Track Preview Player */}
            {beatFileUrl ? (
              <div className="bg-emerald-100/90 p-3 rounded-xl border border-emerald-300 flex flex-wrap items-center justify-between gap-2 animate-fade-in shadow-inner">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleTogglePreview}
                    className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition transform active:scale-95 cursor-pointer shrink-0"
                    title={isPreviewPlaying ? 'Tạm dừng nghe thử' : 'Nghe thử beat'}
                  >
                    {isPreviewPlaying ? (
                      <Pause className="w-4 h-4 fill-white" />
                    ) : (
                      <Play className="w-4 h-4 fill-white translate-x-0.5" />
                    )}
                  </button>
                  <div>
                    <span className="text-xs font-black text-emerald-950 block truncate max-w-[240px] sm:max-w-[360px]">
                      {beatFileName}
                    </span>
                    <span className="text-[10px] text-emerald-800 font-bold block">
                      {isPreviewPlaying ? 'Đang phát nghe thử...' : 'Bấm Play để nghe thử Beat'} {beatDuration ? `• ${beatDuration}s` : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetBeat}
                  className="text-[11px] font-black text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                >
                  Quay lại Beat đàn piano mặc định
                </button>
              </div>
            ) : (
              <div className="text-xs text-emerald-900 bg-white/90 p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Smart Kids Rhythm Engine:</strong> Nếu không tải file hoặc không trích xuất beat, app sẽ tự động đệm hợp âm piano & trống vui nhộn theo BPM {bpm}!
                </span>
              </div>
            )}
          </div>

          {/* Lyrics Input */}
          <div>
            <label className="text-xs font-black text-zinc-700 block mb-1">
              Sing-along Lyrics (each line on a new row):
            </label>
            <textarea
              rows={3}
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Row, row, row your boat&#10;Gently down the stream&#10;Merrily, merrily, merrily, merrily&#10;Life is but a dream"
              className="w-full text-xs font-bold text-zinc-800 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none"
            />
          </div>

          {/* Mission Instruction for kids */}
          <div>
            <label className="text-xs font-black text-zinc-700 block mb-1">
              Mission Instructions for Students:
            </label>
            <input
              type="text"
              value={missionTask}
              onChange={(e) => setMissionTask(e.target.value)}
              className="w-full text-xs font-bold text-zinc-800 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-base shadow-xl shadow-green-300 flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Save & Assign Mission to Students! 🚀</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
