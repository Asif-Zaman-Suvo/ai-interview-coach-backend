import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeneratedQuestion {
  text: string;
  idealAnswer: string;
  type: 'technical' | 'behavioral';
  difficulty: string;
}

interface AnswerEvaluation {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface SessionSummary {
  summary: string;
  topImprovements: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateQuestions(
    roleName: string,
    difficulty: string,
    resumeText?: string,
  ): Promise<GeneratedQuestion[]> {
    try {
      const resumeContext = resumeText
        ? ` Tailor questions to this resume: ${resumeText}`
        : '';

      const prompt = `Generate 5 ${difficulty} level technical interview questions for a ${roleName} position.${resumeContext}
Return ONLY a JSON array (no extra text, no markdown formatting):
[{
  "text": "question text",
  "idealAnswer": "comprehensive ideal answer",
  "type": "technical" or "behavioral",
  "difficulty": "${difficulty}"
}]`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response.text();

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const questions = JSON.parse(cleanedResponse);

      if (!Array.isArray(questions)) {
        throw new Error('Invalid response format: expected an array');
      }

      return questions.map((q) => ({
        text: q.text,
        idealAnswer: q.idealAnswer,
        type: q.type as 'technical' | 'behavioral',
        difficulty: q.difficulty,
      }));
    } catch (error) {
      this.logger.error('Error generating questions:', error);
      throw new Error(`Failed to generate questions: ${error.message}`);
    }
  }

  async evaluateAnswer(
    question: string,
    idealAnswer: string,
    transcript: string,
  ): Promise<AnswerEvaluation> {
    try {
      const prompt = `You are an expert technical interview evaluator.
Question: ${question}
Ideal Answer: ${idealAnswer}
Candidate's Answer: ${transcript}

Return ONLY JSON (no extra text, no markdown formatting):
{
  "score": number (0-100),
  "feedback": string (2-3 sentences),
  "strengths": [array of max 3 specific strengths],
  "improvements": [array of max 3 specific improvements]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response.text();

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const evaluation = JSON.parse(cleanedResponse);

      return {
        score: evaluation.score,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths || [],
        improvements: evaluation.improvements || [],
      };
    } catch (error) {
      this.logger.error('Error evaluating answer:', error);
      throw new Error(`Failed to evaluate answer: ${error.message}`);
    }
  }

  async generateSessionSummary(
    scores: number[],
    feedbacks: string[],
  ): Promise<SessionSummary> {
    try {
      const prompt = `Based on the following interview performance data:
Scores: ${scores.join(', ')}
Feedback: ${feedbacks.join(' | ')}

Return ONLY JSON (no extra text, no markdown formatting):
{
  "summary": "2-3 sentence overall performance summary",
  "topImprovements": ["improvement1", "improvement2", "improvement3"]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response.text();

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const summary = JSON.parse(cleanedResponse);

      return {
        summary: summary.summary,
        topImprovements: summary.topImprovements || [],
      };
    } catch (error) {
      this.logger.error('Error generating session summary:', error);
      throw new Error(`Failed to generate session summary: ${error.message}`);
    }
  }
}
