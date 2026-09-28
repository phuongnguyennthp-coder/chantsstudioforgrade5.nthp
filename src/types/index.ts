export interface StemTrack {
  id: string;
  name: string;
  type: 'vocals' | 'bass' | 'drums' | 'harmony' | 'other';
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
  color: string;
}

export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  key: string;
  duration: number; // seconds
  stems: StemTrack[];
  notes: Array<{ time: number; duration: number; note: string; midi: number }>;
  defaultLoop: { start: number; end: number; name: string };
  description: string;
}

export interface PitchData {
  hz: number;
  midi: number;
  noteName: string;
  cents: number;
  amplitude: number;
  clarity: number;
  timestamp: number;
}

export interface EvaluationReport {
  quickSummary: {
    overallScore: number;
    pitchScore: number;
    rhythmScore: number;
    summaryText: string;
  };
  spectralAnalysis: {
    strengths: string[];
    improvements: Array<{
      timestamp: string;
      issue: string;
      detail: string;
    }>;
    spectralInsight: string;
  };
  visualPostureFeedback: {
    postureScore: number;
    observations: string[];
    ergonomicTips: string;
  };
  actionPlanMicroLearning: {
    suggestedLoop: {
      startSec: number;
      endSec: number;
      loopName: string;
      recommendedTempo: number;
    };
    drillDescription: string;
    drillSteps: string[];
  };
  skillHeatmapUpdate: {
    pitch: number;
    rhythm: number;
    dynamics: number;
    phrasing: number;
    vibrato: number;
    timbre: number;
    deltaExplanation: string;
  };
  teacherNotes: Array<{
    timestampSec: number;
    tag: 'pitch' | 'dynamics' | 'breath' | 'technique' | 'praise';
    annotation: string;
  }>;
}

export interface TeacherAnnotation {
  id: string;
  timestampSec: number;
  author: string;
  tag: 'pitch' | 'dynamics' | 'breath' | 'technique' | 'praise';
  annotation: string;
  createdAt: string;
}

export interface SkillScores {
  pitch: number;
  rhythm: number;
  dynamics: number;
  phrasing: number;
  vibrato: number;
  timbre: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'sonicmaster';
  text: string;
  timestamp: string;
  quickAction?: {
    type: 'set_loop' | 'set_tempo' | 'open_mixer' | 'view_spectral';
    label: string;
    payload?: any;
  };
}
