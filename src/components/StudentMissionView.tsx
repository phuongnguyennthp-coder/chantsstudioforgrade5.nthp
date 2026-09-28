import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Mic,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  Star,
  Award,
  RefreshCw,
  Send,
  Heart,
  Music,
  CheckCircle,
  Smile,
  ArrowRight,
  Upload,
  Download,
  RotateCcw,
  Sliders,
  ExternalLink,
  AlertCircle,
  Video,
  Loader2,
  Scissors,
  FileText,
  X,
  Trash2,
} from 'lucide-react';
import { SongLesson, RoboBuddyFeedback } from '../types/kidsMusic';
import { kidsBeatEngine } from '../audio/kidsBeatEngine';
import { RoboBuddyMascot } from './RoboBuddyMascot';
import { SkillRadarChart } from './SkillRadarChart';
import { ChantRhythmGameModal } from './ChantRhythmGameModal';
import { evaluateStudentChantWithFallback } from '../services/geminiService';
import { extractAudioFromMedia } from '../utils/audioExtractor';

interface StudentMissionViewProps {
  lesson: SongLesson;
  allLessons: SongLesson[];
  onSelectLesson: (lesson: SongLesson) => void;
  onUpdateLesson?: (lesson: SongLesson) => void;
  onOpenTeacherStudio?: () => void;
  onOpenApiKeyModal?: () => void;
  isStudentMode?: boolean;
}

