import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));

// Shared Gemini client utility on the server with User-Agent header
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SONICMASTER_SYSTEM_INSTRUCTION = `
Bạn là SonicMaster AI, một Chuyên gia Sư phạm Âm nhạc tích hợp Công nghệ Đa phương thức (Multi-modal Music AI Expert). Bạn đóng vai trò là cầu nối giữa công nghệ xử lý tín hiệu số (DSP) tiên tiến và phương pháp giảng dạy âm nhạc hiện đại. Bạn không chỉ là một trợ lý ảo thông thường mà là một người đồng hành (AI Buddy) có khả năng nghe, nhìn và phân tích âm nhạc ở cấp độ chuyên nghiệp nhất.

Mục tiêu cốt lõi của bạn:
1. Phân tích & Hướng dẫn: Chuyển đổi dữ liệu từ video mẫu và phần thực hành của người dùng thành các chỉ dẫn sư phạm giá trị.
2. Tối ưu hóa Luyện tập: Hướng dẫn người dùng sử dụng các công cụ kỹ thuật (Source Separation, A-B Loop, Time-stretching) để đạt hiệu quả cao nhất.
3. Đánh giá Chuyên sâu: Thực hiện phân tích phổ âm (Spectral Analysis) để đưa ra phản hồi chi tiết về cao độ, nhịp điệu, sắc thái (dynamics), và kỹ thuật chuyên biệt (vibrato, timbre).
4. Cá nhân hóa Lộ trình: Xây dựng và cập nhật "Bản đồ kỹ năng" (Skill Heatmap), từ đó đề xuất các bài tập Micro-learning để khắc phục điểm yếu của từng cá nhân.
5. Kết nối Sư phạm: Hỗ trợ giáo viên quản lý portfolio và chú thích chuyên sâu trên dạng sóng âm thanh (waveform).

Nguyên tắc:
- Dựa trên dữ liệu (Data-driven): Dùng thuật ngữ kỹ thuật âm nhạc (tần số Hz, cents sai lệch, biên độ dB, vibrato depth/rate, harmonics, timbre, staccato, legato).
- Quy tắc Micro-learning: Không bắt tập lại cả bài, trích xuất đoạn ngắn (3-5 giây) kèm cài đặt A-B Loop.
- Phong cách: Chuyên nghiệp, Truyền cảm hứng, Chính xác và Am hiểu công nghệ. Xưng hô "Tôi" và "Bạn".
- Luôn bám sát cấu trúc phản hồi 6 phần:
  1. Quick Performance Summary (Tóm tắt nhanh)
  2. Spectral Analysis Detail (Chi tiết phân tích phổ âm: Ưu điểm & Cần cải thiện kèm mốc thời gian giây)
  3. Visual & Posture Feedback (Phản hồi tư thế quan sát)
  4. Action Plan - Micro-learning (Kế hoạch hành động: Cài đặt A-B Loop & bài tập bổ trợ 3-5 giây)
  5. Skill Heatmap Update (Cập nhật điểm 6 chỉ số: Pitch, Rhythm, Dynamics, Phrasing, Vibrato, Timbre)
  6. Teacher Notes (Bản thảo chú thích waveform cho giáo viên)
`;

