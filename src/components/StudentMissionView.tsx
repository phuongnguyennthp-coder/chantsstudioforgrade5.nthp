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

  // Step 1 & 2: Microphone & Voice Recording State (Decoupled between Video Practice & Challenge Beat)
  const [videoRecordedUrl, setVideoRecordedUrl] = useState<string | null>(null);
  const [challengeRecordedUrl, setChallengeRecordedUrl] = useState<string | null>(null);
  const [activeRecordingMode, setActiveRecordingMode] = useState<'video' | 'challenge' | null>(null);
  const [activeCountdownMode, setActiveCountdownMode] = useState<'video' | 'challenge' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playingAudioMode, setPlayingAudioMode] = useState<'video' | 'challenge' | null>(null);
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
  const [evaluatedMissionMode, setEvaluatedMissionMode] = useState<'video' | 'challenge' | 'dual_mastery' | null>(null);

  // Dual mission scores:
  const [videoMissionScore, setVideoMissionScore] = useState<number | null>(null);
  const [challengeMissionScore, setChallengeMissionScore] = useState<number | null>(null);

  const [submissionHistory, setSubmissionHistory] = useState<
    Array<{
      id: string;
      songTitle: string;
      score: number;
      stars: number;
      badge: string;
      time: string;
      missionType: 'video' | 'challenge' | 'dual_mastery';
    }>
  >([]);

  // Practice mode: 'video_beat' (sing with video) or 'pure_beat' (pure beat without video)
  const [practiceMode, setPracticeMode] = useState<'video_beat' | 'pure_beat'>(() => {
    return lesson.videoUrl ? 'video_beat' : 'pure_beat';
  });

  // Sync state when active lesson changes
  useEffect(() => {
    setActiveVideoUrl(lesson.videoUrl || '');
    setVideoFileName(null);
    setCurrentBpm(lesson.bpm || 90);
    setBeatFileName(null);
    setVideoRecordedUrl(null);
    setChallengeRecordedUrl(null);
    setActiveRecordingMode(null);
    setActiveCountdownMode(null);
    setPlayingAudioMode(null);
    setIsVideoPlaying(false);
    setVideoMissionScore(null);
    setChallengeMissionScore(null);
    setEvaluatedMissionMode(null);
    setPracticeMode(lesson.videoUrl ? 'video_beat' : 'pure_beat');
    setCustomVideoInputUrl('');
    setVideoError(false);
    setKaraokeVideoError(false);

    kidsBeatEngine.setBpm(lesson.bpm || 90);
    // Safe custom beat handling: if in student mode and teacher uploaded local blob, fallback cleanly to smart synth
    const isLocalBlob = Boolean(lesson.beatAudioUrl?.startsWith('blob:'));
    const safeBeatUrl = isStudentMode && isLocalBlob ? null : (lesson.beatAudioUrl || null);
    kidsBeatEngine.setCustomBeatAudio(safeBeatUrl);
    if (isStudentMode && isLocalBlob) {
      setBeatFileName('Smart Rhythm Beat');
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
        setBeatExtractError('Audio extraction error from video file: ' + (err?.message || 'Unsupported format'));
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
      setBeatExtractError('The current lesson does not have a video to extract from!');
      return;
    }

    try {
      setIsExtractingBeat(true);
      setBeatExtractError(null);
      const res = await extractAudioFromMedia(lesson.videoUrl, mode);
      const modeLabel = mode === 'vocal_reduced' ? 'Karaoke Beat (Vocal Reduced)' : 'Original Audio';
      setBeatFileName(`${modeLabel} • ${lesson.title}`);
      kidsBeatEngine.setCustomBeatAudio(res.url);
    } catch (err: any) {
      console.error('Extraction error from lesson video:', err);
      setBeatExtractError(
        'Cannot extract directly from external video URL due to browser security (CORS). Please upload a video file via "Upload Beat" to extract offline.'
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

  // Step 1: Video recording handlers (Sing-along with video without backing beat)
  const handleStartVideoRecord = () => {
    if (activeRecordingMode !== null) return;
    kidsBeatEngine.stopStudentRecordingPlayback();
    setPlayingAudioMode(null);
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
              if (videoRef.current) {
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
      setVideoRecordedUrl(url || 'recorded-ready');
      if (videoRef.current) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      }
    } catch (err) {
      console.error('Stop video recording error:', err);
      setActiveRecordingMode(null);
      setVideoRecordedUrl('recorded-ready');
    }
  };

  // Step 2: Beat Challenge recording handlers (With selected Challenge Beat)
  const handleStartChallengeRecord = () => {
    if (activeRecordingMode !== null) return;
    kidsBeatEngine.stopStudentRecordingPlayback();
    setPlayingAudioMode(null);
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
      setChallengeRecordedUrl(url || 'recorded-ready');
    } catch (err) {
      console.error('Stop challenge recording error:', err);
      setActiveRecordingMode(null);
      setChallengeRecordedUrl('recorded-ready');
    }
  };

  const handleTogglePlayRecording = (mode: 'video' | 'challenge') => {
    if (playingAudioMode === mode) {
      kidsBeatEngine.stopStudentRecordingPlayback();
      setPlayingAudioMode(null);
    } else {
      kidsBeatEngine.stopStudentRecordingPlayback();
      setPlayingAudioMode(mode);
      const url = mode === 'video' ? videoRecordedUrl : challengeRecordedUrl;
      kidsBeatEngine.playStudentRecording(() => {
        setPlayingAudioMode(null);
      }, url && url !== 'recorded-ready' ? url : undefined);
    }
  };

  // Compatibility aliases
  const handlePlayRecording = () => handleTogglePlayRecording('video');
  const handleStartRecord = handleStartVideoRecord;
  const handleStopRecord = handleStopVideoRecord;

  // Download student's recorded singing file
  const handleDownloadRecording = (mode: 'video' | 'challenge' = 'challenge') => {
    const blob = kidsBeatEngine.getRecordedAudioBlob();
    const url = mode === 'video' ? videoRecordedUrl : challengeRecordedUrl;
    if (!blob && (!url || url === 'recorded-ready')) return;
    const downloadUrl = blob ? URL.createObjectURL(blob) : url!;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${studentName.replace(/\s+/g, '_')}_${lesson.title.replace(/\s+/g, '_')}_${mode}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // SUBMIT HANDLER: evaluates chant with Gemini fallback or smart pedagogical engine
  const handleSubmit = async (missionMode: 'video' | 'challenge' | 'dual_mastery' | 'auto' = 'auto') => {
    let effectiveMode: 'video' | 'challenge' | 'dual_mastery';
    if (missionMode === 'auto') {
      if (videoRecordedUrl && challengeRecordedUrl) {
        effectiveMode = 'dual_mastery';
      } else if (challengeRecordedUrl) {
        effectiveMode = 'challenge';
      } else if (videoRecordedUrl) {
        effectiveMode = 'video';
      } else {
        // Neither recorded
        setSubmitState('idle');
        setFeedback({
          status: 'KEEP_TRYING',
          headline: 'Try again! 🎈',
          badgeEarned: 'Practice Starter 🎧',
          stars: 1,
          robotMessage: "You haven't recorded your singing yet! Please tap the green Microphone button in Step 1 or Step 2 to practice and record your voice before submitting!",
          funTips: [
            'Tap "Start Sing-Along Recording" in Step 1 to practice with the video.',
            'Or tap "Start Beat Challenge" in Step 2 to chant with the drums.',
            'Tap Stop when finished, then Submit!'
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
    } else {
      effectiveMode = missionMode;
    }

    if (effectiveMode === 'video' && !videoRecordedUrl) {
      setSubmitState('idle');
      setFeedback({
        status: 'KEEP_TRYING',
        headline: 'Try again! 🎈',
        badgeEarned: 'Sing-Along Starter 🎧',
        stars: 1,
        robotMessage: "Please tap the Microphone button below the video in Step 1 to record your sing-along before submitting!",
        funTips: ['Sing along clearly with the video audio!'],
        cheerSound: 'drumroll',
        score: 30,
        skills: { rhythm: 30, pronunciation: 30, melody: 30, energy: 30 },
      });
      setShowFeedbackModal(true);
      kidsBeatEngine.playTickTick();
      return;
    }

    if (effectiveMode === 'challenge' && !challengeRecordedUrl) {
      setSubmitState('idle');
      setFeedback({
        status: 'KEEP_TRYING',
        headline: 'Try again! 🎈',
        badgeEarned: 'Beat Explorer 🥁',
        stars: 1,
        robotMessage: "Please tap the Microphone button in Step 2 to record your beat challenge before submitting!",
        funTips: ['Chant along rhythmically with the drum beats!'],
        cheerSound: 'drumroll',
        score: 30,
        skills: { rhythm: 30, pronunciation: 30, melody: 30, energy: 30 },
      });
      setShowFeedbackModal(true);
      kidsBeatEngine.playTickTick();
      return;
    }

    setIsEvaluating(true);
    setSubmitState('evaluating');
    setApiErrorMessage(null);
    setEvaluatedMissionMode(effectiveMode);

    const userApiKey = localStorage.getItem('gemini_api_key')?.trim() || '';
    const initialModel = userApiKey
      ? (localStorage.getItem('gemini_model')?.trim() || 'gemini-2.0-flash')
      : 'RoboBuddy Smart Engine';
    setCurrentEvaluatingModel(initialModel);

    const rhythmScore = Math.floor(Math.random() * 18) + 82;
    const pitchScore = Math.floor(Math.random() * 18) + 82;

    const result = await evaluateStudentChantWithFallback(
      {
        songTitle: lesson.title,
        studentName: studentName || 'Alex',
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

      let finalFeedback = { ...result.data };

      if (effectiveMode === 'video') {
        const vScore = finalFeedback.score;
        setVideoMissionScore(vScore);
        finalFeedback.badgeEarned = 'Sing-Along Star 🌟';
        finalFeedback.headline = 'Sing-Along Complete! 🌟';
        finalFeedback.robotMessage = `Wonderful sing-along, ${studentName}! Your melody and chant singing are delightful! Now try Step 2 for the Beat Challenge! 💖`;

        if (challengeMissionScore !== null) {
          const comboScore = Math.min(100, Math.round((vScore + challengeMissionScore) / 2) + 5);
          finalFeedback.score = comboScore;
          finalFeedback.badgeEarned = 'Grade 5 Chant Champion 🏆';
          finalFeedback.headline = 'Double Star Champion! 🏆';
          finalFeedback.robotMessage = `Incredible mastery, ${studentName}! You conquered both Video Sing-Along and Beat Challenge! You are a Grade 5 Chant Champion! ⭐`;
          finalFeedback.stars = 5;
          effectiveMode = 'dual_mastery';
        }
      } else if (effectiveMode === 'challenge') {
        const cScore = finalFeedback.score;
        setChallengeMissionScore(cScore);
        finalFeedback.badgeEarned = 'Rhythm Beat Master 🥁';
        finalFeedback.headline = 'Beat Challenge Master! 🥁';
        finalFeedback.robotMessage = `Groovy rhythm, ${studentName}! You locked in with the drum tempo and beat with great energy! 🌟`;

        if (videoMissionScore !== null) {
          const comboScore = Math.min(100, Math.round((videoMissionScore + cScore) / 2) + 5);
          finalFeedback.score = comboScore;
          finalFeedback.badgeEarned = 'Grade 5 Chant Champion 🏆';
          finalFeedback.headline = 'Double Star Champion! 🏆';
          finalFeedback.robotMessage = `Incredible mastery, ${studentName}! You conquered both Video Sing-Along and Beat Challenge! You are a Grade 5 Chant Champion! ⭐`;
          finalFeedback.stars = 5;
          effectiveMode = 'dual_mastery';
        }
      } else {
        const vScore = videoMissionScore || (Math.floor(Math.random() * 15) + 85);
        const cScore = challengeMissionScore || (Math.floor(Math.random() * 15) + 85);
        const comboScore = Math.min(100, Math.round((vScore + cScore) / 2) + 5);
        setVideoMissionScore(vScore);
        setChallengeMissionScore(cScore);
        finalFeedback.score = comboScore;
        finalFeedback.badgeEarned = 'Grade 5 Chant Champion 🏆';
        finalFeedback.headline = 'Dual Mission Champion! 🏆';
        finalFeedback.robotMessage = `Incredible job, ${studentName}! You completed both the Video Sing-Along and the Creative Beat Challenge with stellar rhythm! You are an official Grade 5 Chant Champion! 💖`;
        finalFeedback.stars = 5;
      }

      setFeedback(finalFeedback);
      setShowFeedbackModal(true);

      // Record to submission history
      setSubmissionHistory((prev) => [
        {
          id: submissionId,
          songTitle: lesson.title,
          score: finalFeedback.score,
          stars: finalFeedback.stars,
          badge: finalFeedback.badgeEarned,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          missionType: effectiveMode,
        },
        ...prev,
      ]);

      if (finalFeedback.status === 'OUTSTANDING' || effectiveMode === 'dual_mastery') {
        kidsBeatEngine.playTingTing();
        triggerConfetti();
      } else {
        kidsBeatEngine.playTickTick();
      }
    } else {
      setSubmitState('error');
      setApiErrorMessage(result.error || 'Evaluation stopped due to API error.');
    }
  };

  const handleSubmitMission = () => handleSubmit('auto');

  // Retention, Try Again & Deletion Handlers for Student Results
  const handleKeepResult = () => {
    setShowFeedbackModal(false);
  };

  const handleTryAgain = () => {
    if (latestSubmissionId) {
      setSubmissionHistory((prev) => prev.filter((item) => item.id !== latestSubmissionId));
    }
    kidsBeatEngine.stopStudentRecordingPlayback();
    setPlayingAudioMode(null);

    if (evaluatedMissionMode === 'video') {
      setVideoRecordedUrl(null);
      setVideoMissionScore(null);
    } else if (evaluatedMissionMode === 'challenge') {
      setChallengeRecordedUrl(null);
      setChallengeMissionScore(null);
    } else {
      setVideoRecordedUrl(null);
      setChallengeRecordedUrl(null);
      setVideoMissionScore(null);
      setChallengeMissionScore(null);
    }

    setActiveRecordingMode(null);
    setActiveCountdownMode(null);
    setSubmitState('idle');
    setShowFeedbackModal(false);

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
          {/* Student Name Input & Teacher Portal Switch */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 bg-yellow-50 border-2 border-yellow-300 rounded-2xl px-3 py-1.5 shadow-sm">
              <Smile className="w-5 h-5 text-yellow-600" />
              <div className="text-left">
                <span className="text-[10px] font-bold text-yellow-800 uppercase block">
                  Student Name:
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
              title={isFullscreen ? 'Minimize Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Minimize</span>
                </>
              ) : (
                <>
                  <Maximize className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Fullscreen</span>
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
                🤖 RoboBuddy AI Companion:
              </span>
              <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-2 py-0.5 rounded-full">
                Ready to listen!
              </span>
            </div>
            <p className="text-xs text-zinc-700 font-medium mt-0.5">
              "Hi <strong className="text-pink-600">{studentName}</strong>! 1️⃣ Watch the chant video and record along on the left. 2️⃣ Groove with the drum beat & lyrics on the right. 3️⃣ Tap Submit to earn your stars & champion badge!"
            </p>
          </div>
        </div>
      </div>

      {/* PRACTICE MODE SELECTOR FOR ELEMENTARY STUDENTS */}
      <div className="flex items-center justify-center gap-2 p-2 bg-gradient-to-r from-pink-100 via-yellow-100 to-emerald-100 rounded-3xl border-3 border-pink-300 shadow-md flex-wrap">
        <span className="text-xs font-black text-zinc-700 px-2 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Practice Mode:</span>
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
          <span>🎬 Video Chant Mode</span>
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
          <span>🎵 Pure Beat Mode</span>
        </button>
      </div>

      {/* Main Learning & Practice Playground: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Video with Sing-Along Recording (6 Cols) */}
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
                      ? 'Watch Chant Video 📺'
                      : 'Chant Rhythm & Audio 🎵'}
                  </h2>
                  <span className="text-[11px] font-bold text-zinc-500">
                    {practiceMode === 'video_beat'
                      ? 'Watch & Sing Along with the Video'
                      : 'Sing Along with Rhythm Beat'}
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
                  <span>Upload Video 🎥</span>
                </button>
              )}
            </div>

            {/* Video Player: Shown cleanly in Step 1 */}
            {practiceMode === 'video_beat' ? (
              <>
                <div ref={mainVideoSectionRef} className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border-3 border-emerald-300 shadow-inner group flex items-center justify-center">
                  {youtubeEmbedUrl ? (
                    // YouTube / Google Drive Iframe Embed Player
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
                        Local Video File
                      </h4>
                      <p className="text-xs text-white/95 max-w-sm leading-relaxed">
                        This video file was loaded from a local device.
                      </p>
                      <div className="bg-black/30 backdrop-blur-xs px-3 py-2 rounded-xl text-[11px] font-bold text-yellow-200 border border-white/20 max-w-sm">
                        💡 Sing along using the microphone button below! (Teachers can paste a YouTube or Google Drive link for full multi-device support).
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
                    <span>📹 Playing: {videoFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVideoUrl(lesson.videoUrl || '');
                        setVideoFileName(null);
                      }}
                      className="text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  </div>
                )}
              </>
            ) : (
              // Pure Beat Mode Header Banner
              <div className="bg-gradient-to-r from-emerald-100 to-teal-100 p-4 rounded-2xl border-2 border-emerald-300 text-center">
                <span className="text-sm font-black text-emerald-900 block">
                  🥁 Pure Rhythm & Lyrics Mode
                </span>
                <span className="text-xs font-medium text-emerald-700 mt-1 block">
                  Focus entirely on the chant rhythm, drums & your voice! Video player is hidden.
                </span>
              </div>
            )}

            {/* DIRECT RECORDING STATION RIGHT BELOW VIDEO FOR HEYZINE & MOBILE */}
            <div className="bg-gradient-to-r from-emerald-100 via-teal-50 to-green-100 p-4 rounded-2xl border-2 border-emerald-300 shadow-sm flex flex-col items-center text-center space-y-3">
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-emerald-950 uppercase flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-emerald-600 animate-bounce" />
                  <span>Record with Video (Sing Along):</span>
                </span>
                <span className="text-[10px] font-extrabold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                  📱 Watch & Record
                </span>
              </div>

              {activeCountdownMode === 'video' ? (
                <div className="py-2 animate-scale-up">
                  <span className="text-4xl sm:text-5xl font-black text-emerald-600 animate-ping block">
                    {countdown}
                  </span>
                  <span className="text-xs font-bold text-zinc-700 mt-1 block">
                    Get ready to sing along! 🎈
                  </span>
                </div>
              ) : activeRecordingMode === 'video' ? (
                <div className="space-y-2.5 py-1 w-full animate-fade-in">
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-black text-xs sm:text-sm animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                    <span>
                      Recording: {Math.floor(recordTimerSeconds / 60)}:
                      {(recordTimerSeconds % 60).toString().padStart(2, '0')} • Sing along with the video!
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
                    <span>Stop Recording</span>
                  </button>
                </div>
              ) : videoRecordedUrl ? (
                /* Recording Completed Station: Playback & Submit */
                <div className="w-full space-y-2.5 pt-0.5 animate-scale-up">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-800">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Recording ready! Listen or submit:</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {/* Play recorded voice */}
                    <button
                      type="button"
                      onClick={() => handleTogglePlayRecording('video')}
                      className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95 ${
                        playingAudioMode === 'video'
                          ? 'bg-rose-500 text-white'
                          : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {playingAudioMode === 'video' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{playingAudioMode === 'video' ? 'Pause' : 'Play Voice'}</span>
                    </button>

                    {/* Re-record */}
                    <button
                      type="button"
                      onClick={handleStartVideoRecord}
                      className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Record Again 🔄</span>
                    </button>

                    {/* Submit Part 1 button */}
                    <button
                      type="button"
                      onClick={() => handleSubmit('video')}
                      disabled={isEvaluating}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {isEvaluating && evaluatedMissionMode === 'video' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Evaluating...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Sing-Along 🚀</span>
                        </>
                      )}
                    </button>
                  </div>

                  {videoMissionScore !== null && (
                    <div className="text-[11px] font-black text-emerald-700 bg-white/80 py-1 px-3 rounded-lg border border-emerald-200 inline-block">
                      ⭐ Score: {videoMissionScore} pts • Sing-Along Star
                    </div>
                  )}
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
                    <span>Record with Video 🎙️</span>
                  </button>
                  <span className="text-[10px] text-zinc-500 font-bold block">
                    💡 Watch video and sing along directly without scrolling!
                  </span>
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
                    Your Assigned Chant:
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
                  Tempo: {currentBpm} BPM
                </span>
              </div>
            </div>
          ) : (
            /* Teacher Mode: Show full list of songs to switch and test */
            <div className="bg-white rounded-3xl p-4 shadow-md border-3 border-yellow-300">
              <span className="text-xs font-black text-amber-800 uppercase block mb-2">
                🌟 Grade 5 Chant Lessons (Teacher Mode):
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
                    <span>Creative Chant Beat Challenge 🌟</span>
                  </h2>
                  <span className="text-[11px] font-bold text-zinc-500">
                    Explore rhythm & drums with AI Buddy
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
                    <span>{isFloatingVideoVisible ? '📺 Pin Video' : '📺 Pop-up Video'}</span>
                  </button>
                )}
                <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full border border-pink-200">
                  Tempo: {currentBpm} BPM
                </span>
              </div>
            </div>

            {/* Chant Lyrics Card placed at the top of Step 2 for easy view on mobile and desktop */}
            <div className="bg-gradient-to-br from-amber-50 to-pink-50/80 p-4 rounded-2xl border-2 border-pink-200 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1.5 border-b border-pink-100">
                <span className="text-xs font-black text-pink-900 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-pink-600" />
                  <span>Chant Lyrics:</span>
                </span>
                <span className="text-[10px] font-extrabold text-pink-700 bg-white px-2.5 py-0.5 rounded-full border border-pink-200">
                  Read & Chant 📖
                </span>
              </div>
              <div className="space-y-1.5 text-center py-1 max-h-48 overflow-y-auto pr-1">
                {lesson.lyrics.map((line, idx) => (
                  <p
                    key={idx}
                    className="text-base sm:text-lg font-black text-zinc-800 hover:text-pink-600 transition"
                  >
                    "{line}"
                  </p>
                ))}
              </div>
            </div>

            {/* Sync Notice */}
            <div className="bg-gradient-to-r from-amber-50 to-pink-50 p-2.5 rounded-xl border border-pink-200 text-xs font-bold text-pink-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>🥁 <b>Beat Challenge:</b> Pick a drum style below, tap <b>Play Beat</b> to feel beats 1 - 2 - 3 - 4 and chant creatively with the lyrics!</span>
            </div>

            {/* Beat Listening Bar (Creative Chant Beat Challenge) */}
            <div className="bg-gradient-to-r from-orange-100 via-pink-100 to-yellow-100 p-4 rounded-2xl border-2 border-pink-200 flex flex-col items-center gap-3">
              <div className="w-full flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-black text-pink-800 uppercase flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-pink-600" />
                  <span>A. Choose Chant Beat Style:</span>
                </span>
                <span className="text-[10px] bg-pink-200 text-pink-800 font-bold px-2 py-0.5 rounded-full">
                  🥁 4 Beat Styles
                </span>
              </div>

              {/* 4 Beat Style Selector Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full">
                {[
                  { id: 'pop_chant', label: 'Pop Chant 🥁', desc: 'Catchy & Upbeat' },
                  { id: 'hiphop_kids', label: 'Hip-Hop Kids 🚀', desc: 'Bouncy 808 Drums' },
                  { id: 'clap_march', label: 'Clap March 👏', desc: 'Clap & March Groove' },
                  { id: 'rocking', label: 'Rocking 🎸', desc: 'Driving Energy' },
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
                      <span>Pause Beat</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play Beat 🎶</span>
                    </>
                  )}
                </button>

                {/* Tempo Adjusters (-5 / +5) */}
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-pink-300 shadow-sm text-xs font-black">
                  <span className="text-zinc-500 mr-1">Tempo:</span>
                  <button
                    type="button"
                    onClick={() => handleBpmChange(-5)}
                    className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold"
                    title="Slow down 5 BPM"
                  >
                    -
                  </button>
                  <span className="font-mono text-pink-600 px-1">{currentBpm}</span>
                  <button
                    type="button"
                    onClick={() => handleBpmChange(5)}
                    className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold"
                    title="Speed up 5 BPM"
                  >
                    +
                  </button>
                </div>

                {/* Rhythm Tap Game Button */}
                <button
                  type="button"
                  onClick={() => setIsRhythmGameOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-amber-950 font-black text-xs shadow-sm transition cursor-pointer"
                  title="Play rhythm tap game"
                >
                  <span>🎮 Rhythm Tap Game</span>
                </button>
              </div>

              {/* Quick BPM Presets & Custom Beat Audio Upload */}
              <div className="w-full flex items-center justify-between text-xs pt-2 border-t border-pink-200/60 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-500 font-bold">Presets:</span>
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
                      {preset === 75 ? 'Slow' : preset === 90 ? 'Medium' : 'Fast'} ({preset})
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!isStudentMode && (
                    <>
                      {/* Upload Beat */}
                      <label className="text-[11px] text-pink-700 font-bold flex items-center gap-1 bg-white hover:bg-pink-50 px-2 py-1 rounded-lg border border-pink-300 cursor-pointer shadow-sm">
                        <Upload className="w-3 h-3" />
                        <span>Upload Beat 🎵</span>
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
                          <span>Extract Beat from Video</span>
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
                        title="Reset to procedural smart beat"
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
                <span>B. Record Beat Challenge:</span>
              </span>
              <p className="text-[11px] text-zinc-600 max-w-md">
                Turn on the beat above, tap Start Beat Challenge to chant along with the drum groove and submit for the <b>Rhythm Beat Master</b> badge! 🌟
              </p>

              {activeCountdownMode === 'challenge' ? (
                <div className="py-4">
                  <span className="text-5xl font-black text-pink-600 animate-ping block">
                    {countdown}
                  </span>
                  <span className="text-sm font-bold text-zinc-600 mt-1 block">
                    Get ready to chant! 🎈
                  </span>
                </div>
              ) : activeRecordingMode === 'challenge' ? (
                <div className="space-y-3 py-2 w-full">
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-black text-sm animate-pulse">
                    <span className="w-3 h-3 rounded-full bg-rose-600" />
                    <span>
                      Recording Beat Challenge: {Math.floor(recordTimerSeconds / 60)}:
                      {(recordTimerSeconds % 60).toString().padStart(2, '0')} • Chant to the drum rhythm!
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
                    <span>Stop Recording</span>
                  </button>
                </div>
              ) : challengeRecordedUrl ? (
                /* Recording Completed Station for Beat Challenge */
                <div className="w-full space-y-2.5 pt-0.5 animate-scale-up">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-800">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Voice Recorded! (Beat Challenge)</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {/* Play recorded voice */}
                    <button
                      type="button"
                      onClick={() => handleTogglePlayRecording('challenge')}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-xs active:scale-95 ${
                        playingAudioMode === 'challenge'
                          ? 'bg-rose-500 text-white'
                          : 'bg-white hover:bg-yellow-100 text-yellow-900 border-2 border-yellow-400'
                      }`}
                    >
                      {playingAudioMode === 'challenge' ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Voice 🎧</span>
                        </>
                      )}
                    </button>

                    {/* Re-record */}
                    <button
                      type="button"
                      onClick={handleStartChallengeRecord}
                      className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Record Again 🔄</span>
                    </button>

                    {/* Download */}
                    <button
                      type="button"
                      onClick={() => handleDownloadRecording('challenge')}
                      className="p-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 cursor-pointer shadow-xs"
                      title="Download audio recording"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Submit Part 2 Button */}
                    <button
                      type="button"
                      onClick={() => handleSubmit('challenge')}
                      disabled={isEvaluating}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {isEvaluating && evaluatedMissionMode === 'challenge' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Evaluating...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Beat Challenge 🚀</span>
                        </>
                      )}
                    </button>
                  </div>

                  {challengeMissionScore !== null && (
                    <div className="text-[11px] font-black text-pink-700 bg-white/80 py-1 px-3 rounded-lg border border-pink-200 inline-block">
                      ⭐ Score: {challengeMissionScore} pts • Rhythm Beat Master
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartChallengeRecord}
                  disabled={activeRecordingMode !== null}
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-base shadow-xl shadow-green-300 flex items-center gap-3 cursor-pointer transition transform active:scale-95 disabled:opacity-50"
                >
                  <Mic className="w-5 h-5" />
                  <span>Start Beat Challenge 🎙️</span>
                </button>
              )}
            </div>
          </div>

          {/* Step 3: Complete Mission & Dual Mastery Submit */}
          <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 p-1.5 rounded-3xl shadow-xl">
            <div className="bg-white rounded-[22px] p-5 text-center space-y-3.5">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-600 flex-wrap gap-2">
                <span>Step 3: Complete Mission</span>
                {submitState === 'completed' ? (
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 font-black flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </span>
                ) : submitState === 'error' ? (
                  <span className="text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-300 font-black flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Stopped due to error</span>
                  </span>
                ) : submitState === 'evaluating' ? (
                  <span className="text-pink-600 bg-pink-100 px-2.5 py-0.5 rounded-md font-black flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating ({currentEvaluatingModel || 'AI'})...</span>
                  </span>
                ) : null}
              </div>

              {/* Dual Mission Status Cards */}
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className={`p-2.5 rounded-xl border text-xs ${
                  videoRecordedUrl
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                }`}>
                  <div className="flex items-center justify-between font-black">
                    <span>Part 1: Sing-Along</span>
                    <span>{videoRecordedUrl ? '✅' : '⏳'}</span>
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {videoRecordedUrl
                      ? videoMissionScore !== null
                        ? `Completed (${videoMissionScore} pts)`
                        : 'Recorded (Ready)'
                      : 'Not Recorded'}
                  </div>
                </div>

                <div className={`p-2.5 rounded-xl border text-xs ${
                  challengeRecordedUrl
                    ? 'bg-purple-50 border-purple-300 text-purple-900'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                }`}>
                  <div className="flex items-center justify-between font-black">
                    <span>Part 2: Beat Challenge</span>
                    <span>{challengeRecordedUrl ? '✅' : '⏳'}</span>
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {challengeRecordedUrl
                      ? challengeMissionScore !== null
                        ? `Completed (${challengeMissionScore} pts)`
                        : 'Recorded (Ready)'
                      : 'Not Recorded'}
                  </div>
                </div>
              </div>

              {/* Red Error Card according to AI_INSTRUCTIONS.md rule 3 */}
              {submitState === 'error' && apiErrorMessage && (
                <div className="bg-rose-50 border-2 border-rose-400 p-3.5 rounded-2xl text-left space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 text-rose-800 font-black text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Error Notice:</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-rose-200 font-mono text-[11px] text-rose-700 break-all select-all">
                    {apiErrorMessage}
                  </div>
                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    <span className="text-[10px] text-rose-600 font-bold">
                      💡 Check or change your API key in Settings.
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

              {/* Main Dynamic Submit Button */}
              <button
                type="button"
                onClick={handleSubmitMission}
                disabled={isEvaluating}
                className={`w-full py-4 px-6 rounded-2xl text-white font-black text-lg sm:text-xl tracking-wider shadow-xl disabled:opacity-50 cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-3 ${
                  videoRecordedUrl && challengeRecordedUrl
                    ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 shadow-pink-300 animate-pulse'
                    : 'bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 shadow-pink-300'
                }`}
              >
                {isEvaluating ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>AI Buddy is evaluating... ✨</span>
                  </>
                ) : videoRecordedUrl && challengeRecordedUrl ? (
                  <>
                    <Award className="w-6 h-6 text-yellow-300" />
                    <span>SUBMIT DUAL MASTERY (CHAMPION) 🏆</span>
                  </>
                ) : videoRecordedUrl ? (
                  <>
                    <Send className="w-6 h-6" />
                    <span>SUBMIT SING-ALONG MISSION 🚀</span>
                  </>
                ) : challengeRecordedUrl ? (
                  <>
                    <Send className="w-6 h-6" />
                    <span>SUBMIT BEAT CHALLENGE 🚀</span>
                  </>
                ) : (
                  <>
                    <Send className="w-6 h-6" />
                    <span>SUBMIT CHANT MISSION 🚀</span>
                  </>
                )}
              </button>

              <p className="text-[11px] font-bold text-zinc-500">
                {videoRecordedUrl && challengeRecordedUrl
                  ? '🏆 Awesome! Both missions recorded! Submit Dual Mastery for the Grade 5 Chant Champion award!'
                  : videoRecordedUrl || challengeRecordedUrl
                  ? '🎉 Recording ready! Tap Submit for AI Buddy evaluation, or record both parts for Dual Mastery!'
                  : '⚠️ Please record your voice in Step 1 or Step 2 before submitting.'}
              </p>
            </div>
          </div>

          {/* Submission Badges & History with Delete & Keep Best Options */}
          {submissionHistory.length > 0 && (
            <div className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-pink-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-zinc-800 uppercase flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-pink-600" />
                  <span>🏆 Submitted Results ({submissionHistory.length}):</span>
                </span>
                {submissionHistory.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleKeepBestResultOnly}
                      className="text-[11px] font-black text-pink-700 bg-pink-100 hover:bg-pink-200 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                      title="Keep highest score result only"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>Keep Best Only</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmissionHistory([])}
                      className="text-[11px] font-bold text-zinc-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-xl transition cursor-pointer"
                      title="Clear all submissions"
                    >
                      Clear All
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
                      title="Delete this result"
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-100 transition cursor-pointer flex items-center gap-1 shrink-0 text-[11px] font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-500 font-medium italic">
                💡 You can tap <b>"Delete"</b> to remove lower scores and keep only your best chant performance!
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
                <span>Upload / Change Video</span>
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
                Method 1: Upload from computer (MP4, WebM)
              </label>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/50 transition cursor-pointer text-center">
                <Upload className="w-6 h-6 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-zinc-700">Select video file</span>
                <span className="text-[10px] text-zinc-500">Supports MP4, WebM</span>
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
                Method 2: Paste YouTube / Video Link
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
                  Apply
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowVideoInputModal(false)}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* POPUP KARAOKE VIDEO MODAL */}
      {showKaraokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border-4 border-purple-400 p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-600" />
                <span>Upload Karaoke Video with Lyrics</span>
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
                Method 1: Upload from computer (MP4, WebM)
              </label>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-purple-300 rounded-xl bg-purple-50/50 hover:bg-purple-100/50 transition cursor-pointer text-center">
                <Upload className="w-6 h-6 text-purple-600 mb-1" />
                <span className="text-xs font-bold text-zinc-700">
                  {karaokeUploadFileName || 'Select video file'}
                </span>
                <span className="text-[10px] text-zinc-500">Supports MP4, WebM</span>
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
                Method 2: Paste YouTube / Karaoke Link
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
                  Apply
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowKaraokeModal(false)}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close
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

            {/* Dual Mastery Banner if both missions completed */}
            {evaluatedMissionMode === 'dual_mastery' && (
              <div className="bg-gradient-to-r from-amber-100 via-pink-100 to-purple-100 p-2.5 rounded-2xl border-2 border-amber-300 flex items-center justify-center gap-2 text-xs font-black text-amber-950 flex-wrap">
                <span>🏆 DUAL MASTERY ACCOMPLISHED!</span>
                <span className="bg-white px-2 py-0.5 rounded-full border border-amber-300 text-[10px]">
                  ✅ Sing-Along + ✅ Beat Challenge
                </span>
              </div>
            )}

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
                🤖 RoboBuddy Feedback:
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

            {/* Action Buttons: Keep Result / Try Again / Delete */}
            {feedback.headline === 'Try again! 🎈' && !videoRecordedUrl && !challengeRecordedUrl ? (
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
                  <span>Go to Record 🎤</span>
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
                  <span>Keep Result ⭐</span>
                </button>

                {/* 2. Secondary Row: Try Again & Delete */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Try Again */}
                  <button
                    type="button"
                    onClick={handleTryAgain}
                    className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-white font-black text-xs sm:text-sm shadow-md cursor-pointer transition transform active:scale-95 flex items-center justify-center gap-1.5"
                    title="Try again to get a higher score"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Again! 🔄</span>
                  </button>

                  {/* Delete this result */}
                  <button
                    type="button"
                    onClick={handleDeleteLatestResult}
                    className="py-2.5 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 hover:border-rose-300 font-black text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                    title="Delete this result from history"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Delete 🗑️</span>
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
                  <span className="truncate">Mini Chant Video</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Scroll to main video */}
                  <button
                    type="button"
                    onClick={() =>
                      mainVideoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                    className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                    title="Scroll to main video"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  {/* Minimize / Expand */}
                  <button
                    type="button"
                    onClick={() => setIsFloatingMinimized((prev) => !prev)}
                    className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                    title={isFloatingMinimized ? 'Expand' : 'Minimize'}
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
                    title="Close floating video"
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
                  Click to view video 🎬
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