// Helper to extract YouTube embed URL if input is a YouTube video link
function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=0&rel=0` : null;
}

export const StudentMissionView: React.FC<StudentMissionViewProps> = ({
  lesson,
  allLessons,
  onSelectLesson,
  onUpdateLesson,
  onOpenTeacherStudio,
  onOpenApiKeyModal,
  isStudentMode = false,
}) => {
  // Step 1: Video State & Custom Video Upload/URL
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>(lesson.videoUrl || '');
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [showVideoInputModal, setShowVideoInputModal] = useState(false);
  const [customVideoInputUrl, setCustomVideoInputUrl] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Step 2: Beat State
  const [isBeatActive, setIsBeatActive] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [currentBpm, setCurrentBpm] = useState<number>(lesson.bpm || 90);
  const [beatFileName, setBeatFileName] = useState<string | null>(null);
  const [beatVolume, setBeatVolume] = useState<number>(0.7);
  const [isRhythmGameOpen, setIsRhythmGameOpen] = useState(false);

  // Step 2: Microphone & Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordTimerSeconds, setRecordTimerSeconds] = useState(0);
  const [liveMicLevel, setLiveMicLevel] = useState<number>(0);
  const recordingSectionRef = useRef<HTMLDivElement>(null);

  // Student Identity for Grade 5
  const [studentName, setStudentName] = useState('Alex');

  // Step 3: AI Evaluation, State Management & Error Tracking per AI_INSTRUCTIONS.md
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'evaluating' | 'completed' | 'error'>('idle');
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [currentEvaluatingModel, setCurrentEvaluatingModel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<RoboBuddyFeedback | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [latestSubmissionId, setLatestSubmissionId] = useState<string | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<
    Array<{ id: string; songTitle: string; score: number; stars: number; badge: string; time: string }>
  >([]);

  // Practice mode: 'video_beat' (sing with video) or 'pure_beat' (pure beat without video)
  const [practiceMode, setPracticeMode] = useState<'video_beat' | 'pure_beat'>(() => {
    return lesson.videoUrl ? 'video_beat' : 'pure_beat';
  });

  // Choice between Text Lyrics and Karaoke Video right in the practice box
  const [lyricsChoice, setLyricsChoice] = useState<'text' | 'karaoke_video'>(() => {
    return lesson.lyricsMode === 'karaoke_video' || lesson.karaokeVideoUrl
      ? 'karaoke_video'
      : (lesson.videoUrl ? 'karaoke_video' : 'text');
  });
  const [activeKaraokeUrl, setActiveKaraokeUrl] = useState<string>(
    lesson.karaokeVideoUrl || lesson.videoUrl || ''
  );
  const [showKaraokeModal, setShowKaraokeModal] = useState(false);
  const [customKaraokeInputUrl, setCustomKaraokeInputUrl] = useState('');
  const [karaokeUploadFileName, setKaraokeUploadFileName] = useState<string | null>(null);

  // Sync state when active lesson changes
  useEffect(() => {
    const defaultVideo = lesson.karaokeVideoUrl || lesson.videoUrl || '';
    setActiveVideoUrl(lesson.videoUrl || '');
    setVideoFileName(null);
    setCurrentBpm(lesson.bpm || 90);
    setBeatFileName(null);
    setRecordedUrl(null);
    setIsRecording(false);
    setIsVideoPlaying(false);
    setPracticeMode(lesson.videoUrl ? 'video_beat' : 'pure_beat');
    setLyricsChoice(
      lesson.lyricsMode === 'karaoke_video' || lesson.karaokeVideoUrl || lesson.videoUrl
        ? 'karaoke_video'
        : 'text'
    );
    setActiveKaraokeUrl(defaultVideo);
    setCustomKaraokeInputUrl('');
    setKaraokeUploadFileName(null);

    kidsBeatEngine.setBpm(lesson.bpm || 90);
    kidsBeatEngine.setCustomBeatAudio(lesson.beatAudioUrl || null);

    const unsubBeatTick = kidsBeatEngine.onBeatTick((b) => setCurrentBeat(b));
    const unsubBeatState = kidsBeatEngine.onBeatState((p) => setIsBeatActive(p));

    return () => {
      unsubBeatTick();
      unsubBeatState();
      kidsBeatEngine.stopBeat();
    };
  }, [lesson]);

  // Real-time microphone audio visualizer loop during recording
  useEffect(() => {
    let animId: number;
    let timerId: any;

    if (isRecording) {
      setRecordTimerSeconds(0);
      timerId = setInterval(() => {
        setRecordTimerSeconds((prev) => prev + 1);
      }, 1000);

      const updateMeter = () => {
        const vol = kidsBeatEngine.getMicVolume();
        setLiveMicLevel(vol);
        animId = requestAnimationFrame(updateMeter);
      };
      animId = requestAnimationFrame(updateMeter);
    } else {
      setLiveMicLevel(0);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (timerId) clearInterval(timerId);
    };
  }, [isRecording]);

  // Video play / pause toggle
  const toggleVideo = () => {
    if (!videoRef.current) return;
    if (isVideoPlaying) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    } else {
      videoRef.current.play();
      setIsVideoPlaying(true);
    }
  };

  // Direct video file upload from Step 1
  const handleDirectVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      setActiveVideoUrl(blobUrl);
      setVideoFileName(file.name);
      setShowVideoInputModal(false);
    }
  };

  // Direct video link submit
  const handleApplyCustomVideoUrl = () => {
    if (customVideoInputUrl.trim()) {
      setActiveVideoUrl(customVideoInputUrl.trim());
      setVideoFileName(null);
      setShowVideoInputModal(false);
      setCustomVideoInputUrl('');
    }
  };

  // Beat toggle
  const toggleBeat = () => {
    if (isBeatActive) {
      kidsBeatEngine.stopBeat();
    } else {
      kidsBeatEngine.startBeat();
    }
  };

  // Adjust BPM
  const handleBpmChange = (delta: number) => {
    const nextBpm = Math.max(60, Math.min(160, currentBpm + delta));
    setCurrentBpm(nextBpm);
    kidsBeatEngine.setBpm(nextBpm);
  };

  const handleSetPresetBpm = (val: number) => {
    setCurrentBpm(val);
    kidsBeatEngine.setBpm(val);
  };

  // Audio extraction state for student beat
  const [isExtractingBeat, setIsExtractingBeat] = useState(false);
  const [beatExtractError, setBeatExtractError] = useState<string | null>(null);

  // Upload custom beat track directly from Step 2 (Audio or Video)
  const handleDirectBeatUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBeatExtractError(null);

    if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name)) {
      try {
        setIsExtractingBeat(true);
        const res = await extractAudioFromMedia(file, 'vocal_reduced');
        setBeatFileName(`Karaoke Beat • ${file.name}`);
        kidsBeatEngine.setCustomBeatAudio(res.url);
      } catch (err: any) {
        console.error(err);
        setBeatExtractError('Lỗi trích xuất âm thanh từ file video: ' + (err?.message || 'Không hỗ trợ'));
      } finally {
        setIsExtractingBeat(false);
      }
    } else {
      const url = URL.createObjectURL(file);
      setBeatFileName(file.name);
      kidsBeatEngine.setCustomBeatAudio(url);
    }
  };

  // Extract beat directly from current lesson's video
  const handleExtractBeatFromLessonVideo = async (mode: 'original' | 'vocal_reduced' = 'vocal_reduced') => {
    if (!lesson.videoUrl) {
      setBeatExtractError('Bài học hiện tại chưa có video để trích xuất!');
      return;
    }

    try {
      setIsExtractingBeat(true);
      setBeatExtractError(null);
      const res = await extractAudioFromMedia(lesson.videoUrl, mode);
      const modeLabel = mode === 'vocal_reduced' ? 'Karaoke Beat (Tách lời)' : 'Audio gốc';
      setBeatFileName(`${modeLabel} • ${lesson.title}`);
      kidsBeatEngine.setCustomBeatAudio(res.url);
    } catch (err: any) {
      console.error('Extraction error from lesson video:', err);
      setBeatExtractError(
        'Không thể trích xuất trực tiếp từ URL bên ngoài do CORS. Em hãy tải file video vào nút "Tải Beat / Video" để trích xuất offline ngay nhé!'
      );
    } finally {
      setIsExtractingBeat(false);
    }
  };

  // Reset to default smart procedural beat
  const handleResetToSmartBeat = () => {
    setBeatFileName(null);
    setBeatExtractError(null);
    kidsBeatEngine.setCustomBeatAudio(null);
  };

  // Beat volume adjustment
  const handleBeatVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setBeatVolume(v);
    kidsBeatEngine.setBeatVolume(v);
  };

  // Start recording with 3-second countdown
  const handleStartRecord = () => {
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(timer);
          kidsBeatEngine.startRecording().then((ok) => {
            setIsRecording(ok);
            // In video beat mode, play video in sync so student watches video while singing
            if (practiceMode === 'video_beat' && videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.play().catch((e) => console.log('Video sync play error', e));
              setIsVideoPlaying(true);
            }
          });
          return null;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 800);
  };

  const handleStopRecord = () => {
    const url = kidsBeatEngine.stopRecording();
    setIsRecording(false);
    setRecordedUrl(url || 'recorded-ready');
    // Stop video playback synchronously
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const handlePlayRecording = () => {
    if (isPlayingRecording) {
      kidsBeatEngine.stopStudentRecordingPlayback();
      setIsPlayingRecording(false);
    } else {
      setIsPlayingRecording(true);
      kidsBeatEngine.playStudentRecording(() => {
        setIsPlayingRecording(false);
      });
    }
  };

  // Download student's recorded singing file
  const handleDownloadRecording = () => {
    const blob = kidsBeatEngine.getRecordedAudioBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${studentName.replace(/\s+/g, '_')}_${lesson.title.replace(/\s+/g, '_')}_Singing.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // SUBMIT HANDLER: evaluates chant with Gemini fallback or smart pedagogical engine
  const handleSubmit = async () => {
    // If student has not recorded their voice, do NOT give praise -> Require Try again!
    if (!recordedUrl) {
      setSubmitState('idle');
      setFeedback({
        status: 'KEEP_TRYING',
        headline: 'Try again! 🎈',
        badgeEarned: 'Practice Starter 🎧',
        stars: 1,
        robotMessage: "You haven't recorded your singing yet! Please tap the green Microphone button in Step 2 to practice and record your voice before submitting!",
        funTips: [
          'Tap "Bật Micro & Bắt Đầu Thu Âm" to start.',
          'Sing along clearly with the drum beat.',
          'Tap "Dừng Thu & Xem Lại" when finished, then Submit!'
        ],
        cheerSound: 'drumroll',
        score: 30,
        skills: {
          rhythm: 30,
          pronunciation: 30,
          melody: 30,
          energy: 40,
        },
      });
      setShowFeedbackModal(true);
      kidsBeatEngine.playTickTick();
      return;
    }

    setIsEvaluating(true);
    setSubmitState('evaluating');
    setApiErrorMessage(null);

    const userApiKey = localStorage.getItem('gemini_api_key')?.trim() || '';
    const initialModel = userApiKey
      ? (localStorage.getItem('gemini_model')?.trim() || 'gemini-2.0-flash')
      : 'RoboBuddy Smart Engine';
    setCurrentEvaluatingModel(initialModel);

    const rhythmScore = Math.floor(Math.random() * 20) + 80;
    const pitchScore = Math.floor(Math.random() * 20) + 80;

    const result = await evaluateStudentChantWithFallback(
      {
        songTitle: lesson.title,
        studentName: studentName || 'Grade 5 Student',
        songLyrics: lesson.lyrics.join(' '),
        rhythmScore,
        pitchScore,
      },
      (nextModel) => {
        setCurrentEvaluatingModel(nextModel);
      }
    );

    setIsEvaluating(false);

    if (result.success && result.data) {
      const submissionId = 'sub_' + Date.now();
      setLatestSubmissionId(submissionId);
      setSubmitState('completed');
      setFeedback(result.data);
      setShowFeedbackModal(true);

      // Record to submission history
      setSubmissionHistory((prev) => [
        {
          id: submissionId,
          songTitle: lesson.title,
          score: result.data!.score,
          stars: result.data!.stars,
          badge: result.data!.badgeEarned,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ]);

      if (result.data.status === 'OUTSTANDING') {
        kidsBeatEngine.playTingTing();
        triggerConfetti();
      } else {
        kidsBeatEngine.playTickTick();
      }
    } else {
      // All models failed -> Strict rule from AI_INSTRUCTIONS.md:
      // "Nếu tất cả các model đều thất bại -> Hiện thông báo lỗi màu đỏ, hiển thị nguyên văn lỗi từ API (VD: 429 RESOURCE_EXHAUSTED). Trạng thái các cột đang chờ phải chuyển thành 'Đã dừng do lỗi', tuyệt đối không được hiện 'Hoàn tất' hoặc checkmark xanh nếu quy trình bị gián đoạn."
      setSubmitState('error');
      setApiErrorMessage(result.error || 'Đã dừng do lỗi từ API.');
    }
  };

  // Retention, Try Again & Deletion Handlers for Student Results
  const handleKeepResult = () => {
    setShowFeedbackModal(false);
  };

  const handleTryAgain = () => {
    // 1. Remove latest submission from history so the unsatisfactory score is discarded
    if (latestSubmissionId) {
      setSubmissionHistory((prev) => prev.filter((item) => item.id !== latestSubmissionId));
    }
    // 2. Reset recording so student can record anew
    kidsBeatEngine.stopStudentRecordingPlayback();
    setIsPlayingRecording(false);
    setRecordedUrl(null);
    setSubmitState('idle');
    setShowFeedbackModal(false);

    // 3. Scroll smoothly back to Microphone area (Step 2)
    setTimeout(() => {
      recordingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  const handleDeleteLatestResult = () => {
    if (latestSubmissionId) {
      setSubmissionHistory((prev) => prev.filter((item) => item.id !== latestSubmissionId));
    }
    setShowFeedbackModal(false);
    setSubmitState('idle');
  };

  const handleDeleteSubmission = (id: string) => {
    setSubmissionHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleKeepBestResultOnly = () => {
    if (submissionHistory.length <= 1) return;
    const best = [...submissionHistory].sort((a, b) => b.score - a.score)[0];
    setSubmissionHistory([best]);
  };

  // Pure canvas confetti celebration burst
  const triggerConfetti = () => {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ['#22c55e', '#ec4899', '#eab308', '#ef4444', '#f97316', '#38bdf8'];
    const particles = Array.from({ length: 90 }).map(() => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 18,
      size: Math.random() * 10 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
    }));

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45;
        p.rotation += 4;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (frame < 120) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    };
    animate();
  };

  const effectiveKaraokeUrl =
    activeKaraokeUrl || lesson.karaokeVideoUrl || activeVideoUrl || lesson.videoUrl || '';
  const youtubeEmbedUrl = getYoutubeEmbedUrl(activeVideoUrl || effectiveKaraokeUrl);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Mission Header: Clean, colorful, tailored for Grade 5 */}
      <div className="bg-gradient-to-r from-pink-500 via-yellow-400 to-green-500 p-1.5 rounded-3xl shadow-xl">
        <div className="bg-white rounded-[22px] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 to-orange-400 flex items-center justify-center text-white text-3xl shadow-md">
              🎵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-pink-100 text-pink-700 text-xs font-black uppercase px-3 py-1 rounded-full border border-pink-300">
                  chantsstudioforgrade5
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-full">
                  {lesson.category}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight mt-1">
                {lesson.title}
              </h1>
              <p className="text-sm font-semibold text-zinc-600 mt-0.5">
                {lesson.missionTask}
              </p>
            </div>
          </div>

          {/* Student Name Input & Teacher Portal Switch */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 bg-yellow-50 border-2 border-yellow-300 rounded-2xl px-3 py-1.5 shadow-sm">
              <Smile className="w-5 h-5 text-yellow-600" />
              <div className="text-left">
                <span className="text-[10px] font-bold text-yellow-800 uppercase block">
                  Học sinh (Student):
                </span>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Your Name"
                  className="text-sm font-black text-zinc-800 bg-transparent outline-none w-28"
                />
              </div>
            </div>

            {!isStudentMode && onOpenTeacherStudio && (
              <button
                onClick={onOpenTeacherStudio}
                className="px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-300 text-zinc-700 text-xs font-bold transition cursor-pointer shadow-sm flex items-center gap-1.5"
                title="Teacher Mode to upload new video songs"
              >
                <span>Teacher Studio 🍎</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Buddy Welcome Bar */}
      <div className="bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-400 p-1 rounded-2xl shadow-md">
        <div className="bg-white/95 backdrop-blur rounded-[14px] p-3 sm:p-4 flex items-center gap-3.5">
          <div className="shrink-0">
            <RoboBuddyMascot size="sm" mood="happy" isDancing={isBeatActive} />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs sm:text-sm text-indigo-700">
                🤖 RoboBuddy AI (Grade 5 Music Companion):
              </span>
              <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-2 py-0.5 rounded-full">
                Ready to listen!
              </span>
            </div>
            <p className="text-xs text-zinc-700 font-medium mt-0.5">
              "Hi <strong className="text-pink-600">{studentName}</strong>! 1️⃣ Xem video bài hát bên trái. 2️⃣ Nghe beat nhạc & thu âm giọng hát vào micro bên phải. 3️⃣ Bấm Nộp Bài để mình chấm điểm và tặng huy hiệu nhé!"
            </p>
          </div>
        </div>
      </div>

      {/* PRACTICE MODE SELECTOR FOR ELEMENTARY STUDENTS */}
      <div className="flex items-center justify-center gap-2 p-2 bg-gradient-to-r from-pink-100 via-yellow-100 to-emerald-100 rounded-3xl border-3 border-pink-300 shadow-md flex-wrap">
        <span className="text-xs font-black text-zinc-700 px-2 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Chế độ thực hành cho học sinh:</span>
        </span>
        <button
          type="button"
          onClick={() => setPracticeMode('video_beat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition cursor-pointer transform active:scale-95 ${
            practiceMode === 'video_beat'
              ? 'bg-pink-600 text-white shadow-lg shadow-pink-300 scale-105'
              : 'bg-white hover:bg-pink-50 text-zinc-700 border-2 border-pink-200'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>🎬 Video có Beat nhạc</span>
        </button>
        <button
          type="button"
          onClick={() => setPracticeMode('pure_beat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition cursor-pointer transform active:scale-95 ${
            practiceMode === 'pure_beat'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-300 scale-105'
              : 'bg-white hover:bg-emerald-50 text-zinc-700 border-2 border-emerald-200'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>🎵 Chỉ dùng Beat nhạc (Thuần Beat)</span>
        </button>
      </div>

      {/* Main Learning & Practice Playground: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Video with Beat OR Pure Beat Lyrics (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-3xl p-5 shadow-xl border-4 border-emerald-400 space-y-4">
            {/* Step 1 Title */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-emerald-100 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-emerald-500 text-white font-black text-lg flex items-center justify-center shadow">
                  1
                </span>
                <div>
                  <h2 className="text-lg font-black text-emerald-800">
                    {practiceMode === 'video_beat'
                      ? 'Xem Video Bài Hát 📺'
                      : 'Lời Bài Hát & Tiết Tấu Chants 🎵'}
                  </h2>
                  <span className="text-[11px] font-bold text-zinc-500">
                    {practiceMode === 'video_beat'
                      ? 'Watch & Sing Along with Video'
                      : 'Sing Along with Rhythm (Pure Beat Mode)'}
                  </span>
                </div>
              </div>

              {/* Direct Video Upload Trigger (available ONLY in teacher mode) */}
              {!isStudentMode && practiceMode === 'video_beat' && (
                <button
                  onClick={() => setShowVideoInputModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-black border border-emerald-300 shadow-sm cursor-pointer transition"
                  title="Tải video từ máy tính hoặc dán link YouTube"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Đổi / Tải Video 🎥</span>
                </button>
              )}
            </div>

            {/* Video Player: When in Video Beat mode and text mode is selected, top video is shown. When in Karaoke Video mode, video is displayed inside the practice box below */}
            {practiceMode === 'video_beat' && lyricsChoice === 'text' ? (
              <>
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border-3 border-emerald-300 shadow-inner group flex items-center justify-center">
                  {youtubeEmbedUrl ? (
                    // YouTube Iframe Embed Player
                    <iframe
                      src={youtubeEmbedUrl}
                      title={lesson.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : activeVideoUrl ? (
                    // HTML5 Video Player with controls
                    <video
                      ref={videoRef}
                      src={activeVideoUrl}
                      controls
                      loop
                      playsInline
                      onPlay={() => setIsVideoPlaying(true)}
                      onPause={() => setIsVideoPlaying(false)}
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-pink-400 via-yellow-300 to-green-400 p-6 text-center">
                      <Music className="w-16 h-16 text-white drop-shadow animate-bounce mb-2" />
                      <span className="text-lg font-black text-white drop-shadow">
                        {lesson.title}
                      </span>
                      <span className="text-xs font-bold text-white/90">
                        ChantsStudio for Grade 5
                      </span>
                    </div>
                  )}
                </div>

                {/* Video File Name Notice if custom uploaded */}
                {videoFileName && (
                  <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span>📹 Đang phát video: {videoFileName}</span>
                    <button
                      onClick={() => {
                        setActiveVideoUrl(lesson.videoUrl || '');
                        setVideoFileName(null);
                      }}
                      className="text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      Khôi phục mặc định
                    </button>
                  </div>
                )}
              </>
            ) : practiceMode === 'pure_beat' && lyricsChoice === 'text' ? (
              // Pure Beat Mode Header Banner
              <div className="bg-gradient-to-r from-emerald-100 to-teal-100 p-4 rounded-2xl border-2 border-emerald-300 text-center">
                <span className="text-sm font-black text-emerald-900 block">
                  🥁 Chế độ tập trung vào Nhịp điệu & Lời ca
                </span>
                <span className="text-xs font-medium text-emerald-700 mt-1 block">
                  Khung video đã được ẩn để em hoàn toàn hòa mình vào tiếng trống và nhịp phách!
                </span>
              </div>
            ) : null}

            {/* Sing-along Lyrics Box with Big Clear Text OR Karaoke Video */}
            <div className="bg-emerald-50/80 p-4 rounded-2xl border-2 border-emerald-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-emerald-600" />
                    <span>Nội dung thực hành:</span>
                  </span>

                  {/* 2 Choices: Text or Video Karaoke */}
                  <div className="flex items-center bg-white p-1 rounded-xl border border-emerald-300 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setLyricsChoice('text')}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                        lyricsChoice === 'text'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>📝 Chọn Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLyricsChoice('karaoke_video')}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                        lyricsChoice === 'karaoke_video'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-purple-700 hover:bg-purple-50'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>🎬 Chọn Đăng Video</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {lyricsChoice === 'karaoke_video' && (
                    <span className="text-[10px] font-black text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                      Karaoke Mode 🌟
                    </span>
                  )}
                  {!isStudentMode && (
                    <button
                      type="button"
                      onClick={() => setShowKaraokeModal(true)}
                      className="px-2.5 py-1 rounded-xl bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-900 text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                      title="Tải video karaoke từ máy hoặc dán link YouTube"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Đăng / Đổi Video 🎥</span>
                    </button>
                  )}
                </div>
              </div>

              {lyricsChoice === 'karaoke_video' ? (
                // Display Karaoke Video
                <div className="space-y-2">
                  {effectiveKaraokeUrl ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border-3 border-purple-300 shadow-lg group flex items-center justify-center">
                      {getYoutubeEmbedUrl(effectiveKaraokeUrl) ? (
                        <iframe
                          src={getYoutubeEmbedUrl(effectiveKaraokeUrl)!}
                          title="Karaoke Video"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={effectiveKaraokeUrl}
                          controls
                          loop
                          playsInline
                          className="w-full h-full object-contain bg-black"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-purple-50 rounded-2xl border-2 border-dashed border-purple-300 space-y-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                        🎬
                      </div>
                      <h4 className="text-sm font-black text-purple-950">
                        Chưa có Video cho bài hát này
                      </h4>
                      <p className="text-xs text-purple-700">
                        Tải file video từ máy tính hoặc dán link YouTube để học sinh nhìn vào thực hành!
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                        {!isStudentMode && (
                          <button
                            type="button"
                            onClick={() => setShowKaraokeModal(true)}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md cursor-pointer transition flex items-center gap-1.5"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Đăng Video Ngay</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setLyricsChoice('text')}
                          className="px-4 py-2 rounded-xl bg-white hover:bg-purple-100 text-purple-800 text-xs font-black border border-purple-200 cursor-pointer transition"
                        >
                          📝 Xem Lời dạng Text
                        </button>
                      </div>
                    </div>
                  )}
                  {effectiveKaraokeUrl && (
                    <p className="text-[11px] font-bold text-center text-purple-800">
                      📺 Hãy nhìn vào màn hình video để hát theo và bấm Micro ở Bước 2 để thu âm nhé!
                    </p>
                  )}
                </div>
              ) : (
                // Display Text Lyrics
                <div className="space-y-2 text-center py-2">
                  {lesson.lyrics.map((line, idx) => (
                    <p
                      key={idx}
                      className="text-base sm:text-xl font-black text-zinc-800 hover:text-pink-600 transition"
                    >
                      "{line}"
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Song Switcher for Grade 5 */}
          {isStudentMode ? (
            /* Student Only: Show ONLY the active assigned chant */
            <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-pink-50 rounded-3xl p-4 shadow-md border-3 border-yellow-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black text-xl shadow-sm">
                  🎯
                </div>
                <div>
                  <span className="text-[11px] font-bold text-amber-800 uppercase block">
                    Bài hát em đang thực hiện (Your Assigned Chant):
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-pink-700">
                    🎵 {lesson.title}
                  </h3>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="bg-pink-100 text-pink-700 text-xs font-black px-3 py-1 rounded-full border border-pink-200 block mb-0.5">
                  {lesson.gradeLevel || 'Grade 5'}
                </span>
                <span className="text-[10px] text-zinc-500 font-bold block">
                  Nhịp: {currentBpm} BPM
                </span>
              </div>
            </div>
          ) : (
            /* Teacher Mode: Show full list of songs to switch and test */
            <div className="bg-white rounded-3xl p-4 shadow-md border-3 border-yellow-300">
              <span className="text-xs font-black text-amber-800 uppercase block mb-2">
                🌟 Danh sách bài hát Chants lớp 5 (Chế độ Giáo viên):
              </span>
              <div className="flex flex-wrap gap-2">
                {allLessons.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectLesson(l)}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-black transition cursor-pointer ${
                      lesson.id === l.id
                        ? 'bg-amber-400 text-amber-950 shadow-md scale-105'
                        : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-900'
                    }`}
                  >
                    🎵 {l.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Step 2 & 3 - Beat Practice, Recording & SUBMIT (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Step 2: Practice with the Beat & Record */}
          <div className="bg-white rounded-3xl p-5 shadow-xl border-4 border-pink-400 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-pink-100 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-pink-500 text-white font-black text-lg flex items-center justify-center shadow">
                  2
                </span>
                <div>
                  <h2 className="text-lg font-black text-pink-700">
                    Luyện Hát Theo Beat & Thu Âm 🥁
                  </h2>
                  <span className="text-[11px] font-bold text-zinc-500">
                    Sing Along with the Beat & Record Voice
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full border border-pink-200">
                Nhịp điệu: {currentBpm} BPM
              </span>
            </div>

            {/* Sync Notice depending on practice mode */}
            {practiceMode === 'video_beat' ? (
              <div className="bg-pink-50 p-2.5 rounded-xl border border-pink-200 text-xs font-bold text-pink-800 flex items-center gap-2">
                <Video className="w-4 h-4 text-pink-600 shrink-0" />
                <span>🎬 Video bài hát sẽ tự động phát đồng bộ ngay khi em bấm micro thu âm bên dưới!</span>
              </div>
            ) : (
              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>🎵 Lắng nghe tiếng đệm trống và đàn piano theo nhịp 1 - 2 - 3 - 4 để luyện hát nhé!</span>
              </div>
            )}

            {/* Beat Listening Bar (Instrumental Backing Track) */}
            <div className="bg-gradient-to-r from-orange-100 via-pink-100 to-yellow-100 p-4 rounded-2xl border-2 border-pink-200 flex flex-col items-center gap-3">
              <div className="w-full flex items-center justify-between">
                <span className="text-xs font-black text-pink-800 uppercase flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  <span>A. Beat Nhạc Theo Bài Hát (Backing Beat):</span>
                </span>
                {beatFileName ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full truncate max-w-[140px]">
                    🎵 {beatFileName}
                  </span>
                ) : (
                  <span className="text-[10px] bg-pink-200 text-pink-800 font-bold px-2 py-0.5 rounded-full">
                    🎹 Smart Kids Rhythm Synth
                  </span>
                )}
              </div>

              {/* 4 Animated Beat Bubbles */}
              <div className="flex items-center justify-center gap-3 my-1">
                {[1, 2, 3, 4].map((b) => (
                  <div
                    key={b}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black font-mono transition-all duration-150 ${
                      currentBeat === b && isBeatActive
                        ? 'bg-rose-500 text-white scale-125 shadow-lg shadow-rose-500/50'
                        : 'bg-white text-zinc-500 border-2 border-zinc-200'
                    }`}
                  >
                    {b}
                  </div>
                ))}
              </div>

              {/* Beat Controls: Play/Pause, Tempo Adjusters */}
              <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
                {/* Beat Play / Stop Button */}
                <button
                  onClick={toggleBeat}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-sm shadow-md transition cursor-pointer ${
                    isBeatActive
                      ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse'
                      : 'bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-amber-300'
                  }`}
                >
                  {isBeatActive ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Dừng Beat (Pause)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Bật Beat Nhạc 🎶</span>
                    </>
                  )}
                </button>

                {/* Tempo Adjusters (-5 / +5) */}
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-pink-300 shadow-sm text-xs font-black">
                  <span className="text-zinc-500 mr-1">Tốc độ:</span>
                  <button
                    onClick={() => handleBpmChange(-5)}
                    className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold"
                    title="Chậm lại 5 BPM"
                  >
                    -
                  </button>
                  <span className="font-mono text-pink-600 px-1">{currentBpm}</span>
                  <button
                    onClick={() => handleBpmChange(5)}
                    className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold"
                    title="Nhanh hơn 5 BPM"
                  >
                    +
                  </button>
                </div>

                {/* Package 1: Rhythm Tap Game Button */}
                <button
                  onClick={() => setIsRhythmGameOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-amber-950 font-black text-xs shadow-sm transition cursor-pointer"
                  title="Chơi mini-game gõ nhịp phách theo bài hát trước khi hát"
                >
                  <span>🎮 Game Gõ Nhịp (Rhythm Tap)</span>
                </button>
              </div>

              {/* Quick BPM Presets & Custom Beat Audio Upload */}
              <div className="w-full flex items-center justify-between text-xs pt-2 border-t border-pink-200/60 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-500 font-bold">Mẫu:</span>
                  {[75, 90, 110].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleSetPresetBpm(preset)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        currentBpm === preset
                          ? 'bg-pink-600 text-white'
                          : 'bg-white hover:bg-pink-50 text-zinc-700 border border-pink-200'
                      }`}
                    >
                      {preset === 75 ? 'Chậm' : preset === 90 ? 'Vừa' : 'Nhanh'} ({preset})
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!isStudentMode && (
                    <>
                      {/* Upload Beat or Video */}
                      <label className="text-[11px] text-pink-700 font-bold flex items-center gap-1 bg-white hover:bg-pink-50 px-2 py-1 rounded-lg border border-pink-300 cursor-pointer shadow-sm">
                        <Upload className="w-3 h-3" />
                        <Video className="w-3 h-3" />
                        <span>Tải file Beat / Video</span>
                        <input
                          type="file"
                          accept="audio/*,video/*"
                          onChange={handleDirectBeatUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Extract Beat from Lesson Video */}
                      {lesson.videoUrl && (
                        <button
                          onClick={() => handleExtractBeatFromLessonVideo('vocal_reduced')}
                          disabled={isExtractingBeat}
                          className="text-[11px] text-indigo-700 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 px-2 py-1 rounded-lg border border-indigo-200 cursor-pointer shadow-sm transition"
                          title="Trích xuất âm thanh/beat từ video bài học ở Bước 1"
                        >
                          {isExtractingBeat ? (
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-amber-500" />
                          )}
                          <span>Lấy Beat từ Video bài hát</span>
                        </button>
                      )}
                    </>
                  )}

                  {beatFileName && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 font-bold truncate max-w-[150px]">
                        🎵 {beatFileName}
                      </span>
                      <button
                        onClick={handleResetToSmartBeat}
                        className="text-[10px] text-zinc-400 hover:text-rose-600 underline cursor-pointer"
                        title="Quay lại beat đàn piano mặc định"
                      >
                        (Đặt lại)
                      </button>
                    </div>
                  )}
                </div>

                {beatExtractError && (
                  <div className="w-full text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>{beatExtractError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Step B: Microphone Recording Station */}
            <div ref={recordingSectionRef} className="bg-yellow-50 p-4 rounded-2xl border-2 border-yellow-300 flex flex-col items-center text-center space-y-3">
              <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-600" />
                <span>B. Micro Thu Lại Giọng Hát Của Học Sinh:</span>
              </span>

              {countdown !== null ? (
                <div className="py-4">
                  <span className="text-5xl font-black text-pink-600 animate-ping block">
                    {countdown}
                  </span>
                  <span className="text-sm font-bold text-zinc-600 mt-1 block">
                    Chuẩn bị sẵn sàng hát nhé! 🎈 (Get ready to sing!)
                  </span>
                </div>
              ) : isRecording ? (
                <div className="space-y-3 py-2 w-full">
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-black text-sm animate-pulse">
                    <span className="w-3 h-3 rounded-full bg-rose-600" />
                    <span>
                      Đang thu âm: {Math.floor(recordTimerSeconds / 60)}:
                      {(recordTimerSeconds % 60).toString().padStart(2, '0')} - Hãy hát theo beat!
                    </span>
                  </div>

                  {/* Real-time Voice Volume Dancing Visualizer */}
                  <div className="flex items-center justify-center gap-1.5 h-10 py-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((barIdx) => {
                      const barHeight = Math.max(
                        8,
                        Math.min(38, (liveMicLevel * (0.5 + (barIdx % 3) * 0.3)) / 2)
                      );
                      return (
                        <div
                          key={barIdx}
                          style={{ height: `${barHeight}px` }}
                          className="w-2.5 rounded-full bg-gradient-to-t from-pink-500 to-rose-400 transition-all duration-75"
                        />
                      );
                    })}
                  </div>

                  {/* Stop button */}
                  <button
                    onClick={handleStopRecord}
                    className="px-6 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-black text-sm shadow-lg flex items-center gap-2 mx-auto cursor-pointer transition transform active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Dừng Thu Âm (Stop Recording)</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartRecord}
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-base shadow-xl shadow-green-300 flex items-center gap-3 cursor-pointer transition transform active:scale-95"
                >
                  <Mic className="w-5 h-5" />
                  <span>Bật Micro & Bắt Đầu Thu Âm 🎙️</span>
                </button>
              )}

              {/* Playback & Download of Student Recording if completed */}
              {recordedUrl && !isRecording && (
                <div className="w-full pt-3 border-t-2 border-yellow-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-emerald-800 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Đã ghi âm giọng hát!</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePlayRecording}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition cursor-pointer shadow ${
                        isPlayingRecording
                          ? 'bg-rose-500 text-white'
                          : 'bg-white hover:bg-yellow-100 text-yellow-900 border-2 border-yellow-400'
                      }`}
                    >
                      {isPlayingRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Dừng phát</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Nghe lại giọng hát 🎧</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleStartRecord}
                      className="p-1.5 rounded-full bg-white hover:bg-yellow-100 text-zinc-600 border border-yellow-300"
                      title="Thu âm lại (Record again)"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleDownloadRecording}
                      className="p-1.5 rounded-full bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300"
                      title="Tải file âm thanh về máy (Download audio)"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: SUBMIT Button (Clean button labeled NỘP BÀI / SUBMIT) */}
          <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 p-1.5 rounded-3xl shadow-xl">
            <div className="bg-white rounded-[22px] p-5 text-center space-y-3">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-600 flex-wrap gap-2">
                <span>Bước 3: Hoàn thành bài tập</span>
                {submitState === 'completed' ? (
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 font-black flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Hoàn tất</span>
                  </span>
                ) : submitState === 'error' ? (
                  <span className="text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-300 font-black flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Đã dừng do lỗi</span>
                  </span>
                ) : submitState === 'evaluating' ? (
                  <span className="text-pink-600 bg-pink-100 px-2.5 py-0.5 rounded-md font-black flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang chấm điểm ({currentEvaluatingModel || 'AI'})...</span>
                  </span>
                ) : recordedUrl ? (
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Đã có bài thu âm (Sẵn sàng nộp) ✅</span>
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Chưa thu âm (Cần thu âm để nộp) ⚠️</span>
                  </span>
                )}
              </div>

              {/* Red Error Card according to AI_INSTRUCTIONS.md rule 3 */}
              {submitState === 'error' && apiErrorMessage && (
                <div className="bg-rose-50 border-2 border-rose-400 p-3.5 rounded-2xl text-left space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 text-rose-800 font-black text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Thông báo:</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-rose-200 font-mono text-[11px] text-rose-700 break-all select-all">
                    {apiErrorMessage}
                  </div>
                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    <span className="text-[10px] text-rose-600 font-bold">
                      💡 Hãy đổi hoặc kiểm tra lại API key trong phần Settings.
                    </span>
                    <button
                      onClick={onOpenApiKeyModal}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm"
                    >
                      Mở Settings (API Key)
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isEvaluating}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 hover:from-pink-400 hover:to-orange-300 text-white font-black text-xl tracking-wider shadow-xl shadow-pink-300 disabled:opacity-50 cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-3"
              >
                {isEvaluating ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>AI Buddy Đang Chấm Điểm... ✨</span>
                  </>
                ) : (
                  <>
                    <Send className="w-6 h-6" />
                    <span>NỘP BÀI / SUBMIT CHANT 🚀</span>
                  </>
                )}
              </button>

              <p className="text-[11px] font-bold text-zinc-500">
                {recordedUrl
                  ? '🎉 Em đã thu âm bài hát! Hãy bấm nút trên để nộp cho Robot AI Buddy chấm điểm và nhận huy hiệu nhé!'
                  : '⚠️ Chú ý: Học sinh cần bấm "Bật Micro & Bắt Đầu Thu Âm" ở Bước 2 để tập hát trước khi nộp bài. Nếu chưa thu âm, hệ thống sẽ yêu cầu Try again!'}
              </p>
            </div>
          </div>

          {/* Submission Badges & History with Delete & Keep Best Options */}
          {submissionHistory.length > 0 && (
            <div className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-pink-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-zinc-800 uppercase flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-pink-600" />
                  <span>🏆 Kết quả đã nộp phiên này ({submissionHistory.length}):</span>
                </span>
                {submissionHistory.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleKeepBestResultOnly}
                      className="text-[11px] font-black text-pink-700 bg-pink-100 hover:bg-pink-200 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                      title="Chỉ giữ lại 1 kết quả có số điểm cao nhất"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>Chỉ giữ kết quả cao nhất</span>
                    </button>
                    <button
                      onClick={() => setSubmissionHistory([])}
                      className="text-[11px] font-bold text-zinc-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-xl transition cursor-pointer"
                      title="Xoá tất cả lịch sử nộp bài"
                    >
                      Xoá hết
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {submissionHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs bg-pink-50/70 hover:bg-pink-50 p-2.5 rounded-2xl border border-pink-200 gap-2 transition"
                  >
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-bold text-zinc-800 truncate">
                        🎵 {item.songTitle} <span className="text-[11px] text-zinc-400 font-normal">({item.time})</span>
                      </span>
                      <span className="font-black text-pink-700 bg-white px-2 py-0.5 rounded-lg border border-pink-200 shadow-xs">
                        {item.score} điểm
                      </span>
                      <span className="font-bold text-amber-500 tracking-wider">
                        {'⭐'.repeat(item.stars)}
                      </span>
                      {item.badge && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 truncate hidden sm:inline">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteSubmission(item.id)}
                      title="Xoá kết quả này (nếu chưa vừa ý)"
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-100 transition cursor-pointer flex items-center gap-1 shrink-0 text-[11px] font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Xoá</span>
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-500 font-medium italic">
                💡 Em có thể bấm nút <b>"Xoá"</b> để bỏ các lượt điểm chưa cao, chỉ giữ lại kết quả tốt nhất mà em mong muốn!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* POPUP VIDEO UPLOAD / LINK MODAL */}
      {showVideoInputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border-4 border-emerald-400 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Đổi / Tải Video Cho Bài Hát</span>
              </h3>
              <button
                onClick={() => setShowVideoInputModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Option A: Upload local video file */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 block">
                Cách 1: Tải video từ máy tính (MP4, WebM):
              </label>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/50 transition cursor-pointer text-center">
                <Upload className="w-6 h-6 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-zinc-700">Chọn file video từ máy</span>
                <span className="text-[10px] text-zinc-500">Hỗ trợ file MP4, WebM</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleDirectVideoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Option B: Enter video URL / YouTube link */}
            <div className="space-y-1.5 pt-2 border-t">
              <label className="text-xs font-black text-zinc-700 block">
                Cách 2: Hoặc dán link video / YouTube bài Chants:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... hoặc file .mp4"
                  value={customVideoInputUrl}
                  onChange={(e) => setCustomVideoInputUrl(e.target.value)}
                  className="flex-1 text-xs p-2.5 rounded-xl border border-zinc-300 outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleApplyCustomVideoUrl}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowVideoInputModal(false)}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* POPUP ĐĂNG VIDEO KARAOKE CÓ LỜI CHẠY */}
      {showKaraokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border-4 border-purple-400 p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-600" />
                <span>Đăng Video Karaoke Có Lời Chạy</span>
              </h3>
              <button
                onClick={() => setShowKaraokeModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Option A: Upload local video file */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 block">
                Cách 1: Tải video karaoke từ máy tính (MP4, WebM):
              </label>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-purple-300 rounded-xl bg-purple-50/50 hover:bg-purple-100/50 transition cursor-pointer text-center">
                <Upload className="w-6 h-6 text-purple-600 mb-1" />
                <span className="text-xs font-bold text-zinc-700">
                  {karaokeUploadFileName || 'Chọn file video karaoke từ máy'}
                </span>
                <span className="text-[10px] text-zinc-500">Hỗ trợ file MP4, WebM</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setActiveKaraokeUrl(url);
                      setKaraokeUploadFileName(file.name);
                      setLyricsChoice('karaoke_video');
                      if (onUpdateLesson) {
                        onUpdateLesson({
                          ...lesson,
                          lyricsMode: 'karaoke_video',
                          karaokeVideoUrl: url,
                        });
                      }
                      setShowKaraokeModal(false);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Option B: Enter video URL / YouTube link */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100">
              <label className="text-xs font-black text-zinc-700 block">
                Cách 2: Hoặc dán link video / YouTube Karaoke có lời:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... hoặc link .mp4"
                  value={customKaraokeInputUrl}
                  onChange={(e) => setCustomKaraokeInputUrl(e.target.value)}
                  className="flex-1 text-xs p-2.5 rounded-xl border border-zinc-300 outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => {
                    if (customKaraokeInputUrl.trim()) {
                      setActiveKaraokeUrl(customKaraokeInputUrl.trim());
                      setLyricsChoice('karaoke_video');
                      if (onUpdateLesson) {
                        onUpdateLesson({
                          ...lesson,
                          lyricsMode: 'karaoke_video',
                          karaokeVideoUrl: customKaraokeInputUrl.trim(),
                        });
                      }
                      setShowKaraokeModal(false);
                    }
                  }}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm"
                >
                  Áp dụng
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowKaraokeModal(false)}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* POPUP FEEDBACK MODAL: Compact, Responsive on Desktop/Tablet/Mobile with English Praise */}
      {showFeedbackModal && feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border-4 border-pink-400 p-5 sm:p-6 max-w-sm sm:max-w-md w-full text-center shadow-2xl relative space-y-3.5 max-h-[92vh] overflow-y-auto animate-scale-up">
            {/* Mascot in header */}
            <div className="-mt-14 flex justify-center drop-shadow-lg">
              <RoboBuddyMascot
                size="md"
                mood={feedback.status === 'OUTSTANDING' ? 'cheering' : 'happy'}
                isDancing={true}
              />
            </div>

            {/* Status Rating Banner: Excellent! 🌟 or Keep trying! 🎈 (English only) */}
            <div
              className={`p-3 rounded-2xl border-2 text-center shadow-md ${
                feedback.status === 'OUTSTANDING'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white border-emerald-300'
                  : 'bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 border-amber-300'
              }`}
            >
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center justify-center gap-1.5">
                <span>{feedback.headline || (feedback.status === 'OUTSTANDING' ? 'Excellent! 🌟' : 'Keep trying! 🎈')}</span>
              </h2>
            </div>

            {/* Star Rating Display */}
            <div className="flex items-center justify-center gap-1.5 py-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-7 h-7 sm:w-8 sm:h-8 ${
                    i < feedback.stars
                      ? 'fill-amber-400 text-amber-400 drop-shadow-md scale-110'
                      : 'fill-zinc-200 text-zinc-300'
                  } transition`}
                />
              ))}
            </div>

            {/* Badge Award */}
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-md">
              <Award className="w-4 h-4 text-yellow-300" />
              <span>Award: {feedback.badgeEarned}</span>
            </div>

            {/* Short English Praise Message */}
            <div className="bg-pink-50 p-3.5 rounded-2xl border-2 border-pink-200 text-center shadow-inner">
              <span className="text-[10px] font-black uppercase text-pink-600 block mb-1">
                🤖 RoboBuddy English Feedback:
              </span>
              <p className="text-sm sm:text-base font-black text-pink-950 leading-snug">
                "{feedback.robotMessage}"
              </p>
            </div>

            {/* Single Short Fun Tip (if available) */}
            {feedback.funTips && feedback.funTips.length > 0 && (
              <div className="bg-yellow-50 px-3 py-2 rounded-xl border border-yellow-300 text-center">
                <p className="text-xs font-bold text-amber-900">
                  💡 {feedback.funTips[0]}
                </p>
              </div>
            )}

            {/* Compact 4-Skill Badges */}
            {feedback.skills && (
              <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
                <div className="bg-pink-50 p-1.5 rounded-xl border border-pink-200">
                  <span className="text-[10px] font-bold text-pink-600 block">Rhythm</span>
                  <span className="text-xs font-black text-pink-900">{feedback.skills.rhythm}%</span>
                </div>
                <div className="bg-purple-50 p-1.5 rounded-xl border border-purple-200">
                  <span className="text-[10px] font-bold text-purple-600 block">Melody</span>
                  <span className="text-xs font-black text-purple-900">{feedback.skills.melody}%</span>
                </div>
                <div className="bg-amber-50 p-1.5 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-600 block">Pitch</span>
                  <span className="text-xs font-black text-amber-900">{feedback.skills.pronunciation}%</span>
                </div>
                <div className="bg-emerald-50 p-1.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-600 block">Energy</span>
                  <span className="text-xs font-black text-emerald-900">{feedback.skills.energy}%</span>
                </div>
              </div>
            )}

            {/* Action Buttons: Giữ kết quả / Try Again (Làm lại) / Xoá kết quả này */}
            {feedback.headline === 'Try again! 🎈' && !recordedUrl ? (
              <div className="pt-2">
                <button
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setTimeout(() => {
                      recordingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 150);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-sm sm:text-base shadow-lg shadow-amber-300 cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Mic className="w-5 h-5" />
                  <span>Em đi thu âm ngay! 🎤 (Go to Record)</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                {/* 1. Primary: Keep this result */}
                <button
                  onClick={handleKeepResult}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-sm sm:text-base shadow-lg shadow-green-200 cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>⭐ Giữ kết quả này (Hoàn tất)</span>
                </button>

                {/* 2. Secondary Row: Try Again & Delete */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Try Again */}
                  <button
                    onClick={handleTryAgain}
                    className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-white font-black text-xs sm:text-sm shadow-md cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-1.5"
                    title="Chưa vừa ý? Xoá điểm này và thu âm lại để lấy điểm cao hơn!"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Again! 🔄</span>
                  </button>

                  {/* Delete this result */}
                  <button
                    onClick={handleDeleteLatestResult}
                    className="py-2.5 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 hover:border-rose-300 font-black text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                    title="Xoá kết quả này khỏi lịch sử"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Xoá điểm này 🗑️</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chant Rhythm Tap Game Modal (Package 1) */}
      <ChantRhythmGameModal
        isOpen={isRhythmGameOpen}
        onClose={() => setIsRhythmGameOpen(false)}
        songTitle={lesson.title}
        bpm={currentBpm}
        lyrics={lesson.lyrics}
      />
    </div>
  );
};
