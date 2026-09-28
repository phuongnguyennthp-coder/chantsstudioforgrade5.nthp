import React, { useState, useEffect } from 'react';
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
  Share2,
  Edit,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { SongLesson } from '../types/kidsMusic';
import { extractAudioFromMedia } from '../utils/audioExtractor';
import { ShareLessonModal } from './ShareLessonModal';

interface TeacherStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessons: SongLesson[];
  onAddLesson: (lesson: SongLesson) => void;
  onUpdateLesson: (lesson: SongLesson) => void;
  onDeleteLesson: (id: string) => void;
  onSelectAndAssign: (lesson: SongLesson) => void;
}

export const TeacherStudioModal: React.FC<TeacherStudioModalProps> = ({
  isOpen,
  onClose,
  lessons,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onSelectAndAssign,
}) => {
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [selectedDropdownLessonId, setSelectedDropdownLessonId] = useState<string>(
    lessons[0]?.id || ''
  );

  const [title, setTitle] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Grade 5');
  const [category, setCategory] = useState('Vocal Melody & Rhythm');
  const [bpm, setBpm] = useState(90);
  const [lyricsText, setLyricsText] = useState('');
  const [missionTask, setMissionTask] = useState(
    'Watch the video carefully, practice singing along with the drum beat, and record your joyful voice!'
  );

  // Dual-mode lyrics: 'text' or 'karaoke_video'
  const [lyricsMode, setLyricsMode] = useState<'text' | 'karaoke_video'>('text');
  const [karaokeVideoUrl, setKaraokeVideoUrl] = useState('');
  const [karaokeVideoFileName, setKaraokeVideoFileName] = useState<string | null>(null);
  const [karaokeCustomUrl, setKaraokeCustomUrl] = useState('');

  // Video and audio files / URLs for Step 1
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoFileObj, setVideoFileObj] = useState<File | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  // Beat audio for Step 2
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

  // Heyzine Share modal state
  const [sharingLesson, setSharingLesson] = useState<SongLesson | null>(null);

  // Keep dropdown selection synchronized if lessons change
  useEffect(() => {
    if (lessons.length > 0 && !lessons.some((l) => l.id === selectedDropdownLessonId)) {
      setSelectedDropdownLessonId(lessons[0].id);
    }
  }, [lessons, selectedDropdownLessonId]);

  if (!isOpen) return null;

  const selectedDropdownLesson = lessons.find((l) => l.id === selectedDropdownLessonId) || lessons[0];

  const handleStartEditLesson = (lessonToEdit: SongLesson) => {
    setEditingLessonId(lessonToEdit.id);
    setTitle(lessonToEdit.title);
    setGradeLevel(lessonToEdit.gradeLevel || 'Grade 5');
    setCategory(lessonToEdit.category || 'Vocal Melody & Rhythm');
    setBpm(lessonToEdit.bpm || 90);
    setMissionTask(lessonToEdit.missionTask || '');

    // Video
    setVideoFileUrl(lessonToEdit.videoUrl || null);
    setCustomVideoUrl(lessonToEdit.videoUrl || '');
    setVideoFileName(lessonToEdit.title ? `Video • ${lessonToEdit.title}` : null);
    setVideoFileObj(null);

    // Beat
    setBeatFileUrl(lessonToEdit.beatAudioUrl || null);
    setBeatFileName(lessonToEdit.beatAudioUrl ? `Beat • ${lessonToEdit.title}` : null);

    // Lyrics & Karaoke
    setLyricsMode(lessonToEdit.lyricsMode || 'text');
    setLyricsText((lessonToEdit.lyrics || []).join('\n'));
    setKaraokeVideoUrl(lessonToEdit.karaokeVideoUrl || '');
    setKaraokeCustomUrl(lessonToEdit.karaokeVideoUrl || '');
    setKaraokeVideoFileName(lessonToEdit.karaokeVideoUrl ? 'Video Karaoke đã lưu' : null);
  };

  const handleCancelEdit = () => {
    setEditingLessonId(null);
    handleResetForm();
  };

  const handleResetForm = () => {
    setTitle('');
    setGradeLevel('Grade 5');
    setCategory('Vocal Melody & Rhythm');
    setBpm(90);
    setLyricsText('');
    setLyricsMode('text');
    setKaraokeVideoUrl('');
    setKaraokeCustomUrl('');
    setKaraokeVideoFileName(null);
    setMissionTask(
      'Watch the video carefully, practice singing along with the drum beat, and record your joyful voice!'
    );
    setVideoFileUrl(null);
    setVideoFileName(null);
    setVideoFileObj(null);
    setCustomVideoUrl('');
    setBeatFileUrl(null);
    setBeatFileName(null);
    setBeatDuration(null);
    setExtractError(null);
  };

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

  const handleKaraokeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setKaraokeVideoUrl(url);
      setKaraokeVideoFileName(file.name);
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
      audio
        .play()
        .then(() => {
          setPreviewAudio(audio);
          setIsPreviewPlaying(true);
        })
        .catch((err) => {
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

    const activeKaraokeUrl = karaokeVideoUrl || karaokeCustomUrl.trim();
    const explicitVideo = videoFileUrl || customVideoUrl.trim();

    if (editingLessonId) {
      // Update existing lesson
      const original = lessons.find((l) => l.id === editingLessonId);
      const finalVideo =
        explicitVideo ||
        activeKaraokeUrl ||
        original?.videoUrl ||
        original?.karaokeVideoUrl ||
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      const finalKaraoke =
        activeKaraokeUrl ||
        explicitVideo ||
        original?.karaokeVideoUrl ||
        original?.videoUrl ||
        finalVideo;

      const updatedLesson: SongLesson = {
        id: editingLessonId,
        title: title.trim(),
        gradeLevel,
        category,
        bpm,
        videoType: 'file',
        videoUrl: finalVideo,
        beatAudioUrl: beatFileUrl || original?.beatAudioUrl,
        lyricsMode,
        karaokeVideoUrl: finalKaraoke,
        lyrics:
          lyricsArray.length > 0
            ? lyricsArray
            : original?.lyrics || [
                'Sing along with the happy beat,',
                'Clap your hands and stamp your feet!',
              ],
        missionTask:
          missionTask.trim() || 'Listen to the beat and sing your best into the microphone!',
        thumbnailColor: original?.thumbnailColor || 'from-pink-500 to-yellow-400',
        createdAt: original?.createdAt || 'Updated Unit',
      };

      onUpdateLesson(updatedLesson);
      onSelectAndAssign(updatedLesson);
      setEditingLessonId(null);
      handleResetForm();
      setSharingLesson(updatedLesson);
    } else {
      // Create new lesson
      const finalVideo =
        explicitVideo ||
        activeKaraokeUrl ||
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      const finalKaraoke = activeKaraokeUrl || explicitVideo || finalVideo;

      const newLesson: SongLesson = {
        id: `lesson-${Date.now()}`,
        title: title.trim(),
        gradeLevel,
        category,
        bpm,
        videoType: 'file',
        videoUrl: finalVideo,
        beatAudioUrl: beatFileUrl || undefined,
        lyricsMode,
        karaokeVideoUrl: finalKaraoke,
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
      handleResetForm();
      setSharingLesson(newLesson);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border-4 border-yellow-400 p-6 sm:p-8 max-w-3xl w-full shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-6">
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
                Quản lý các Unit bài học, tải video beat và tạo bài tập cho học sinh!
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

        {/* SECTION A: Dropdown Select Units & Overview */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5 rounded-2xl border-2 border-amber-300 space-y-3 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <label className="text-xs font-black text-amber-950 uppercase">
                Danh sách bài đã giao trên App:
              </label>
            </div>
            <span className="text-xs font-black text-amber-900 bg-amber-200/90 px-3 py-1 rounded-full shadow-sm">
              Đã giao: {lessons.length} Units 🌟
            </span>
          </div>

          {/* Dropdown Select Box */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <select
              value={selectedDropdownLessonId}
              onChange={(e) => setSelectedDropdownLessonId(e.target.value)}
              className="flex-1 bg-white border-2 border-amber-300 text-xs font-black text-zinc-800 rounded-xl p-3 outline-none shadow-sm focus:border-amber-500 cursor-pointer"
            >
              {lessons.map((l, idx) => (
                <option key={l.id} value={l.id}>
                  Unit {idx + 1}: {l.title} ({l.bpm} BPM) • {l.lyricsMode === 'karaoke_video' ? '🎬 Video Karaoke' : '📝 Lời text'}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Action Card for Selected Unit */}
          {selectedDropdownLesson && (
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-pink-700 block">
                  🎵 {selectedDropdownLesson.title}
                </span>
                <span className="text-[10px] text-zinc-500 font-semibold block">
                  {selectedDropdownLesson.gradeLevel} • {selectedDropdownLesson.bpm} BPM •{' '}
                  {selectedDropdownLesson.lyricsMode === 'karaoke_video'
                    ? '🎬 Video Karaoke'
                    : `📝 ${selectedDropdownLesson.lyrics.length} câu lời hát`}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    onSelectAndAssign(selectedDropdownLesson);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-sm transition cursor-pointer"
                  title="Dạy và hiển thị bài này ngay cho học sinh"
                >
                  👉 Dạy bài này ngay
                </button>

                <button
                  type="button"
                  onClick={() => handleStartEditLesson(selectedDropdownLesson)}
                  className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-black shadow-sm transition cursor-pointer flex items-center gap-1"
                  title="Chỉnh sửa nội dung Unit này"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSharingLesson(selectedDropdownLesson)}
                  className="px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-sm transition cursor-pointer flex items-center gap-1"
                  title="Xuất Link Heyzine cho Unit này"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Xuất Heyzine</span>
                </button>

                {lessons.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteLesson(selectedDropdownLesson.id)}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition"
                    title="Xóa Unit này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECTION B: Lesson Form (Add New OR Edit Existing) */}
        <form onSubmit={handleSaveAndAssign} className="space-y-4 pt-2 border-t-2 border-zinc-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-black text-zinc-900 uppercase tracking-wide flex items-center gap-2">
              <span>{editingLessonId ? '✏️ CHỈNH SỬA BÀI HỌC (EDIT LESSON):' : '➕ THÊM BÀI HỌC MỚI (ADD NEW SONG):'}</span>
            </h3>

            {editingLessonId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline cursor-pointer"
              >
                Hủy chế độ sửa (Tạo bài mới)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Song Title */}
            <div>
              <label className="text-xs font-black text-zinc-700 block mb-1">
                Tên Bài Hát (Song Title / Unit):
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Unit 1 All about me"
                className="w-full text-sm font-bold text-zinc-800 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none"
              />
            </div>

            {/* Target Grade & Category */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black text-zinc-700 block mb-1">
                  Khối Lớp:
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full text-xs font-bold text-zinc-800 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none cursor-pointer"
                >
                  <option value="Grade 1">Grade 1</option>
                  <option value="Grade 2">Grade 2</option>
                  <option value="Grade 3">Grade 3</option>
                  <option value="Grade 4">Grade 4</option>
                  <option value="Grade 5">Grade 5</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-zinc-700 block mb-1">
                  Tốc độ (BPM):
                </label>
                <input
                  type="number"
                  min={50}
                  max={180}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-full text-xs font-bold text-zinc-800 bg-zinc-50 p-3 rounded-xl border-2 border-zinc-200 focus:border-pink-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 1. Song Video Section */}
          <div className="bg-pink-50/60 p-4 rounded-2xl border-2 border-pink-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs font-black text-pink-900 uppercase flex items-center gap-1.5">
                <Video className="w-4 h-4 text-pink-600" />
                <span>1. Video Bài Hát Mẫu (Song Video):</span>
              </span>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                📱 Xem được trên Điện Thoại & Tablet
              </span>
            </div>

            {/* Device Compatibility Tip */}
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
              <span className="text-base leading-none">💡</span>
              <div className="text-[11px] leading-tight space-y-0.5">
                <span className="font-bold text-amber-950 block">Để học sinh xem được video trên mọi thiết bị (Điện thoại, iPad/Tablet, Máy tính):</span>
                <span className="text-zinc-600 block">
                  Khuyên dùng <b>Link YouTube</b> hoặc <b>Link Google Drive</b> (chọn quyền <i>"Bất kỳ ai có đường liên kết đều có thể xem"</i>). Nếu tải file từ máy tính thì video chỉ xem được trên chính máy này.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Upload local video */}
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-pink-300 rounded-xl bg-white hover:bg-pink-50 transition cursor-pointer text-center">
                <Upload className="w-6 h-6 text-pink-500 mb-1" />
                <span className="text-xs font-bold text-zinc-700">
                  {videoFileName ? videoFileName : 'Tải video từ máy (MP4, WebM)'}
                </span>
                <span className="text-[10px] text-zinc-400">Xem thử trên máy tính giáo viên</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileUpload}
                  className="hidden"
                />
              </label>

              {/* Option B: Enter URL */}
              <div className="flex flex-col justify-center space-y-1">
                <label className="text-[11px] font-bold text-zinc-700 flex items-center justify-between">
                  <span>Hoặc dán Link YouTube / Google Drive:</span>
                  <span className="text-[10px] text-pink-600 font-extrabold">Khuyên dùng ⭐</span>
                </label>
                <input
                  type="url"
                  placeholder="Link YouTube hoặc link Google Drive (hoặc file .mp4)"
                  value={customVideoUrl}
                  onChange={(e) => {
                    setCustomVideoUrl(e.target.value);
                    if (e.target.value.trim()) {
                      setVideoFileName('Link: ' + e.target.value.trim());
                    }
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 outline-none focus:border-pink-500 bg-white font-mono"
                />
                <span className="text-[10px] text-zinc-400">
                  (Hỗ trợ YouTube, YouTube Shorts, Google Drive, Dropbox)
                </span>
              </div>
            </div>
          </div>

          {/* 2. Backing Beat Section */}
          <div className="bg-emerald-50/70 p-4 rounded-2xl border-2 border-emerald-300 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-900 uppercase flex items-center gap-1.5">
                <Music className="w-4 h-4 text-emerald-600" />
                <span>2. Backing Beat (Nhạc Đệm / Beat Bài Hát):</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Upload Beat File */}
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-300 rounded-xl bg-white hover:bg-emerald-50 transition cursor-pointer text-center">
                <div className="flex gap-1 items-center mb-1">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  <Video className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-xs font-black text-emerald-800">
                  Tải Beat hoặc Video (MP3, WAV, MP4, WebM)
                </span>
                <span className="text-[10px] text-zinc-500">
                  Hỗ trợ file âm thanh hoặc video (tự động trích xuất beat)
                </span>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleBeatFileUpload}
                  className="hidden"
                />
              </label>

              {/* Option B: Extract Beat directly from Step 1's Video */}
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
                      {isPreviewPlaying ? 'Đang phát nghe thử...' : 'Bấm Play để nghe thử Beat'}{' '}
                      {beatDuration ? `• ${beatDuration}s` : ''}
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

          {/* 3. Sing-Along Lyrics OR Karaoke Video Selection */}
          <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50 p-4 sm:p-5 rounded-2xl border-2 border-pink-300 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black text-pink-900 uppercase flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-pink-600" />
                <span>3. Lời Bài Hát Cho Học Sinh (Có 2 Sự Lựa Chọn: Text Hoặc Đăng Video):</span>
              </span>
            </div>

            {/* Toggle Mode: Text Lyrics vs Karaoke Video */}
            <div className="grid grid-cols-2 gap-2 bg-white/80 p-1.5 rounded-xl border border-pink-200">
              <button
                type="button"
                onClick={() => setLyricsMode('text')}
                className={`py-2 px-3 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  lyricsMode === 'text'
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-pink-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📝 Lựa chọn 1: Chọn Text (Lời văn bản)</span>
              </button>

              <button
                type="button"
                onClick={() => setLyricsMode('karaoke_video')}
                className={`py-2 px-3 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  lyricsMode === 'karaoke_video'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-purple-50'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>🎬 Lựa chọn 2: Chọn Đăng Video (Karaoke có lời)</span>
              </button>
            </div>

            {lyricsMode === 'text' ? (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-zinc-700 block">
                  Nhập lời bài hát (mỗi câu một dòng):
                </label>
                <textarea
                  rows={4}
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  placeholder="Row, row, row your boat&#10;Gently down the stream&#10;Merrily, merrily, merrily, merrily&#10;Life is but a dream"
                  className="w-full text-xs font-bold text-zinc-800 bg-white p-3 rounded-xl border-2 border-pink-200 focus:border-pink-500 outline-none leading-relaxed"
                />
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in bg-white p-3.5 rounded-xl border border-purple-200">
                <p className="text-xs font-bold text-purple-900">
                  🎬 Chèn video có chữ karaoke chạy để học sinh vừa nhìn màn hình vừa hát thực hành:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Karaoke Video Upload */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                      Tải file Video Karaoke từ máy (MP4, WebM):
                    </label>
                    <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-purple-300 rounded-xl bg-purple-50/50 hover:bg-purple-100/50 transition cursor-pointer text-center">
                      <Upload className="w-5 h-5 text-purple-600 mb-1" />
                      <span className="text-xs font-bold text-zinc-800">
                        {karaokeVideoFileName || 'Chọn video karaoke từ máy'}
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleKaraokeFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Karaoke YouTube or Google Drive Link */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 flex items-center justify-between mb-1">
                      <span>Dán Link YouTube / Google Drive:</span>
                      <span className="text-[10px] text-purple-600 font-extrabold">Khuyên dùng ⭐</span>
                    </label>
                    <input
                      type="url"
                      placeholder="Link YouTube hoặc Google Drive Karaoke"
                      value={karaokeCustomUrl}
                      onChange={(e) => {
                        setKaraokeCustomUrl(e.target.value);
                        setKaraokeVideoUrl(e.target.value);
                      }}
                      className="w-full text-xs font-bold text-zinc-800 bg-zinc-50 p-2.5 rounded-xl border border-zinc-300 focus:border-purple-500 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500 block mt-1">
                      Hỗ trợ YouTube, YouTube Shorts, Google Drive. Xem mượt 100% trên Điện thoại & Tablet!
                    </span>
                  </div>
                </div>

                {(karaokeVideoUrl || karaokeCustomUrl) && (
                  <div className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      Đã chọn Video Karaoke: {karaokeVideoFileName || karaokeCustomUrl}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mission Instruction for kids */}
          <div>
            <label className="text-xs font-black text-zinc-700 block mb-1">
              Lời Dặn Dò / Nhiệm Vụ Cho Học Sinh (Mission Task):
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
              <span>{editingLessonId ? 'Lưu Thay Đổi Bài Học! 💾' : 'Lưu & Giao Nhiệm Vụ Cho Học Sinh! 🚀'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Heyzine Share Link / Embed Code Modal */}
      {sharingLesson && (
        <ShareLessonModal
          isOpen={!!sharingLesson}
          onClose={() => {
            setSharingLesson(null);
            onClose();
          }}
          lesson={sharingLesson}
        />
      )}
    </div>
  );
};
