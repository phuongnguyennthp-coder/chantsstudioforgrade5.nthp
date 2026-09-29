import React from 'react';

interface SkillRadarChartProps {
  skills?: {
    rhythm: number;
    pronunciation: number;
    melody: number;
    energy: number;
  };
}

export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({ skills }) => {
  const data = [
    { label: 'Rhythm', score: skills?.rhythm ?? 85, color: '#ec4899' },
    { label: 'Phonics', score: skills?.pronunciation ?? 88, color: '#3b82f6' },
    { label: 'Melody', score: skills?.melody ?? 82, color: '#10b981' },
    { label: 'Energy', score: skills?.energy ?? 90, color: '#f59e0b' },
  ];

  const size = 220;
  const center = size / 2;
  const radius = 75;

  // 4 axes: Up, Right, Down, Left
  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI / 2) * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Generate polygon points for student score
  const points = data
    .map((item, idx) => {
      const { x, y } = getCoordinates(idx, item.score);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl p-3 border-2 border-pink-200 shadow-sm flex flex-col items-center">
      <span className="text-[11px] font-black uppercase text-pink-700 tracking-wider mb-1 flex items-center gap-1">
        <span>📊 4-Skill Radar Chart</span>
      </span>

      <div className="relative">
        <svg width={size} height={size} className="overflow-visible select-none">
          {/* Background web levels (25%, 50%, 75%, 100%) */}
          {[25, 50, 75, 100].map((level) => {
            const levelPoints = [0, 1, 2, 3]
              .map((idx) => {
                const { x, y } = getCoordinates(idx, level);
                return `${x},${y}`;
              })
              .join(' ');
            return (
              <polygon
                key={level}
                points={levelPoints}
                fill={level === 100 ? '#fdf2f8' : 'transparent'}
                stroke="#e2e8f0"
                strokeWidth={level === 100 ? '1.5' : '1'}
                strokeDasharray={level < 100 ? '3,3' : undefined}
              />
            );
          })}

          {/* Cross Axis Lines */}
          {[0, 1, 2, 3].map((idx) => {
            const end = getCoordinates(idx, 100);
            return (
              <line
                key={idx}
                x1={center}
                y1={center}
                x2={end.x}
                y2={end.y}
                stroke="#cbd5e1"
                strokeWidth="1.2"
              />
            );
          })}

          {/* Student Radar Polygon */}
          <polygon
            points={points}
            fill="url(#radarGradient)"
            fillOpacity="0.45"
            stroke="#ec4899"
            strokeWidth="2.5"
            className="transition-all duration-500"
          />

          {/* Gradient Definition */}
          <defs>
            <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
            </radialGradient>
          </defs>

          {/* Data Points on vertices */}
          {data.map((item, idx) => {
            const { x, y } = getCoordinates(idx, item.score);
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="4.5"
                fill={item.color}
                stroke="#ffffff"
                strokeWidth="2"
              />
            );
          })}

          {/* Axis Labels positioned around edges */}
          {/* Top: Rhythm */}
          <text
            x={center}
            y={center - radius - 10}
            textAnchor="middle"
            className="text-[10px] font-black fill-pink-600"
          >
            🥁 Rhythm ({data[0].score}%)
          </text>
          {/* Right: Pronunciation */}
          <text
            x={center + radius + 8}
            y={center + 3}
            textAnchor="start"
            className="text-[10px] font-black fill-blue-600"
          >
            🗣️ Phonics ({data[1].score}%)
          </text>
          {/* Bottom: Melody */}
          <text
            x={center}
            y={center + radius + 14}
            textAnchor="middle"
            className="text-[10px] font-black fill-emerald-600"
          >
            🎶 Melody ({data[2].score}%)
          </text>
          {/* Left: Energy */}
          <text
            x={center - radius - 8}
            y={center + 3}
            textAnchor="end"
            className="text-[10px] font-black fill-amber-600"
          >
            ⭐ Energy ({data[3].score}%)
          </text>
        </svg>
      </div>
    </div>
  );
};