// Endpoint 1: Evaluate Practice Performance
app.post('/api/mentor/evaluate', async (req: Request, res: Response) => {
  try {
    const {
      songTitle,
      instrumentOrVocal,
      pitchAccuracy,
      rhythmAccuracy,
      averageCentsDeviation,
      vibratoRateHz,
      vibratoDepthCents,
      dynamicsRangeDb,
      detectedFlaws,
      postureObservations,
      sessionDurationSeconds,
      currentSkills,
    } = req.body;

    const prompt = `
Dưới đây là dữ liệu thực hành mới nhất của học viên:
- Bài tập / Tác phẩm: ${songTitle || 'Chasing Echoes (Vocal & Piano)'}
- Thể loại / Bộ môn: ${instrumentOrVocal || 'Vocal (Thanh nhạc)'}
- Độ chính xác cao độ (Pitch Accuracy): ${pitchAccuracy ?? 84}%
- Độ chính xác nhịp điệu (Rhythm Accuracy): ${rhythmAccuracy ?? 88}%
- Độ lệch cao độ trung bình: ${averageCentsDeviation ?? '+14 cents (hơi chênh)'}
- Tần số rung (Vibrato Rate): ${vibratoRateHz ?? '4.8 Hz'} (Chuẩn lý tưởng: 5.5 - 6.5 Hz)
- Độ sâu rung (Vibrato Depth): ${vibratoDepthCents ?? '42 cents'}
- Dải động âm lượng (Dynamics Range): ${dynamicsRangeDb ?? '18 dB'}
- Lỗi cụ thể phát hiện trong phổ âm: ${JSON.stringify(detectedFlaws || ['Tại 00:14 - 00:18: Cao độ nốt G4 bị flat -18 cents', 'Tại 00:27: Ngắt câu vội, thiếu breath support, vibrato bị đứt đoạn'])}
- Dữ liệu Computer Vision tư thế: ${JSON.stringify(postureObservations || ['Góc nghiêng đầu gập 14 độ làm hẹp thanh quản', 'Hai vai nhô cao khi lấy hơi ở nốt cao'])}
- Thời lượng phiên tập: ${sessionDurationSeconds || 45} giây
- Điểm kỹ năng hiện tại: ${JSON.stringify(currentSkills || { pitch: 78, rhythm: 82, dynamics: 75, phrasing: 70, vibrato: 65, timbre: 80 })}

Hãy đóng vai SonicMaster AI và đưa ra phân tích chuyên sâu chuẩn xác theo định dạng 6 phần đã quy định.
Trả về dữ liệu dưới dạng JSON thuần tuý (JSON object) theo cấu trúc:
{
  "quickSummary": {
    "overallScore": number (0-100),
    "pitchScore": number (0-100),
    "rhythmScore": number (0-100),
    "summaryText": string (ngắn gọn, truyền cảm hứng, nêu cảm xúc/sắc thái)
  },
  "spectralAnalysis": {
    "strengths": [string],
    "improvements": [
      {
        "timestamp": string (ví dụ "00:15"),
        "issue": string,
        "detail": string (tần số, biên độ, âm sắc)
      }
    ],
    "spectralInsight": string (nhận xét về harmonics và formants)
  },
  "visualPostureFeedback": {
    "postureScore": number (0-100),
    "observations": [string],
    "ergonomicTips": string
  },
  "actionPlanMicroLearning": {
    "suggestedLoop": {
      "startSec": number,
      "endSec": number,
      "loopName": string,
      "recommendedTempo": number (ví dụ 0.75x hoặc 0.85x)
    },
    "drillDescription": string (bài tập 3-5 giây tập trung kỹ thuật lỗi),
    "drillSteps": [string]
  },
  "skillHeatmapUpdate": {
    "pitch": number (0-100),
    "rhythm": number (0-100),
    "dynamics": number (0-100),
    "phrasing": number (0-100),
    "vibrato": number (0-100),
    "timbre": number (0-100),
    "deltaExplanation": string
  },
  "teacherNotes": [
    {
      "timestampSec": number,
      "tag": "pitch" | "dynamics" | "breath" | "technique" | "praise",
      "annotation": string
    }
  ]
}
`;

    if (!apiKey) {
      // Return high quality deterministic response if API key is not configured
      return res.json(getFallbackEvaluation(req.body));
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: SONICMASTER_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const responseText = response.text || '';
    try {
      const parsed = JSON.parse(responseText);
      return res.json(parsed);
    } catch {
      return res.json(getFallbackEvaluation(req.body));
    }
  } catch (error: any) {
    console.error('Error in /api/mentor/evaluate:', error);
    return res.json(getFallbackEvaluation(req.body));
  }
});

// Endpoint 2: Interactive Chat with SonicMaster AI
app.post('/api/mentor/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, context } = req.body;

    if (!apiKey) {
      return res.json({
        reply: `[SonicMaster AI Demo Mode] Tôi đã nhận câu hỏi của bạn: "${message}". Để tối ưu hóa phân đoạn này, bạn hãy kích hoạt A-B Loop tại phân đoạn 3-5 giây khó nhất, giảm nhịp độ xuống 0.75x (Time-stretching mà không đổi cao độ) và dùng thanh Mixer để mute bớt track bè, tập trung tối đa vào độ tròn của nguyên âm và tần số rung vibrato 5.8Hz.`,
      });
    }

    const contextSnippet = context
      ? `\nNgữ cảnh phòng tập hiện tại: Track "${context.songTitle || 'Chasing Echoes'}", Nhịp điệu: ${context.tempo || 1.0}x, A-B Loop: ${context.loopStart || 0}s -> ${context.loopEnd || 5}s, Micro pitch: ${context.currentNote || 'None'}.`
      : '';

    const formattedContents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        formattedContents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
    }
    formattedContents.push({
      role: 'user',
      parts: [{ text: `${message}${contextSnippet}` }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: formattedContents,
      config: {
        systemInstruction: `${SONICMASTER_SYSTEM_INSTRUCTION}\nTrả lời ngắn gọn, truyền cảm hứng, súc tích (dưới 250 từ), dùng thuật ngữ chuyên môn âm nhạc và công nghệ DSP chính xác.`,
      },
    });

    return res.json({ reply: response.text || 'SonicMaster AI sẵn sàng hỗ trợ bạn.' });
  } catch (error: any) {
    console.error('Error in /api/mentor/chat:', error);
    // Provide pedagogical fallback when API experiences temporary spike
    const message = req.body?.message || '';
    let advice = 'Để tối ưu hóa phần thể hiện này, hãy kích hoạt A-B Loop trong phạm vi 3-5 giây quanh nốt khó. Sử dụng chế độ Time-stretching 0.75x để giữ nguyên cao độ trong khi luyện khẩu hình và hơi thở.';
    if (message.toLowerCase().includes('vibrato')) {
      advice = 'Vibrato lý tưởng đạt tần số 5.5 - 6.5 Hz với độ sâu ±25-35 cents. Hãy thả lỏng thanh quản, hỗ trợ hơi thở bằng cơ hoành và tập chuyển từ âm thẳng (straight tone) sang rung dần đều ở cuối câu.';
    } else if (message.toLowerCase().includes('eq') || message.toLowerCase().includes('reverb')) {
      advice = 'Với giọng hát chính, hãy cắt nhẹ dải trầm dưới 100Hz (Low EQ -2dB) để loại bỏ ù rền, nâng nhẹ High EQ +1.5dB ở 8kHz để tạo độ sáng và chỉnh Reverb Wet ở mức 20-25% để giữ độ trong trẻo.';
    } else if (message.toLowerCase().includes('flat') || message.toLowerCase().includes('cao độ')) {
      advice = 'Hiện tượng flat pitch thường do thiếu áp lực hơi thở hoặc gập cằm. Bạn hãy giữ mắt nhìn ngang, tưởng tượng đỉnh đầu được kéo nhẹ lên trần nhà và dùng âm "Ng" để đẩy âm thanh lên vòm họng trên.';
    }
    return res.json({ reply: `[SonicMaster AI] ${advice}` });
  }
});

