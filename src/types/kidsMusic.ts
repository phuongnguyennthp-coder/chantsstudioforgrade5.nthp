export interface SongLesson {
  id: string;
  title: string;
  gradeLevel: string; // e.g., 'Grade 1 - 2'
  category: string; // e.g., 'Fun Animal Songs', 'Bedtime Rhymes'
  bpm: number;
  videoUrl?: string; // Video file URL or sample animated video
  beatAudioUrl?: string; // Custom beat audio or procedural beat
  videoType: 'file' | 'animated' | 'url';
  lyrics: string[];
  missionTask: string;
  thumbnailColor: string;
  createdAt: string;
}

export interface RoboBuddyFeedback {
  status: 'OUTSTANDING' | 'KEEP_TRYING';
  headline: string;
  badgeEarned: string;
  stars: number;
  robotMessage: string;
  funTips: string[];
  cheerSound: 'hooray' | 'sparkle' | 'drumroll';
  score: number;
  skills?: {
    rhythm: number; // 0-100
    pronunciation: number; // 0-100
    melody: number; // 0-100
    energy: number; // 0-100
  };
}

export interface StudentSubmission {
  id: string;
  lessonId: string;
  songTitle: string;
  studentName: string;
  recordedAudioUrl?: string;
  feedback: RoboBuddyFeedback;
  submittedAt: string;
}
