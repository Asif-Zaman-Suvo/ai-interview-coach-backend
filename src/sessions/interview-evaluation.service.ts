import { Injectable } from '@nestjs/common';

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'as',
  'is',
  'was',
  'are',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'i',
  'you',
  'we',
  'they',
  'it',
  'this',
  'that',
  'these',
  'those',
  'with',
  'from',
  'by',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Rule-based scoring (no external AI) comparing candidate text to rubric keywords. */
@Injectable()
export class InterviewEvaluationService {
  evaluateAnswer(
    question: string,
    idealAnswer: string,
    transcript: string,
  ): {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  } {
    const trimmed = transcript.trim();
    if (!trimmed) {
      return {
        score: 0,
        feedback:
          'No answer was submitted. Try outlining key points against the rubric.',
        strengths: [],
        improvements: ['Provide a substantive response', 'Reference examples'],
      };
    }

    const idealToks = normalizeWords(`${question} ${idealAnswer}`);
    const candToks = normalizeWords(transcript);

    const idealSet = new Set(idealToks);
    let overlap = 0;
    const hit = new Set<string>();
    for (const w of candToks) {
      if (idealSet.has(w) && !hit.has(w)) {
        overlap += 1;
        hit.add(w);
      }
    }

    const coverageDen = Math.max(8, idealSet.size);
    const coverage = overlap / coverageDen;

    let score = Math.round(45 + coverage * 45);

    const lenFactor = Math.min(1.2, trimmed.length / 400);
    score = Math.round(score * Math.min(lenFactor + 0.6, 1.15));

    score = Math.min(92, Math.max(38, score));

    let feedback =
      coverage > 0.25
        ? 'Your answer covers several ideas that match the intended solution space.'
        : 'Your answer is light on terminology and concepts referenced in the model answer.';
    if (coverage > 0.45) {
      feedback =
        'Strong alignment with core concepts expected for this prompt.';
    } else if (coverage < 0.12 && trimmed.length < 120) {
      feedback =
        'The response seems brief; elaborate with concrete examples and technical detail.';
    }

    const strengths: string[] =
      coverage > 0.2
        ? ['Touches on relevant terminology', 'Structure is understandable']
        : ['Response submitted on-topic'];

    const improvements: string[] =
      coverage >= 0.35
        ? ['Add sharper examples', 'Contrast trade-offs briefly']
        : [
            'Map your answer explicitly to bullets in the model answer',
            'Include one concrete scenario or metric',
          ];

    return {
      score,
      feedback,
      strengths,
      improvements,
    };
  }

  summarizeSession(
    scores: number[],
    feedbacks: string[],
  ): {
    summary: string;
    topImprovements: string[];
  } {
    const n = scores.length;
    const avg = n > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / n) : 0;

    let summary =
      avg >= 78
        ? 'Solid interview practice: consistency across prompts with room to deepen examples.'
        : avg >= 60
          ? 'Balanced session: tighten structure and specificity on tougher prompts.'
          : 'Early-stage practice — focus on crisp structure and aligning with rubric bullets.';

    summary += ` Average score ${avg}/100${n ? ` over ${n} answers` : ''}.`;

    const improvements = [
      'Prioritize STAR-style anecdotes where behavioral prompts appear',
      'Name trade-offs explicitly on technical prompts',
      'Close each answer by linking back to business impact',
    ];

    const fbSnippet = feedbacks.find((f) => f.length > 20);
    if (fbSnippet) {
      improvements[0] = `Review prior themes: "${fbSnippet.slice(0, 120)}..."`;
    }

    return { summary, topImprovements: improvements.slice(0, 3) };
  }
}
