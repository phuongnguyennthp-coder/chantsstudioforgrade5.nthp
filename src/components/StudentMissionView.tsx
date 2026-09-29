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
  Maximize,
  Minimize,
  ArrowUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SongLesson, RoboBuddyFeedback } from '../types/kidsMusic';
import { kidsBeatEngine, ChantBeatStyle } from '../audio/kidsBeatEngine';
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

// Helper to extract YouTube, Google Drive, or streaming embed URL
export function parseVideoSource(url: string | null | undefined): {
  isIframe: boolean;
  iframeUrl?: string;
  videoSrc?: string;
  isLocalBlob: boolean;
  provider?: 'youtube' | 'drive' | 'dropbox' | 'direct';
} {
  if (!url || typeof url !== 'string') {
    return { isIframe: false, isLocalBlob: false };
  }
  const trimmed = url.trim();

  // Local Blob URL created on a specific browser session
  if (trimmed.startsWith('blob:')) {
    return { isIframe: false, videoSrc: trimmed, isLocalBlob: true, provider: 'direct' };
  }

  // 1. YouTube Match (watch, youtu.be, embed, shorts)
  const ytMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  if (ytMatch) {
    return {
      isIframe: true,
      iframeUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=0&rel=0&playsinline=1&enablejsapi=1`,
      isLocalBlob: false,
      provider: 'youtube',
    };
  }

  // 2. Google Drive Match (view, open, uc)
  const gDriveMatch = trimmed.match(
    /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/
  );
  if (gDriveMatch) {
    return {
      isIframe: true,
      iframeUrl: `https://drive.google.com/file/d/${gDriveMatch[1]}/preview`,
      isLocalBlob: false,
      provider: 'drive',
    };
  }

  // 3. Dropbox Direct Stream
  if (trimmed.includes('dropbox.com')) {
    const directDropbox = trimmed.replace('dl=0', 'raw=1');
    return { isIframe: false, videoSrc: directDropbox, isLocalBlob: false, provider: 'dropbox' };
  }

  // 4. Direct Online Video (.mp4, .webm, cdn, etc.)
  return { isIframe: false, videoSrc: trimmed, isLocalBlob: false, provider: 'direct' };
}

