import React from 'react';

interface RoboBuddyMascotProps {
  mood?: 'happy' | 'singing' | 'cheering' | 'listening' | 'star';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSpeech?: boolean;
  speechText?: string;
  isDancing?: boolean;
}

export const RoboBuddyMascot: React.FC<RoboBuddyMascotProps> = ({
  mood = 'happy',
  size = 'md',
  showSpeech = false,
  speechText = "Hi friend! Let's sing and follow the rhythm!",
  isDancing = false,
}) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-36 h-36',
    xl: 'w-48 h-48',
  };

  return (
    <div className="flex flex-col items-center select-none relative">
      {/* Cute speech bubble if requested */}
      {showSpeech && speechText && (
        <div className="mb-2 max-w-xs sm:max-w-sm bg-white text-zinc-800 text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xl border-3 border-pink-400 relative animate-bounce">
          <p className="leading-snug">{speechText}</p>
          <div className="absolute -bottom-2.5 left-1/2 -ml-2.5 w-0 h-0 border-x-8 border-x-transparent border-t-10 border-t-pink-400" />
        </div>
      )}

      {/* SVG Cartoon Robot */}
      <div
        className={`${sizeClasses[size]} relative transition-transform ${
          isDancing ? 'animate-bounce' : 'hover:scale-105'
        }`}
      >
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full drop-shadow-xl overflow-visible"
        >
          {/* Glowing Antenna */}
          <line
            x1="80"
            y1="22"
            x2="80"
            y2="42"
            stroke="#f97316"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle
            cx="80"
            cy="18"
            r="10"
            fill="#eab308"
            stroke="#ef4444"
            strokeWidth="3"
            className="animate-pulse"
          />
          <text
            x="80"
            y="22"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="10"
            fontWeight="bold"
          >
            ★
          </text>

          {/* Headphones Band */}
          <path
            d="M 32 68 A 48 48 0 0 1 128 68"
            fill="none"
            stroke="#ec4899"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Left Headphone Ear Cup */}
          <rect
            x="24"
            y="54"
            width="14"
            height="26"
            rx="7"
            fill="#22c55e"
            stroke="#15803d"
            strokeWidth="2.5"
          />
          {/* Right Headphone Ear Cup */}
          <rect
            x="122"
            y="54"
            width="14"
            height="26"
            rx="7"
            fill="#22c55e"
            stroke="#15803d"
            strokeWidth="2.5"
          />

          {/* Robot Head (Rounded Square) */}
          <rect
            x="38"
            y="38"
            width="84"
            height="58"
            rx="18"
            fill="#38bdf8"
            stroke="#0284c7"
            strokeWidth="4"
          />

          {/* Face Screen (Dark Glossy) */}
          <rect
            x="46"
            y="46"
            width="68"
            height="42"
            rx="12"
            fill="#0f172a"
          />

          {/* Cheeks (Blushing pink circles) */}
          <circle cx="52" cy="74" r="4.5" fill="#f43f5e" opacity="0.8" />
          <circle cx="108" cy="74" r="4.5" fill="#f43f5e" opacity="0.8" />

          {/* Eyes (Expressive Big Anime Style) */}
          {mood === 'cheering' || mood === 'singing' ? (
            // Joyful Happy Crescent Eyes ^^
            <>
              <path
                d="M 54 62 Q 62 52 70 62"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M 90 62 Q 98 52 106 62"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </>
          ) : (
            // Big Sparkling Round Eyes
            <>
              <circle cx="62" cy="62" r="7.5" fill="#38bdf8" />
              <circle cx="60" cy="60" r="2.5" fill="#ffffff" />
              <circle cx="98" cy="62" r="7.5" fill="#38bdf8" />
              <circle cx="96" cy="60" r="2.5" fill="#ffffff" />
            </>
          )}

          {/* Mouth */}
          {mood === 'singing' ? (
            // Big Singing Oval Mouth with cute music note
            <>
              <ellipse cx="80" cy="75" rx="8" ry="6" fill="#f43f5e" />
              <text x="80" y="78" textAnchor="middle" fill="#ffffff" fontSize="9">
                ♪
              </text>
            </>
          ) : (
            // Big Warm Smile
            <path
              d="M 72 73 Q 80 82 88 73"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* Robot Neck */}
          <rect x="74" y="96" width="12" height="8" rx="2" fill="#94a3b8" />

          {/* Robot Body */}
          <rect
            x="48"
            y="102"
            width="64"
            height="44"
            rx="14"
            fill="#eab308"
            stroke="#ca8a04"
            strokeWidth="3.5"
          />

          {/* Chest Heart / Music Badge */}
          <rect
            x="60"
            y="110"
            width="40"
            height="20"
            rx="6"
            fill="#ec4899"
          />
          <text
            x="80"
            y="125"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="12"
            fontWeight="bold"
          >
            ♫
          </text>

          {/* Left Arm (Waving) */}
          <path
            d="M 48 112 Q 30 102 24 90"
            fill="none"
            stroke="#f97316"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="23" cy="88" r="6" fill="#ef4444" />

          {/* Right Arm */}
          <path
            d="M 112 112 Q 130 118 136 128"
            fill="none"
            stroke="#f97316"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="137" cy="130" r="6" fill="#ef4444" />

          {/* Left Foot */}
          <rect x="56" y="144" width="16" height="12" rx="6" fill="#22c55e" />
          {/* Right Foot */}
          <rect x="88" y="144" width="16" height="12" rx="6" fill="#22c55e" />
        </svg>
      </div>
    </div>
  );
};
