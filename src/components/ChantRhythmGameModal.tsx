import React, { useState, useEffect, useRef } from 'react';
import { X, Play, RotateCcw, Trophy, Sparkles, Award, Music, Zap } from 'lucide-react';
import { kidsBeatEngine } from '../audio/kidsBeatEngine';

interface ChantRhythmGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  songTitle: string;
  bpm: number;
  lyrics: string[];
}

export const ChantRhythmGameModal: React.FC<ChantRhythmGameModalProps> = ({
  isOpen,
  onClose,
  songTitle,
  bpm,
  lyrics,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [hitFeedback, setHitFeedback] = useState<string | null>(null);
  const [feedbackColor, setFeedbackColor] = useState<string>('text-amber-500');
  const [isFinished, setIsFinished] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [perfectHits, setPerfectHits] = useState(0);

  const beatStartTimeRef = useRef<number>(0);
  const targetBeatNumberRef = useRef<number>(0);
  const totalBeatsTarget = 24; // 6 bars of 4/4 beats

  useEffect(() => {
    if (!isOpen) {
      resetGame();
      return;
    }
  }, [isOpen]);

  const resetGame = () => {
    setIsPlaying(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setCurrentBeat(1);
    setHitFeedback(null);
    setIsFinished(false);
    setTotalHits(0);
    setPerfectHits(0);
    targetBeatNumberRef.current = 0;
  };

  const startGame = () => {
    resetGame();
    setIsPlaying(true);
    kidsBeatEngine.setBpm(bpm);
    kidsBeatEngine.startBeat();

    let beatCount = 0;
    const intervalMs = (60 / bpm) * 1000;
    beatStartTimeRef.current = performance.now();

    const unsubTick = kidsBeatEngine.onBeatTick((b) => {
      beatCount++;
      targetBeatNumberRef.current = beatCount;
      setCurrentBeat(b);
      beatStartTimeRef.current = performance.now();

      if (beatCount >= totalBeatsTarget) {
        setTimeout(() => {
          endGame();
        }, intervalMs);
      }
    });

    (window as any)._rhythmGameUnsub = unsubTick;
  };

  const endGame = () => {
    kidsBeatEngine.stopBeat();
    if ((window as any)._rhythmGameUnsub) {
      (window as any)._rhythmGameUnsub();
    }
    setIsPlaying(false);
    setIsFinished(true);
  };

  // Keyboard Space listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !isPlaying || isFinished) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, isFinished]);

  const handleTap = () => {
    if (!isPlaying || isFinished) return;

    const now = performance.now();
    const intervalMs = (60 / bpm) * 1000;
    const diff = Math.abs(now - beatStartTimeRef.current);
    // Difference normalized to closest beat
    const offset = Math.min(diff, Math.abs(diff - intervalMs));

    setTotalHits((prev) => prev + 1);

    if (offset < 110) {
      // Perfect
      setHitFeedback('PERFECT! 🌟');
      setFeedbackColor('text-emerald-500');
      setScore((s) => s + 100 + combo * 10);
      setCombo((c) => {
        const next = c + 1;
        setMaxCombo((m) => Math.max(m, next));
        return next;
      });
      setPerfectHits((p) => p + 1);
      kidsBeatEngine.playTingTing();
    } else if (offset < 210) {
      // Great
      setHitFeedback('GREAT! 🎵');
      setFeedbackColor('text-pink-500');
      setScore((s) => s + 70 + combo * 5);
      setCombo((c) => {
        const next = c + 1;
        setMaxCombo((m) => Math.max(m, next));
        return next;
      });
    } else if (offset < 320) {
      // Good
      setHitFeedback('GOOD! 👍');
      setFeedbackColor('text-amber-500');
      setScore((s) => s + 40);
      setCombo((c) => c + 1);
    } else {
      // Miss
      setHitFeedback('MISS! 💨');
      setFeedbackColor('text-zinc-400');
      setCombo(0);
    }

    setTimeout(() => {
      setHitFeedback((prev) => (prev ? null : prev));
    }, 450);
  };

  if (!isOpen) return null;

  const currentLyricLine = lyrics[(Math.floor((targetBeatNumberRef.current || 1) / 4)) % lyrics.length] || lyrics[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border-4 border-yellow-400 p-6 sm:p-7 max-w-lg w-full shadow-2xl relative space-y-5 text-center">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-pink-500 flex items-center justify-center text-white shadow font-black text-xl">
              🎮
            </div>
            <div className="text-left">
              <h2 className="text-lg font-black text-zinc-900">
                Thử Thách Gõ Nhịp Phách (Rhythm Tap)
              </h2>
              <span className="text-xs font-bold text-pink-600 block">
                {songTitle} • {bpm} BPM
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              kidsBeatEngine.stopBeat();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isPlaying && !isFinished ? (
          // Intro View
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 text-left space-y-2">
              <span className="text-xs font-black text-amber-900 uppercase block">
                🎯 Cách Chơi Cho Học Sinh Lớp 5:
              </span>
              <p className="text-xs font-bold text-zinc-700 leading-relaxed">
                1. Nghe tiếng trống và đàn piano theo nhịp <strong>1 - 2 - 3 - 4</strong>.
              </p>
              <p className="text-xs font-bold text-zinc-700 leading-relaxed">
                2. Chạm vào nút <strong>"GÕ PHÁCH NHỊP"</strong> hoặc nhấn phím <strong>SPACE</strong> đúng lúc vòng tròn nhịp phồng lên!
              </p>
              <p className="text-xs font-bold text-zinc-700 leading-relaxed">
                3. Gõ càng chuẩn phách, combo càng cao và RoboBuddy sẽ thưởng càng nhiều sao!
              </p>
            </div>

            <button
              onClick={startGame}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-lg shadow-xl shadow-green-300 flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Bắt Đầu Gõ Nhịp! 🚀</span>
            </button>
          </div>
        ) : isPlaying ? (
          // Active Game Play View
          <div className="space-y-4 py-2">
            {/* Score & Combo Bar */}
            <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
              <div className="text-left">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Điểm số</span>
                <span className="text-2xl font-black text-pink-600 font-mono">{score}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tiến độ</span>
                <span className="text-xs font-black text-zinc-800">
                  {targetBeatNumberRef.current} / {totalBeatsTarget} phách
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Combo</span>
                <span className="text-xl font-black text-amber-500 font-mono">
                  {combo > 1 ? `${combo}x 🔥` : '-'}
                </span>
              </div>
            </div>

            {/* Current Lyric Prompt */}
            <div className="bg-pink-50 p-2.5 rounded-xl border border-pink-200">
              <span className="text-[10px] font-bold text-pink-700 uppercase block">Lời Chant:</span>
              <p className="text-sm font-black text-zinc-800 truncate">"{currentLyricLine}"</p>
            </div>

            {/* 4 Beat Visual Targets */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[1, 2, 3, 4].map((b) => (
                <div
                  key={b}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black font-mono transition-all duration-100 ${
                    currentBeat === b
                      ? 'bg-rose-500 text-white scale-125 shadow-xl shadow-rose-500/50 ring-4 ring-rose-300'
                      : 'bg-white text-zinc-400 border-3 border-zinc-200'
                  }`}
                >
                  {b}
                </div>
              ))}
            </div>

            {/* Hit Feedback Floating Toast */}
            <div className="h-8 flex items-center justify-center">
              {hitFeedback ? (
                <span className={`text-xl font-black ${feedbackColor} animate-bounce block`}>
                  {hitFeedback}
                </span>
              ) : (
                <span className="text-xs font-bold text-zinc-400">Gõ đúng phách 1, 2, 3, 4</span>
              )}
            </div>

            {/* Big Tap Area */}
            <button
              onClick={handleTap}
              className="w-full py-8 rounded-3xl bg-gradient-to-tr from-pink-500 via-rose-500 to-yellow-400 hover:from-pink-400 hover:to-yellow-300 text-white font-black text-2xl tracking-wider shadow-2xl shadow-pink-300 cursor-pointer transition transform active:scale-90 select-none flex flex-col items-center justify-center gap-1"
            >
              <span>GÕ PHÁCH NHỊP! 🥁</span>
              <span className="text-xs font-bold text-white/90">(Hoặc nhấn phím SPACE)</span>
            </button>
          </div>
        ) : (
          // Finished Game Result Screen
          <div className="space-y-4 py-3">
            <div className="w-16 h-16 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto text-3xl shadow-inner">
              🏆
            </div>

            <div>
              <span className="text-xs font-bold text-zinc-500 uppercase">Hoàn thành thử thách!</span>
              <h3 className="text-2xl font-black text-zinc-900 mt-1">
                {score >= 1200
                  ? '🌟 XUẤT SẮC! BẬC THẦY NHỊP PHÁCH!'
                  : '👏 LÀM TỐT LẮM! BẮT NHỊP RẤT CHUẨN!'}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-pink-50 p-4 rounded-2xl border border-pink-200 text-center">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 block">Tổng điểm</span>
                <span className="text-xl font-black text-pink-600">{score}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 block">Max Combo</span>
                <span className="text-xl font-black text-amber-500">{maxCombo}x</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 block">Độ chuẩn xác</span>
                <span className="text-xl font-black text-emerald-600">
                  {totalHits > 0 ? Math.round((perfectHits / totalHits) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={startGame}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi Lại</span>
              </button>

              <button
                onClick={() => {
                  kidsBeatEngine.stopBeat();
                  onClose();
                }}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-black text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <span>Thu Âm Vào Micro Ngay! 🎙️</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