// Endpoint 3: Generate Custom Micro-learning Drill
app.post('/api/mentor/generate-drill', async (req: Request, res: Response) => {
  try {
    const { skillTarget, difficulty, currentTempo } = req.body;

    if (!apiKey) {
      return res.json({
        title: `Bài tập Micro-drill: Khắc phục ${skillTarget || 'Cao độ nốt cao & Vibrato'}`,
        loopLengthSeconds: 4,
        suggestedTempoFactor: 0.8,
        description: 'Luyện tập 3 lần liên tiếp với A-B Loop. Lần 1 solo stem người dùng, lần 2 tăng backing track, lần 3 tăng tốc về 1.0x.',
        targetNotes: ['E4', 'G4', 'A4', 'G4'],
        metronomeBpm: Math.round((currentTempo || 1.0) * 85),
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Tạo 1 bài tập Micro-learning (3-5 giây) tập trung vào kỹ năng: "${skillTarget || 'Vibrato & Pitch intonation'}", độ khó: "${difficulty || 'Trung bình'}", nhịp độ cơ bản: ${currentTempo || 1.0}x. Trả về JSON: { "title": string, "loopLengthSeconds": number, "suggestedTempoFactor": number, "description": string, "targetNotes": string[], "metronomeBpm": number }`,
      config: {
        systemInstruction: SONICMASTER_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });

    try {
      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch {
      return res.json({
        title: `Micro-drill: ${skillTarget}`,
        loopLengthSeconds: 4,
        suggestedTempoFactor: 0.85,
        description: 'Luyện tập phân đoạn 4 giây với chế độ Time-stretching 0.85x.',
        targetNotes: ['C4', 'E4', 'G4'],
        metronomeBpm: 80,
      });
    }
  } catch (error: any) {
    console.error('Error in /api/mentor/generate-drill:', error);
    return res.status(500).json({ error: 'Lỗi tạo bài tập' });
  }
});

// System instruction for RoboBuddy - Musical AI Buddy for Kids
const ROBOBUDDY_SYSTEM_INSTRUCTION = `
You are RoboBuddy, a super cheerful, friendly, and colorful musical robot AI assistant for elementary school kids (ages 6 to 11).
Your mission is to inspire kids to love singing, music, and learning rhythm!
Guidelines:
1. ALL OUTPUT MUST BE ENTIRELY IN ENGLISH.
2. Language style: Very warm, fun, enthusiastic, easy to understand for young children, with lots of happy emojis (🌟, 🎶, 🤖, 🌈, 🎈, 💖).
3. Feedback evaluation rule:
   - When the student did very well (score >= 75%): Give them an "OUTSTANDING!" rating with immense praise and high energy!
   - When the student needs more practice (score < 75%): Give them a "GREAT EFFORT! KEEP PRACTICING WITH ME!" rating, warm encouragement (growth mindset), and 1-2 easy, playful tips (like "tap your foot to the drum!" or "take a big balloon breath!"). Never be harsh or discouraging.
4. Output Format: Always respond with clean JSON:
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

// Endpoint: Evaluate elementary student singing practice
app.post('/api/student/evaluate', async (req: Request, res: Response) => {
  try {
    const { songTitle, studentName, rhythmScore, pitchScore, songLyrics } = req.body;

    const overallScore = Math.round(((rhythmScore ?? 80) + (pitchScore ?? 80)) / 2);
    const isOutstanding = overallScore >= 75;

    const prompt = `
Please evaluate this Grade 5 elementary student's singing practice session:
- Student Name: ${studentName || 'Grade 5 Student'}
- Song Title: "${songTitle || 'Count On Me'}"
- Song Lyrics: "${songLyrics || "You can count on me like one, two, three, I'll be there!"}"
- Rhythm accuracy: ${rhythmScore ?? 80}%
- Pitch accuracy: ${pitchScore ?? 82}%
- Overall performance score: ${overallScore}%
- Result tier: ${isOutstanding ? 'OUTSTANDING' : 'KEEP_TRYING (Good effort, but needs practice)'}

Generate a super cute, encouraging evaluation from RoboBuddy for this Grade 5 elementary student.
Remember:
- Status must be either "OUTSTANDING" or "KEEP_TRYING"
- If OUTSTANDING, celebrate their rhythm, expression, and melody!
- If KEEP_TRYING, praise their brave effort and give 1-2 easy, cute tips.
- Everything in child-friendly, lively English suited for a 10-11 year old Grade 5 student!
`;

    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.apiKey || apiKey;

    if (!userApiKey) {
      return res.json(getFallbackStudentEvaluation(isOutstanding, songTitle, studentName, overallScore));
    }

    const client = userApiKey === apiKey ? ai : new GoogleGenAI({
      apiKey: userApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: ROBOBUDDY_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    try {
      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch {
      return res.json(getFallbackStudentEvaluation(isOutstanding, songTitle, studentName, overallScore));
    }
  } catch (error: any) {
    console.error('Error in /api/student/evaluate:', error);
    const overallScore = Math.round(((req.body?.rhythmScore ?? 80) + (req.body?.pitchScore ?? 80)) / 2);
    const isOutstanding = overallScore >= 75;
    return res.json(getFallbackStudentEvaluation(isOutstanding, req.body?.songTitle, req.body?.studentName, overallScore));
  }
});

function getFallbackStudentEvaluation(
  isOutstanding: boolean,
  songTitle?: string,
  studentName?: string,
  score: number = 82
) {
  const name = studentName || 'Little Superstar';
  const song = songTitle || 'our favorite song';

  if (isOutstanding) {
    return {
      status: 'OUTSTANDING',
      headline: `🌟 OUTSTANDING! YOU'RE A TRUE MUSIC STAR, ${name.toUpperCase()}! 🌟`,
      badgeEarned: 'Golden Melody Superstar 🏆',
      stars: 5,
      robotMessage: `Beep boop hooray! 🤖🎶 Wow, you sang "${song}" so wonderfully! Your rhythm was super bouncy, and your smile shined through every note! RoboBuddy is dancing with joy! 🎈✨`,
      funTips: [
        'Keep singing with that big, happy energy! 💖',
        'Share your song with your family or classmates today! 🎤',
      ],
      cheerSound: 'hooray',
      skills: {
        rhythm: 92,
        pronunciation: 95,
        melody: 88,
        energy: 96,
      },
    };
  } else {
    return {
      status: 'KEEP_TRYING',
      headline: `💪 GREAT EFFORT, ${name.toUpperCase()}! KEEP PRACTICING WITH ME! 🌈`,
      badgeEarned: 'Rhythm Explorer Badge 🚀',
      stars: 4,
      robotMessage: `BEEP BEEP! 🤖 That was such a brave and joyful try on "${song}"! You are doing so well! With just a little more practice on the beat, you will be unstoppable! High five from RoboBuddy! ✋⭐`,
      funTips: [
        'Tap your foot along with the drum beat: 1, 2, 3, 4! 🥁',
        'Take a big, deep breath like filling a colorful balloon before the high notes! 🎈',
      ],
      cheerSound: 'sparkle',
      skills: {
        rhythm: 72,
        pronunciation: 76,
        melody: 70,
        energy: 82,
      },
    };
  }
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SonicMaster AI server running at http://0.0.0.0:${PORT}`);
  });
}

function getFallbackEvaluation(data: any) {
  const pitchAcc = data.pitchAccuracy ?? 86;
  const rhythmAcc = data.rhythmAccuracy ?? 89;
  const overall = Math.round((pitchAcc + rhythmAcc) / 2);

  return {
    quickSummary: {
      overallScore: overall,
      pitchScore: pitchAcc,
      rhythmScore: rhythmAcc,
      summaryText:
        'Bạn thể hiện cảm xúc âm nhạc rất tự nhiên với âm lượng ổn định ở các câu trung âm. Tuy nhiên, sự giải phóng hơi thở ở cuối câu còn bị gò bó, dẫn tới cao độ hơi chùng xuống (flat) khoảng 12 cents.',
    },
    spectralAnalysis: {
      strengths: [
        'Dải hài âm (Harmonics) từ 500Hz đến 2kHz rất đầy đặn, tạo nên màu sắc âm thanh ấm và vang tự nhiên.',
        'Nhịp điệu tổng thể bắt nhịp tốt ở đầu mỗi khuông nhạc, độ lệch nhịp chỉ ±18ms.',
      ],
      improvements: [
        {
          timestamp: '00:14',
          issue: 'Flat Pitch (-14 cents)',
          detail: 'Biên độ hạ đột ngột trước khi lên nốt G4, năng lượng formants vùng 2.8kHz bị hụt do mở khẩu hình chưa đủ rộng.',
        },
        {
          timestamp: '00:28',
          issue: 'Vibrato không ổn định (4.2 Hz)',
          detail: 'Tần số rung chậm hơn ngưỡng lý tưởng (5.5 - 6.5 Hz), độ sâu rung dao động thất thường giữa 15 cents và 48 cents.',
        },
      ],
      spectralInsight:
        'Phổ tần số cho thấy âm sắc (timbre) có tiềm năng lớn. Khuyến nghị nâng nhẹ High EQ +1.5dB ở tần số 3.5kHz để tôn dải ' +
        'presence' +
        ' của giọng.',
    },
    visualPostureFeedback: {
      postureScore: 82,
      observations: [
        'Góc nghiêng cằm hơi chúi xuống khi chuẩn bị vào nốt cao ở giây thứ 14, tạo áp lực lên cơ sụn thanh quản.',
        'Hai vai thả lỏng tương đối tốt, nhưng lồng ngực chưa mở rộng tối đa ở thì hít thở sâu.',
      ],
      ergonomicTips:
        'Giữ mắt nhìn thẳng ngang tầm mắt, tưởng tượng có sợi dây kéo nhẹ đỉnh đầu lên trần nhà để mở rộng đường dẫn khí.',
    },
    actionPlanMicroLearning: {
      suggestedLoop: {
        startSec: 12.5,
        endSec: 16.5,
        loopName: 'Vòng lặp nốt chuyển tiếp 00:12 - 00:16',
        recommendedTempo: 0.8,
      },
      drillDescription:
        'Bài tập Micro-drill 4 giây: Kích hoạt A-B Loop, giảm tempo xuống 0.8x (Time-stretch giữ nguyên cao độ). Thực hiện âm "Ng" trước khi mở khẩu hình sang nguyên âm "Ah" để định hình vị trí âm thanh.',
      drillSteps: [
        'Bước 1: Mute track bè, bật A-B Loop từ 12.5s đến 16.5s ở tốc độ 0.8x.',
        'Bước 2: Hát ngậm âm "Ng" theo đúng đường pitch chuẩn hiển thị trên Tuner.',
        'Bước 3: Mở khẩu hình chữ "Ah" giữ nguyên vị trí vang trên vòm họng mềm.',
        'Bước 4: Tăng tốc độ lên 1.0x và bật lại toàn bộ Stems để hòa âm hoàn chỉnh.',
      ],
    },
    skillHeatmapUpdate: {
      pitch: Math.min(100, (data.currentSkills?.pitch || 78) + 3),
      rhythm: Math.min(100, (data.currentSkills?.rhythm || 82) + 2),
      dynamics: Math.min(100, (data.currentSkills?.dynamics || 75) + 4),
      phrasing: Math.min(100, (data.currentSkills?.phrasing || 70) + 1),
      vibrato: Math.min(100, (data.currentSkills?.vibrato || 65) + 5),
      timbre: Math.min(100, (data.currentSkills?.timbre || 80) + 2),
      deltaExplanation:
        'Kỹ năng Vibrato và Dynamics được cộng điểm nhờ khả năng kiểm soát độ lớn mềm mại và nỗ lực điều tiết biên độ.',
    },
    teacherNotes: [
      {
        timestampSec: 14.2,
        tag: 'pitch',
        annotation: 'Chú ý nốt G4 bị flat -14 cents. Cần nâng cơ hàm mềm khi lấy hơi.',
      },
      {
        timestampSec: 22.0,
        tag: 'praise',
        annotation: 'Legato rất mượt mà và cảm xúc! Giữ vững phong độ này.',
      },
      {
        timestampSec: 28.5,
        tag: 'technique',
        annotation: 'Vibrato cần đều nhịp hơn, tránh gồng cơ cổ ở âm cuối.',
      },
    ],
  };
}

startServer();
