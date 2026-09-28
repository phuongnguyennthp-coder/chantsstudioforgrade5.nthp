import { RoboBuddyFeedback } from '../types/kidsMusic';

export const AI_MODELS = [
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    badge: 'Default / Nhanh nhất',
    desc: 'Phù hợp nhất cho đánh giá học sinh thời gian thực và phản hồi nhanh chóng.',
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    badge: 'Chính xác cao',
    desc: 'Mô hình phân tích sư phạm âm nhạc chuyên sâu và nhận xét chi tiết.',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Ổn định',
    desc: 'Mô hình dự phòng ổn định, tối ưu chi phí và tốc độ phản hồi.',
  },
];

export const FALLBACK_MODEL_CHAIN = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-2.5-flash',
];

const ROBOBUDDY_SYSTEM_INSTRUCTION = `
You are RoboBuddy, a super cheerful, friendly, and colorful musical robot AI assistant for elementary school kids (ages 6 to 11).
Your mission is to inspire kids to love singing, chants, music, and learning rhythm!
Guidelines:
1. ALL OUTPUT MUST BE ENTIRELY IN ENGLISH.
2. Language style: Very warm, fun, enthusiastic, easy to understand for young children, with lots of happy emojis (🌟, 🎶, 🤖, 🌈, 🎈, 💖).
3. Feedback evaluation rule:
   - When the student did very well (score >= 75%): Give them an "OUTSTANDING!" rating with immense praise and high energy!
   - When the student needs more practice (score < 75%): Give them a "GREAT EFFORT! KEEP PRACTICING WITH ME!" rating, warm encouragement (growth mindset), and 1-2 easy, playful tips. Never be harsh or discouraging.
4. Output Format: Always respond with clean valid JSON only without markdown formatting:
{
  "status": "OUTSTANDING" | "KEEP_TRYING",
  "headline": string,
  "badgeEarned": string,
  "stars": number (3, 4, or 5),
  "robotMessage": string,
  "funTips": string[],
  "cheerSound": "hooray" | "sparkle" | "drumroll",
  "skills": {
    "rhythm": number,
    "pronunciation": number,
    "melody": number,
    "energy": number
  }
}
`;

export interface EvaluationResult {
  success: boolean;
  data?: RoboBuddyFeedback;
  error?: string;
  modelUsed?: string;
  attemptedModels?: string[];
}

/**
 * Call Gemini API with automatic model fallback per AI_INSTRUCTIONS.md:
 * 1. gemini-3-flash-preview
 * 2. gemini-3-pro-preview
 * 3. gemini-2.5-flash
 */
export async function evaluateStudentChantWithFallback(
  params: {
    songTitle: string;
    studentName: string;
    songLyrics: string;
    rhythmScore: number;
    pitchScore: number;
  },
  onRetryModel?: (model: string, error: string) => void
): Promise<EvaluationResult> {
  const apiKey = localStorage.getItem('gemini_api_key')?.trim() || '';
  const preferredModel = localStorage.getItem('gemini_model')?.trim() || 'gemini-3-flash-preview';

  if (!apiKey) {
    return {
      success: false,
      error: 'Vui lòng nhập Google Gemini API Key trong phần Settings (API Key) để sử dụng app.',
    };
  }

  // Build model attempt order: preferred first, then remaining fallbacks
  const modelsToAttempt = [
    preferredModel,
    ...FALLBACK_MODEL_CHAIN.filter((m) => m !== preferredModel),
  ];

  const overallScore = Math.round((params.rhythmScore + params.pitchScore) / 2);
  const isOutstanding = overallScore >= 75;

  const promptText = `
Please evaluate this Grade 5 elementary student's chant singing practice session:
- Student Name: "${params.studentName || 'Grade 5 Student'}"
- Song Title: "${params.songTitle || 'Count On Me'}"
- Song Lyrics: "${params.songLyrics}"
- Rhythm accuracy: ${params.rhythmScore}%
- Pitch accuracy: ${params.pitchScore}%
- Overall performance score: ${overallScore}%
- Result tier: ${isOutstanding ? 'OUTSTANDING' : 'KEEP_TRYING'}

Return a joyful JSON evaluation object from RoboBuddy.
`;

  const attemptedModels: string[] = [];
  let lastError = '';

  for (let i = 0; i < modelsToAttempt.length; i++) {
    const currentModel = modelsToAttempt[i];
    attemptedModels.push(currentModel);

    try {
      // Direct call to Google Generative Language API (works natively on Vercel client-side)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: ROBOBUDDY_SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg =
          errorData?.error?.message ||
          errorData?.error?.status ||
          `HTTP ${res.status} ${res.statusText}`;

        lastError = `${errorMsg} (${currentModel})`;
        console.warn(`[Gemini Fallback] Model ${currentModel} failed:`, errorMsg);

        if (onRetryModel && i < modelsToAttempt.length - 1) {
          onRetryModel(modelsToAttempt[i + 1], errorMsg);
        }
        continue; // Retry with next model
      }

      const resJson = await res.json();
      const rawText =
        resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

      // Parse JSON from raw text (handling markdown code fences if any)
      const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const pronunciationScore = Math.floor(Math.random() * 15) + 82;
      const energyScore = Math.floor(Math.random() * 15) + 85;

      const feedback: RoboBuddyFeedback = {
        status: parsed.status === 'KEEP_TRYING' ? 'KEEP_TRYING' : 'OUTSTANDING',
        headline: parsed.headline || `🌟 OUTSTANDING SINGING, ${params.studentName.toUpperCase()}! 🌟`,
        badgeEarned: parsed.badgeEarned || 'Golden Melody Superstar 🏆',
        stars: parsed.stars || (isOutstanding ? 5 : 4),
        robotMessage: parsed.robotMessage || 'Beep boop! Great singing with the beat!',
        funTips: Array.isArray(parsed.funTips) && parsed.funTips.length > 0
          ? parsed.funTips
          : ['Keep singing with that happy smile! 💖', 'Lock into the beat on 1 and 3! 🥁'],
        cheerSound: parsed.cheerSound || (isOutstanding ? 'hooray' : 'sparkle'),
        score: overallScore,
        skills: parsed.skills || {
          rhythm: params.rhythmScore,
          pronunciation: pronunciationScore,
          melody: params.pitchScore,
          energy: energyScore,
        },
      };

      return {
        success: true,
        data: feedback,
        modelUsed: currentModel,
        attemptedModels,
      };
    } catch (err: any) {
      lastError = err?.message || 'Lỗi kết nối mạng';
      console.warn(`[Gemini Fallback] Exception with ${currentModel}:`, err);
      if (onRetryModel && i < modelsToAttempt.length - 1) {
        onRetryModel(modelsToAttempt[i + 1], lastError);
      }
    }
  }

  // All models failed -> Strict adherence to AI_INSTRUCTIONS.md:
  // "Nếu tất cả các model đều thất bại -> Hiện thông báo lỗi màu đỏ, hiển thị nguyên văn lỗi từ API (VD: 429 RESOURCE_EXHAUSTED). Trạng thái chuyển thành 'Đã dừng do lỗi', tuyệt đối không được hiện 'Hoàn tất'"
  return {
    success: false,
    error: lastError || 'Tất cả các model AI đều không phản hồi. Vui lòng kiểm tra lại API Key hoặc hạn mức quota.',
    attemptedModels,
  };
}