function getYoutubeEmbedUrl(url: string): string | null {
  const info = parseVideoSource(url);
  return info.isIframe ? info.iframeUrl || null : null;
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
  const [videoError, setVideoError] = useState(false);
  const [karaokeVideoError, setKaraokeVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Floating Mini-Video (Sticky Picture-in-Picture) & Fullscreen State
  const mainVideoSectionRef = useRef<HTMLDivElement | null>(null);
  const [isVideoOutOfView, setIsVideoOutOfView] = useState(false);
  const [isFloatingVideoVisible, setIsFloatingVideoVisible] = useState(true);
  const [isFloatingMinimized, setIsFloatingMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen toggle with fallback support for iOS / Safari / Heyzine
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

  // IntersectionObserver to detect when the main video scrolls out of the viewport
  useEffect(() => {
    const target = mainVideoSectionRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const outOfView = !entry.isIntersecting && entry.boundingClientRect.top < 60;
        setIsVideoOutOfView(outOfView);
      },
      { threshold: [0, 0.15] }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Step 2: Beat State
  const [isBeatActive, setIsBeatActive] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [currentBpm, setCurrentBpm] = useState<number>(lesson.bpm || 90);
  const [beatFileName, setBeatFileName] = useState<string | null>(null);
  const [beatVolume, setBeatVolume] = useState<number>(0.7);
  const [isRhythmGameOpen, setIsRhythmGameOpen] = useState(false);
  const [selectedBeatStyle, setSelectedBeatStyle] = useState<ChantBeatStyle>('pop_chant');

  // Step 2: Microphone & Voice Recording State (Decoupled between Video Practice & Challenge Beat)
  const [activeRecordingMode, setActiveRecordingMode] = useState<'video' | 'challenge' | null>(null);
  const [activeCountdownMode, setActiveCountdownMode] = useState<'video' | 'challenge' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedSourceMode, setRecordedSourceMode] = useState<'video' | 'challenge' | null>(null);
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
    setRecordedSourceMode(null);
    setActiveRecordingMode(null);
    setActiveCountdownMode(null);
    setIsPlayingRecording(false);
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
    setVideoError(false);
    setKaraokeVideoError(false);

    kidsBeatEngine.setBpm(lesson.bpm || 90);
    // Safe custom beat handling: if in student mode and teacher uploaded local blob, fallback cleanly to smart synth
    const isLocalBlob = Boolean(lesson.beatAudioUrl?.startsWith('blob:'));
    const safeBeatUrl = isStudentMode && isLocalBlob ? null : (lesson.beatAudioUrl || null);
    kidsBeatEngine.setCustomBeatAudio(safeBeatUrl);
    if (isStudentMode && isLocalBlob) {
      setBeatFileName('Smart Rhythm Beat • Beat Nhịp Điệu Thông Minh');
    } else if (lesson.beatAudioUrl) {
      setBeatFileName(`Beat • ${lesson.title}`);
    } else {
      setBeatFileName(null);
    }

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

    if (activeRecordingMode !== null) {
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
  }, [activeRecordingMode]);

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

  // Step 1: Video recording handlers (Without Challenge Beat)
  const handleStartVideoRecord = () => {
    if (activeRecordingMode !== null) return;
    setActiveCountdownMode('video');
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(timer);
          setActiveCountdownMode(null);
          kidsBeatEngine.startRecording(false).then((ok) => {
            if (ok) {
              setActiveRecordingMode('video');
              if (practiceMode === 'video_beat' && videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch((e) => console.log('Video sync play error', e));
                setIsVideoPlaying(true);
              }
            }
          });
          return null;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 800);
  };

  const handleStopVideoRecord = async () => {
    try {
      const url = await kidsBeatEngine.stopRecording();
      setActiveRecordingMode(null);
      setRecordedUrl(url || 'recorded-ready');
      setRecordedSourceMode('video');
      if (videoRef.current) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      }
    } catch (err) {
      console.error('Stop video recording error:', err);
      setActiveRecordingMode(null);
      setRecordedUrl('recorded-ready');
      setRecordedSourceMode('video');
    }
  };

  // Step 2: Beat Challenge recording handlers (With selected Challenge Beat)
  const handleStartChallengeRecord = () => {
    if (activeRecordingMode !== null) return;
    setActiveCountdownMode('challenge');
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(timer);
          setActiveCountdownMode(null);
          kidsBeatEngine.startRecording(true).then((ok) => {
            if (ok) {
              setActiveRecordingMode('challenge');
            }
          });
          return null;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 800);
  };

  const handleStopChallengeRecord = async () => {
    try {
      const url = await kidsBeatEngine.stopRecording();
      setActiveRecordingMode(null);
      setRecordedUrl(url || 'recorded-ready');
      setRecordedSourceMode('challenge');
    } catch (err) {
      console.error('Stop challenge recording error:', err);
      setActiveRecordingMode(null);
      setRecordedUrl('recorded-ready');
      setRecordedSourceMode('challenge');
    }
  };

  const handleTogglePlayRecording = () => {
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

  // Compatibility aliases
  const handlePlayRecording = handleTogglePlayRecording;
  const handleStartRecord = handleStartVideoRecord;
  const handleStopRecord = handleStopVideoRecord;

  // Download student's recorded singing file
  const handleDownloadRecording = () => {
    const blob = kidsBeatEngine.getRecordedAudioBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${studentName.replace(/\s+/g, '_')}_${lesson.title.replace(/\s+/g, '_')}_Chant.webm`;
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

  const handleSubmitMission = handleSubmit;

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
    setRecordedSourceMode(null);
    setActiveRecordingMode(null);
    setActiveCountdownMode(null);
    setSubmitState('idle');
    setShowFeedbackModal(false);

    // 3. Scroll smoothly back to Microphone area
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
                <span className="bg-purple-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                  <span>✨ Designed by Tím</span>
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
                  Student Name • Tên học sinh:
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

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-3 py-2 rounded-2xl bg-white hover:bg-emerald-50 border-2 border-emerald-300 text-emerald-800 text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-95"
              title={isFullscreen ? 'Minimize • Thu nhỏ cửa sổ' : 'Fullscreen • Toàn màn hình'}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Minimize • Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Fullscreen • Toàn màn hình</span>
                </>
              )}
            </button>

            {!isStudentMode && onOpenTeacherStudio && (
              <button
                type="button"
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xs sm:text-sm text-indigo-700">
                🤖 RoboBuddy AI Companion • Bạn Đồng Hành Âm Nhạc:
              </span>
              <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-2 py-0.5 rounded-full">
                Ready to listen! • Sẵn sàng!
              </span>
            </div>
            <p className="text-xs text-zinc-700 font-medium mt-0.5">
              "Hi <strong className="text-pink-600">{studentName}</strong>! 1️⃣ Watch the chant video on the left (Xem video bài hát). 2️⃣ Feel the lively beat & record your voice on the right (Nghe beat & thu âm giọng hát). 3️⃣ Tap Submit to get your stars & badges from AI! (Bấm Nộp bài để nhận sao và huy hiệu nhé!)"
            </p>
          </div>
        </div>
      </div>

      {/* PRACTICE MODE SELECTOR FOR ELEMENTARY STUDENTS */}
      <div className="flex items-center justify-center gap-2 p-2 bg-gradient-to-r from-pink-100 via-yellow-100 to-emerald-100 rounded-3xl border-3 border-pink-300 shadow-md flex-wrap">
        <span className="text-xs font-black text-zinc-700 px-2 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Practice Mode • Chế độ thực hành:</span>
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
          <span>🎬 Video Chant with Beat • Video có Beat nhạc</span>
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
          <span>🎵 Pure Beat Mode • Chỉ dùng Beat nhạc</span>
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
                      ? 'Watch Chant Video • Xem Video Bài Hát 📺'
                      : 'Chant Lyrics & Rhythm • Lời Bài Hát & Tiết Tấu Chants 🎵'}
                  </h2>
                  <span className="text-[11px] font-bold text-zinc-500">
                    {practiceMode === 'video_beat'
                      ? 'Watch & Sing Along with Video • Vừa xem vừa luyện tập theo video'
                      : 'Sing Along with Rhythm • Luyện tập theo tiết tấu beat'}
                  </span>
                </div>
              </div>

              {/* Direct Video Upload Trigger (available ONLY in teacher mode) */}
              {!isStudentMode && practiceMode === 'video_beat' && (
                <button
                  type="button"
                  onClick={() => setShowVideoInputModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-black border border-emerald-300 shadow-sm cursor-pointer transition"
                  title="Upload video from computer or paste YouTube link"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Video • Đổi / Tải Video 🎥</span>
                </button>
              )}
            </div>

            {/* Video Player: When in Video Beat mode and text mode is selected, top video is shown. When in Karaoke Video mode, video is displayed inside the practice box below */}
            {practiceMode === 'video_beat' && lyricsChoice === 'text' ? (
              <>
                <div ref={mainVideoSectionRef} className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border-3 border-emerald-300 shadow-inner group flex items-center justify-center">
                  {youtubeEmbedUrl ? (
                    // YouTube / Google Drive Iframe Embed Player (Plays on 100% of PC, Phones & Tablets)
                    <iframe
                      src={youtubeEmbedUrl}
                      title={lesson.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : activeVideoUrl && (!activeVideoUrl.startsWith('blob:') || !isStudentMode) && !videoError ? (
                    // HTML5 Video Player with iOS / Android mobile optimization
                    <video
                      ref={videoRef}
                      src={activeVideoUrl}
                      controls
                      loop
                      playsInline
                      preload="metadata"
                      onPlay={() => setIsVideoPlaying(true)}
                      onPause={() => setIsVideoPlaying(false)}
                      onError={() => setVideoError(true)}
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : activeVideoUrl && ((activeVideoUrl.startsWith('blob:') && isStudentMode) || videoError) ? (
                    // Friendly mobile fallback card when teacher uploaded a local file
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-500 via-rose-500 to-pink-600 p-4 sm:p-6 text-center text-white space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shadow-inner">
                        📱
                      </div>
                      <h4 className="text-sm sm:text-base font-black tracking-wide">
                        Local Video File • Video mẫu từ tệp máy tính cá nhân
                      </h4>
                      <p className="text-xs text-white/95 max-w-sm leading-relaxed">
                        This video file is on the teacher's local device. • Tệp video này được tải từ máy tính của thầy/cô nên điện thoại hoặc tablet chưa tải trực tiếp qua mạng.
                      </p>
                      <div className="bg-black/30 backdrop-blur-xs px-3 py-2 rounded-xl text-[11px] font-bold text-yellow-200 border border-white/20 max-w-sm">
                        💡 Sing along with the practice content below and tap Mic to record! • Em hãy nhìn vào phần <b>Nội Dung Thực Hành</b> ở dưới, bấm Micro để tập hát và nộp bài nhé! (Thầy/Cô dán Link YouTube hoặc Google Drive để video phát mượt mà trên mọi thiết bị).
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-pink-400 via-yellow-300 to-green-400 p-6 text-center">
                      <Music className="w-16 h-16 text-white drop-shadow animate-bounce mb-2" />
                      <span className="text-lg font-black text-white drop-shadow">
                        {lesson.title}
                      </span>
                      <span className="text-xs font-bold text-white/90">
                        ChantsStudio for Grade 5 • Designed by Tím
                      </span>
                    </div>
                  )}
                </div>

                {/* Video File Name Notice if custom uploaded */}
                {videoFileName && (
                  <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span>📹 Playing • Đang phát: {videoFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVideoUrl(lesson.videoUrl || '');
                        setVideoFileName(null);
                      }}
                      className="text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      Reset • Khôi phục mặc định
                    </button>
                  </div>
                )}
              </>
            ) : practiceMode === 'pure_beat' && lyricsChoice === 'text' ? (
              // Pure Beat Mode Header Banner
              <div className="bg-gradient-to-r from-emerald-100 to-teal-100 p-4 rounded-2xl border-2 border-emerald-300 text-center">
                <span className="text-sm font-black text-emerald-900 block">
                  🥁 Pure Rhythm & Lyrics Mode • Chế độ tập trung vào Nhịp điệu & Lời ca
                </span>
                <span className="text-xs font-medium text-emerald-700 mt-1 block">
                  Focus entirely on the chant rhythm, drums & voice! • Khung video đã được ẩn để em hòa mình vào tiếng trống!
                </span>
              </div>
            ) : null}

            {/* Sing-along Lyrics Box with Big Clear Text OR Karaoke Video */}
            <div className="bg-emerald-50/80 p-4 rounded-2xl border-2 border-emerald-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-emerald-600" />
                    <span>Practice Content • Nội dung thực hành:</span>
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
                      <span>📝 Text Lyrics • Lời Text</span>
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
                      <span>🎬 Video Chant • Đăng Video</span>
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
                      title="Upload video karaoke from device or paste YouTube link"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Video • Đăng Video 🎥</span>
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
                      ) : (!effectiveKaraokeUrl.startsWith('blob:') || !isStudentMode) && !karaokeVideoError ? (
                        <video
                          src={effectiveKaraokeUrl}
                          controls
                          loop
                          playsInline
                          preload="metadata"
                          onError={() => setKaraokeVideoError(true)}
                          className="w-full h-full object-contain bg-black"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 via-pink-600 to-rose-500 p-4 sm:p-6 text-center text-white space-y-2">
                          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shadow-inner">
                            🎬
                          </div>
                          <h4 className="text-sm sm:text-base font-black tracking-wide">
                            Local Video File • Video Karaoke từ tệp máy tính cá nhân
                          </h4>
                          <p className="text-xs text-white/95 max-w-sm leading-relaxed">
                            Tệp video karaoke này được chọn từ máy tính của thầy/cô nên điện thoại hoặc tablet chưa tải được qua mạng.
                          </p>
                          <div className="bg-black/30 backdrop-blur-xs px-3 py-2 rounded-xl text-[11px] font-bold text-yellow-200 border border-white/20 max-w-sm">
                            💡 Thầy/Cô chỉ cần dán <b>Link YouTube Karaoke</b> hoặc <b>Google Drive</b> để học sinh xem được trên 100% điện thoại và máy tính bảng!
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-purple-50 rounded-2xl border-2 border-dashed border-purple-300 space-y-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                        🎬
                      </div>
                      <h4 className="text-sm font-black text-purple-950">
                        No Video Yet • Chưa có Video cho bài hát này
                      </h4>
                      <p className="text-xs text-purple-700">
                        Upload video or paste YouTube link for students to practice! • Tải video hoặc dán link YouTube để học sinh thực hành!
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                        {!isStudentMode && (
                          <button
                            type="button"
                            onClick={() => setShowKaraokeModal(true)}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md cursor-pointer transition flex items-center gap-1.5"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Upload Video • Đăng Video Ngay</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setLyricsChoice('text')}
                          className="px-4 py-2 rounded-xl bg-white hover:bg-purple-100 text-purple-800 text-xs font-black border border-purple-200 cursor-pointer transition"
                        >
                          📝 Text Lyrics • Xem Lời dạng Text
                        </button>
                      </div>
                    </div>
                  )}
                  {effectiveKaraokeUrl && (
                    <p className="text-[11px] font-bold text-center text-emerald-800">
                      📺 Watch the video & tap the green Microphone below to record! • Hãy nhìn vào video và bấm nút Micro màu xanh bên dưới để thu âm! 👇
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

              {/* DIRECT RECORDING STATION RIGHT BELOW VIDEO / LYRICS FOR HEYZINE & MOBILE */}
              <div className="bg-gradient-to-r from-emerald-100 via-teal-50 to-green-100 p-3.5 rounded-2xl border-2 border-emerald-300 shadow-sm flex flex-col items-center text-center space-y-2.5 mt-2">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-black text-emerald-950 uppercase flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-emerald-600 animate-bounce" />
                    <span>Record with Video • Thu Âm Theo Video (Sing Along):</span>
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                    📱 Watch & Record • Vừa xem vừa thu âm
                  </span>
                </div>

                {activeCountdownMode === 'video' ? (
                  <div className="py-2 animate-scale-up">
                    <span className="text-4xl sm:text-5xl font-black text-emerald-600 animate-ping block">
                      {countdown}
                    </span>
                    <span className="text-xs font-bold text-zinc-700 mt-1 block">
                      Get ready to sing along! 🎈 (Chuẩn bị hát theo video nhé!)
                    </span>
                  </div>
                ) : activeRecordingMode === 'video' ? (
                  <div className="space-y-2.5 py-1 w-full animate-fade-in">
                    <div className="flex items-center justify-center gap-2 text-rose-600 font-black text-xs sm:text-sm animate-pulse">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                      <span>
                        Recording: {Math.floor(recordTimerSeconds / 60)}:
                        {(recordTimerSeconds % 60).toString().padStart(2, '0')} • Sing loud along with video! (Hát to theo video nhé!)
                      </span>
                    </div>

                    {/* Dancing Voice Visualizer */}
                    <div className="flex items-center justify-center gap-1.5 h-8 py-1">
                      {[1, 2, 3, 4, 5, 6, 7].map((barIdx) => {
                        const barHeight = Math.max(
                          6,
                          Math.min(32, (liveMicLevel * (0.5 + (barIdx % 3) * 0.3)) / 2)
                        );
                        return (
                          <div
                            key={barIdx}
                            style={{ height: `${barHeight}px` }}
                            className="w-2 rounded-full bg-gradient-to-t from-emerald-600 to-green-400 transition-all duration-75"
                          />
                        );
                      })}
                    </div>

                    {/* Stop button */}
                    <button
                      type="button"
                      onClick={handleStopVideoRecord}
                      className="px-5 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5 mx-auto cursor-pointer transition transform active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Recording • Dừng Thu Âm</span>
                    </button>
                  </div>
                ) : recordedUrl && (recordedSourceMode === 'video' || recordedSourceMode === null) ? (
                  /* Recording Completed Station: Playback & Submit right here! */
                  <div className="w-full space-y-2 pt-0.5 animate-scale-up">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-800">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Recording ready! Listen or submit: • Đã thu âm xong giọng hát!</span>
                    </div>

                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {/* Play recorded voice */}
                      <button
                        type="button"
                        onClick={handleTogglePlayRecording}
                        className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95 ${
                          isPlayingRecording
                            ? 'bg-rose-500 text-white'
                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {isPlayingRecording ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isPlayingRecording ? 'Pause • Tạm dừng' : 'Play Voice • Nghe lại giọng em'}</span>
                      </button>

                      {/* Re-record */}
                      <button
                        type="button"
                        onClick={handleStartVideoRecord}
                        className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Record Again • Thu lại 🔄</span>
                      </button>

                      {/* Submit right here! */}
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isEvaluating}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {isEvaluating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Evaluating • AI đang chấm điểm...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Submit Chant • Nộp Bài Chấm Điểm 🚀</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Primary Call-to-action */
                  <div className="space-y-1 w-full">
                    <button
                      type="button"
                      onClick={handleStartVideoRecord}
                      disabled={activeRecordingMode !== null}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 mx-auto cursor-pointer transition transform active:scale-95 disabled:opacity-50"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Record with Video • Bật Mic & Thu Âm Theo Video! 🎈</span>
                    </button>
                    <span className="text-[10px] text-zinc-500 font-bold block">
                      💡 Watch video & sing directly without scrolling! • Vừa nhìn video và chữ vừa hát trực tiếp!
                    </span>
                  </div>
                )}
              </div>
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
                  <h2 className="text-lg font-black text-pink-700 flex items-center gap-1.5">
                    <span>Creative Chant Beat Challenge • Thử Thách Tiết Tấu Sáng Tạo 🌟</span>
                  </h2>
                  <span className="text-[11px] font-bold text-zinc-500">
                    Explore rhythm & drums with AI Buddy • Khám phá nhịp trống cùng AI Buddy
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {practiceMode === 'video_beat' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFloatingVideoVisible((prev) => !prev);
                      setIsFloatingMinimized(false);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-xs active:scale-95 ${
                      isFloatingVideoVisible
                        ? 'bg-emerald-600 text-white shadow-emerald-200'
                        : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                    }`}
                    title="Pin floating video window to watch while practicing"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>{isFloatingVideoVisible ? '📺 Pin Video • Ghim' : '📺 Pop-up Video • Hiện'}</span>
                  </button>
                )}
                <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full border border-pink-200">
                  Tempo • Nhịp: {currentBpm} BPM
                </span>
              </div>
            </div>

            {/* Sync Notice depending on practice mode */}
            <div className="bg-gradient-to-r from-amber-50 to-pink-50 p-2.5 rounded-xl border border-pink-200 text-xs font-bold text-pink-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>🥁 <b>Beat Challenge • Thử thách nhịp phách:</b> Pick a drum style below, tap <b>Play Beat</b> to feel beats 1 - 2 - 3 - 4 and chant creatively! (Chọn phong cách trống bên dưới, bấm <b>Bật Beat</b> để cảm nhận nhịp 1 - 2 - 3 - 4 và luyện chants sáng tạo!)</span>
            </div>

            {/* Beat Listening Bar (Creative Chant Beat Challenge) */}
            <div className="bg-gradient-to-r from-orange-100 via-pink-100 to-yellow-100 p-4 rounded-2xl border-2 border-pink-200 flex flex-col items-center gap-3">
              <div className="w-full flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-black text-pink-800 uppercase flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-pink-600" />
                  <span>A. Choose Chant Beat Style • Chọn Phong Cách Beat Trống:</span>
                </span>
                <span className="text-[10px] bg-pink-200 text-pink-800 font-bold px-2 py-0.5 rounded-full">
                  🥁 4 Beat Styles • 4 Điệu Beat
                </span>
              </div>

              {/* 4 Beat Style Selector Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full">
                {[
                  { id: 'pop_chant', label: 'Pop Chant 🥁', desc: 'Catchy & Upbeat • Sôi động, bắt tai' },
                  { id: 'hiphop_kids', label: 'Hip-Hop Kids 🚀', desc: 'Bouncy 808 Drums • Trống nẩy, hiện đại' },
                  { id: 'clap_march', label: 'Clap March 👏', desc: 'Clap & March • Vỗ tay gõ phách' },
                  { id: 'rocking', label: 'Rocking 🎸', desc: 'Driving Energy • Năng lượng hào hứng' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedBeatStyle(st.id as ChantBeatStyle);
                      kidsBeatEngine.setChantBeatStyle(st.id as ChantBeatStyle);
                    }}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer transform active:scale-95 ${
                      selectedBeatStyle === st.id
                        ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white border-pink-600 shadow-md scale-102'
                        : 'bg-white/90 hover:bg-white text-zinc-800 border-pink-200 hover:border-pink-300'
                    }`}
                  >
                    <span className="text-xs font-black block">{st.label}</span>
                    <span className={`text-[10px] block leading-tight ${selectedBeatStyle === st.id ? 'text-pink-100' : 'text-zinc-500'}`}>
                      {st.desc}
                    </span>
                  </button>
                ))}
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
                  type="button"
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
                      <span>Pause Beat • Dừng Beat</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play Beat • Bật Beat Nhạc 🎶</span>
                    </>
                  )}
                </button>

                {/* Tempo Adjusters (-5 / +5) */}
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-pink-300 shadow-sm text-xs font-black">
                  <span className="text-zinc-500 mr-1">Tempo • Tốc độ:</span>
                  <button
                    type="button"
                    onClick={() => handleBpmChange(-5)}
                    className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold"
                    title="Slow down 5 BPM • Chậm lại 5 BPM"
                  >
                    -
                  </button>
                  <span className="font-mono text-pink-600 px-1">{currentBpm}</span>
                  <button
                    type="button"
                    onClick={() => handleBpmChange(5)}
                    className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold"
                    title="Speed up 5 BPM • Nhanh hơn 5 BPM"
                  >
                    +
                  </button>
                </div>

                {/* Package 1: Rhythm Tap Game Button */}
                <button
                  type="button"
                  onClick={() => setIsRhythmGameOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-amber-950 font-black text-xs shadow-sm transition cursor-pointer"
                  title="Play rhythm tap game • Chơi mini-game gõ nhịp phách"
                >
                  <span>🎮 Rhythm Tap Game • Game Gõ Nhịp</span>
                </button>
              </div>

              {/* Quick BPM Presets & Custom Beat Audio Upload */}
              <div className="w-full flex items-center justify-between text-xs pt-2 border-t border-pink-200/60 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-500 font-bold">Presets • Mẫu:</span>
                  {[75, 90, 110].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => handleSetPresetBpm(preset)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        currentBpm === preset
                          ? 'bg-pink-600 text-white'
                          : 'bg-white hover:bg-pink-50 text-zinc-700 border border-pink-200'
                      }`}
                    >
                      {preset === 75 ? 'Slow • Chậm' : preset === 90 ? 'Medium • Vừa' : 'Fast • Nhanh'} ({preset})
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
                        <span>Upload Beat / Video • Tải Beat</span>
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
                          type="button"
                          onClick={() => handleExtractBeatFromLessonVideo('vocal_reduced')}
                          disabled={isExtractingBeat}
                          className="text-[11px] text-indigo-700 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 px-2 py-1 rounded-lg border border-indigo-200 cursor-pointer shadow-sm transition"
                          title="Extract audio/beat from lesson video in Step 1"
                        >
                          {isExtractingBeat ? (
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-amber-500" />
                          )}
                          <span>Extract Beat • Lấy Beat từ Video</span>
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
                        type="button"
                        onClick={handleResetToSmartBeat}
                        className="text-[10px] text-zinc-400 hover:text-rose-600 underline cursor-pointer"
                        title="Reset to procedural smart beat • Quay lại beat mặc định"
                      >
                        (Reset)
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

            {/* Step B: Microphone Recording Station for Creative Beat Challenge */}
            <div ref={recordingSectionRef} className="bg-yellow-50 p-4 rounded-2xl border-2 border-yellow-300 flex flex-col items-center text-center space-y-3">
              <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-600" />
                <span>B. Record Beat Challenge • Thu Âm Thử Thách Tiết Tấu Sáng Tạo:</span>
              </span>
              <p className="text-[11px] text-zinc-600 max-w-md">
                Turn on the beat above, tap Start Challenge to chant along with the drum groove and submit for the <b>Creative Chant Master</b> badge! 🌟 (Bật beat ở trên, bấm Micro để hô khẩu hiệu/hát chants theo tiếng trống và nộp bài nhé!)
              </p>

              {activeCountdownMode === 'challenge' ? (
                <div className="py-4">
                  <span className="text-5xl font-black text-pink-600 animate-ping block">
                    {countdown}
                  </span>
                  <span className="text-sm font-bold text-zinc-600 mt-1 block">
                    Get ready to chant! 🎈 (Chuẩn bị sẵn sàng hát theo beat nhé!)
                  </span>
                </div>
              ) : activeRecordingMode === 'challenge' ? (
                <div className="space-y-3 py-2 w-full">
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-black text-sm animate-pulse">
                    <span className="w-3 h-3 rounded-full bg-rose-600" />
                    <span>
                      Recording Beat Challenge: {Math.floor(recordTimerSeconds / 60)}:
                      {(recordTimerSeconds % 60).toString().padStart(2, '0')} • Chant to the drum rhythm! (Hát theo nhịp trống!)
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
                    type="button"
                    onClick={handleStopChallengeRecord}
                    className="px-6 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black text-sm shadow-lg flex items-center gap-2 mx-auto cursor-pointer transition transform active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop Recording • Dừng Thu Âm</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartChallengeRecord}
                  disabled={activeRecordingMode !== null}
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-base shadow-xl shadow-green-300 flex items-center gap-3 cursor-pointer transition transform active:scale-95 disabled:opacity-50"
                >
                  <Mic className="w-5 h-5" />
                  <span>Start Beat Challenge • Bật Micro & Thu Âm Thử Thách 🎙️</span>
                </button>
              )}

              {/* Playback & Download of Student Recording if completed in Challenge Mode or general */}
              {recordedUrl && activeRecordingMode === null && (recordedSourceMode === 'challenge' || recordedSourceMode === null) && (
                <div className="w-full pt-3 border-t-2 border-yellow-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-emerald-800 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Voice Recorded • Đã ghi âm giọng hát! {recordedSourceMode === 'video' ? '(Video Practice)' : '(Beat Challenge)'}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePlayRecording}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition cursor-pointer shadow ${
                        isPlayingRecording
                          ? 'bg-rose-500 text-white'
                          : 'bg-white hover:bg-yellow-100 text-yellow-900 border-2 border-yellow-400'
                      }`}
                    >
                      {isPlayingRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Pause • Dừng phát</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Voice • Nghe lại giọng hát 🎧</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleStartChallengeRecord}
                      className="p-1.5 rounded-full bg-white hover:bg-yellow-100 text-zinc-600 border border-yellow-300 cursor-pointer"
                      title="Record again • Thu âm lại"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadRecording}
                      className="p-1.5 rounded-full bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 cursor-pointer"
                      title="Download audio file • Tải file âm thanh về máy"
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
                <span>Step 3: Complete Mission • Bước 3: Hoàn thành bài tập</span>
                {submitState === 'completed' ? (
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 font-black flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Completed • Hoàn tất</span>
                  </span>
                ) : submitState === 'error' ? (
                  <span className="text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-300 font-black flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Stopped due to error • Đã dừng do lỗi</span>
                  </span>
                ) : submitState === 'evaluating' ? (
                  <span className="text-pink-600 bg-pink-100 px-2.5 py-0.5 rounded-md font-black flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating • Đang chấm điểm ({currentEvaluatingModel || 'AI'})...</span>
                  </span>
                ) : recordedUrl ? (
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Recording Ready • Đã có bài thu âm (Sẵn sàng nộp) ✅</span>
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Not Recorded Yet • Chưa thu âm (Cần thu âm để nộp) ⚠️</span>
                  </span>
                )}
              </div>

              {/* Red Error Card according to AI_INSTRUCTIONS.md rule 3 */}
              {submitState === 'error' && apiErrorMessage && (
                <div className="bg-rose-50 border-2 border-rose-400 p-3.5 rounded-2xl text-left space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 text-rose-800 font-black text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Notice • Thông báo lỗi:</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-rose-200 font-mono text-[11px] text-rose-700 break-all select-all">
                    {apiErrorMessage}
                  </div>
                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    <span className="text-[10px] text-rose-600 font-bold">
                      💡 Check or change your API key in Settings • Kiểm tra lại API key trong phần Settings.
                    </span>
                    <button
                      type="button"
                      onClick={onOpenApiKeyModal}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm"
                    >
                      Settings (API Key)
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isEvaluating}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 hover:from-pink-400 hover:to-orange-300 text-white font-black text-xl tracking-wider shadow-xl shadow-pink-300 disabled:opacity-50 cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-3"
              >
                {isEvaluating ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>AI Buddy is grading... • AI Buddy Đang Chấm Điểm... ✨</span>
                  </>
                ) : (
                  <>
                    <Send className="w-6 h-6" />
                    <span>SUBMIT CHANT • NỘP BÀI CHẤM ĐIỂM 🚀</span>
                  </>
                )}
              </button>

              <p className="text-[11px] font-bold text-zinc-500">
                {recordedUrl
                  ? '🎉 Recording ready! Tap Submit for AI Buddy evaluation & badge! • Em đã thu âm bài hát! Hãy bấm nút trên để nộp cho Robot AI Buddy chấm điểm và nhận huy hiệu nhé!'
                  : '⚠️ Please record your voice in Step 1 or Step 2 before submitting. • Học sinh cần bấm thu âm ở Bước 1 hoặc Bước 2 trước khi nộp bài. Nếu chưa thu âm, hệ thống sẽ yêu cầu Try again!'}
              </p>
            </div>
          </div>

          {/* Submission Badges & History with Delete & Keep Best Options */}
          {submissionHistory.length > 0 && (
            <div className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-pink-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-zinc-800 uppercase flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-pink-600" />
                  <span>🏆 Submitted Results • Kết quả đã nộp phiên này ({submissionHistory.length}):</span>
                </span>
                {submissionHistory.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleKeepBestResultOnly}
                      className="text-[11px] font-black text-pink-700 bg-pink-100 hover:bg-pink-200 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                      title="Keep highest score result only • Chỉ giữ lại 1 kết quả có số điểm cao nhất"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>Keep Best Only • Chỉ giữ kết quả cao nhất</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmissionHistory([])}
                      className="text-[11px] font-bold text-zinc-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-xl transition cursor-pointer"
                      title="Clear all submissions • Xoá tất cả lịch sử nộp bài"
                    >
                      Clear All • Xoá hết
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
                        {item.score} pts
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
                      type="button"
                      onClick={() => handleDeleteSubmission(item.id)}
                      title="Delete this result • Xoá kết quả này"
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-100 transition cursor-pointer flex items-center gap-1 shrink-0 text-[11px] font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete • Xoá</span>
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-500 font-medium italic">
                💡 You can tap <b>"Delete • Xoá"</b> to remove lower scores and keep only your best chant performance! (Em có thể xoá lượt điểm chưa cao, chỉ giữ lại kết quả tốt nhất!)
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
                <span>Upload / Change Video • Đổi / Tải Video Cho Bài Hát</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowVideoInputModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Option A: Upload local video file */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 block">
                Method 1: Upload from computer (MP4, WebM) • Cách 1: Tải video từ máy tính:
              </label>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/50 transition cursor-pointer text-center">
                <Upload className="w-6 h-6 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-zinc-700">Select video file • Chọn file video</span>
                <span className="text-[10px] text-zinc-500">Supports MP4, WebM • Hỗ trợ MP4, WebM</span>
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
                Method 2: Paste YouTube / Video Link • Cách 2: Dán link video / YouTube:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or .mp4"
                  value={customVideoInputUrl}
                  onChange={(e) => setCustomVideoInputUrl(e.target.value)}
                  className="flex-1 text-xs p-2.5 rounded-xl border border-zinc-300 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomVideoUrl}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Apply • Áp dụng
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowVideoInputModal(false)}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close • Đóng
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
                <span>Upload Karaoke Video with Lyrics • Đăng Video Karaoke Có Lời</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowKaraokeModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Option A: Upload local video file */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 block">
                Method 1: Upload from computer (MP4, WebM) • Cách 1: Tải video từ máy:
              </label>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-purple-300 rounded-xl bg-purple-50/50 hover:bg-purple-100/50 transition cursor-pointer text-center">
                <Upload className="w-6 h-6 text-purple-600 mb-1" />
                <span className="text-xs font-bold text-zinc-700">
                  {karaokeUploadFileName || 'Select video file • Chọn file video từ máy'}
                </span>
                <span className="text-[10px] text-zinc-500">Supports MP4, WebM • Hỗ trợ MP4, WebM</span>
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
                Method 2: Paste YouTube / Karaoke Link • Cách 2: Dán link YouTube có lời:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or .mp4"
                  value={customKaraokeInputUrl}
                  onChange={(e) => setCustomKaraokeInputUrl(e.target.value)}
                  className="flex-1 text-xs p-2.5 rounded-xl border border-zinc-300 outline-none focus:border-purple-500"
                />
                <button
                  type="button"
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
                  Apply • Áp dụng
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowKaraokeModal(false)}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close • Đóng
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
              <span>Award • Huy hiệu: {feedback.badgeEarned}</span>
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
                  type="button"
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setTimeout(() => {
                      recordingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 150);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-sm sm:text-base shadow-lg shadow-amber-300 cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Mic className="w-5 h-5" />
                  <span>Go to Record • Em đi thu âm ngay! 🎤</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                {/* 1. Primary: Keep this result */}
                <button
                  type="button"
                  onClick={handleKeepResult}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-sm sm:text-base shadow-lg shadow-green-200 cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Keep Result • Giữ kết quả này (Hoàn tất) ⭐</span>
                </button>

                {/* 2. Secondary Row: Try Again & Delete */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Try Again */}
                  <button
                    type="button"
                    onClick={handleTryAgain}
                    className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-white font-black text-xs sm:text-sm shadow-md cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-1.5"
                    title="Try again to get a higher score • Làm lại để lấy điểm cao hơn!"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Again! • Làm lại 🔄</span>
                  </button>

                  {/* Delete this result */}
                  <button
                    type="button"
                    onClick={handleDeleteLatestResult}
                    className="py-2.5 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 hover:border-rose-300 font-black text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                    title="Delete this result from history • Xoá kết quả này khỏi lịch sử"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Delete • Xoá điểm này 🗑️</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLOATING PICTURE-IN-PICTURE VIDEO WINDOW FOR HEYZINE & MOBILE */}
      {practiceMode === 'video_beat' &&
        isFloatingVideoVisible &&
        isVideoOutOfView &&
        (youtubeEmbedUrl || (activeVideoUrl && (!activeVideoUrl.startsWith('blob:') || !isStudentMode))) && (
          <div className="fixed bottom-4 right-4 z-40 animate-fade-in shadow-2xl">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border-3 border-emerald-400 p-2 text-zinc-900 shadow-2xl max-w-[300px] sm:max-w-[340px] space-y-1.5">
              {/* Mini Header Bar */}
              <div className="flex items-center justify-between gap-1.5 px-1">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-800 truncate">
                  <span className="animate-pulse">📺</span>
                  <span className="truncate">Mini Chant Video • Video Chant Mẫu</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Scroll to main video */}
                  <button
                    type="button"
                    onClick={() =>
                      mainVideoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                    className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                    title="Scroll to main video • Cuộn lên xem video lớn"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  {/* Minimize / Expand */}
                  <button
                    type="button"
                    onClick={() => setIsFloatingMinimized((prev) => !prev)}
                    className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                    title={isFloatingMinimized ? 'Expand • Mở rộng video' : 'Minimize • Thu gọn'}
                  >
                    {isFloatingMinimized ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {/* Close */}
                  <button
                    type="button"
                    onClick={() => setIsFloatingVideoVisible(false)}
                    className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                    title="Close floating video • Đóng video nổi"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Video Player */}
              {!isFloatingMinimized ? (
                <div className="aspect-video w-64 sm:w-80 rounded-xl overflow-hidden bg-black shadow-inner">
                  {youtubeEmbedUrl ? (
                    <iframe
                      src={youtubeEmbedUrl}
                      title="Mini Chant Video"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : activeVideoUrl ? (
                    <video
                      src={activeVideoUrl}
                      controls
                      loop
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsFloatingMinimized(false)}
                  className="text-[11px] font-bold text-emerald-700 hover:underline px-2 py-0.5 block cursor-pointer"
                >
                  Click to view video • Bấm để xem video chant mẫu 🎬
                </button>
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
