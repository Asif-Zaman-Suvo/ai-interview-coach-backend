import { Injectable, Logger } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  type GenerativeModel,
} from '@google/generative-ai';

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

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isQuotaOrRateLimitError(error: unknown): boolean {
  if (error instanceof GoogleGenerativeAIFetchError && error.status === 429) {
    return true;
  }
  return errMessage(error).toLowerCase().includes('quota');
}

function stripJsonFences(text: string): string {
  return text.replace(/```json\n?|\n?```/g, '').trim();
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function parseQuestionsPayload(
  data: unknown,
  fallbackDifficulty: string,
): GeneratedQuestion[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format: expected an array');
  }
  return data.map((item) =>
    parseOneGeneratedQuestion(item, fallbackDifficulty),
  );
}

function parseOneGeneratedQuestion(
  item: unknown,
  fallbackDifficulty: string,
): GeneratedQuestion {
  if (typeof item !== 'object' || item === null) {
    throw new Error('Invalid question entry');
  }
  const o = item as Record<string, unknown>;
  if (typeof o.text !== 'string' || typeof o.idealAnswer !== 'string') {
    throw new Error('Invalid question: text and idealAnswer must be strings');
  }
  const type: GeneratedQuestion['type'] =
    o.type === 'behavioral' ? 'behavioral' : 'technical';
  const difficulty =
    typeof o.difficulty === 'string' ? o.difficulty : fallbackDifficulty;
  return { text: o.text, idealAnswer: o.idealAnswer, type, difficulty };
}

function parseEvaluationPayload(data: unknown): AnswerEvaluation {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid evaluation response');
  }
  const o = data as Record<string, unknown>;
  if (typeof o.score !== 'number' || !Number.isFinite(o.score)) {
    throw new Error('Invalid evaluation: score must be a number');
  }
  if (typeof o.feedback !== 'string') {
    throw new Error('Invalid evaluation: feedback must be a string');
  }
  return {
    score: Math.min(100, Math.max(0, Math.round(o.score))),
    feedback: o.feedback,
    strengths: asStringArray(o.strengths).slice(0, 3),
    improvements: asStringArray(o.improvements).slice(0, 3),
  };
}

function parseSummaryPayload(data: unknown): SessionSummary {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid summary response');
  }
  const o = data as Record<string, unknown>;
  if (typeof o.summary !== 'string') {
    throw new Error('Invalid summary: summary must be a string');
  }
  return {
    summary: o.summary,
    topImprovements: asStringArray(o.topImprovements).slice(0, 3),
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private model?: GenerativeModel;
  private readonly useMock = process.env.USE_MOCK_AI === 'true';

  constructor() {
    const apiKey =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GOOGLE_AI_API_KEY?.trim();
    if (!apiKey && !this.useMock) {
      this.logger.warn(
        'No Gemini API key (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_AI_API_KEY); using mock mode',
      );
    }

    if (this.useMock || !apiKey) {
      this.logger.log('Running in MOCK AI mode - no API calls will be made');
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
    this.model = genAI.getGenerativeModel({ model: modelId });
    this.logger.log(`AI Service initialized with model: ${modelId}`);
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    if (this.useMock) {
      return fn();
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        const isRateLimit = isQuotaOrRateLimitError(error);

        if (!isRateLimit || attempt === maxRetries - 1) {
          throw error;
        }

        const retryDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        this.logger.warn(
          `Rate limited, retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  async generateQuestions(
    roleName: string,
    difficulty: string,
    resumeText?: string,
  ): Promise<GeneratedQuestion[]> {
    // Mock mode for development or when API is unavailable
    if (this.useMock || !this.model) {
      this.logger.log('Using mock questions for development');
      return this.getMockQuestions(roleName, difficulty);
    }

    const model = this.model;

    try {
      return await this.retryWithBackoff(async () => {
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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed: unknown = JSON.parse(stripJsonFences(responseText));

        return parseQuestionsPayload(parsed, difficulty);
      });
    } catch (error: unknown) {
      this.logger.error('Error generating questions:', errMessage(error));

      if (isQuotaOrRateLimitError(error)) {
        this.logger.warn('API quota exceeded, falling back to mock questions');
        return this.getMockQuestions(roleName, difficulty);
      }

      throw new Error(`Failed to generate questions: ${errMessage(error)}`);
    }
  }

  async evaluateAnswer(
    question: string,
    idealAnswer: string,
    transcript: string,
  ): Promise<AnswerEvaluation> {
    // Mock mode for development or when API is unavailable
    if (this.useMock || !this.model) {
      this.logger.log('Using mock answer evaluation');
      return this.getMockEvaluation(transcript);
    }

    const model = this.model;

    try {
      return await this.retryWithBackoff(async () => {
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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed: unknown = JSON.parse(stripJsonFences(responseText));

        return parseEvaluationPayload(parsed);
      });
    } catch (error: unknown) {
      this.logger.error('Error evaluating answer:', errMessage(error));

      if (isQuotaOrRateLimitError(error)) {
        this.logger.warn('API quota exceeded, falling back to mock evaluation');
        return this.getMockEvaluation(transcript);
      }

      throw new Error(`Failed to evaluate answer: ${errMessage(error)}`);
    }
  }

  async generateSessionSummary(
    scores: number[],
    feedbacks: string[],
  ): Promise<SessionSummary> {
    // Mock mode for development or when API is unavailable
    if (this.useMock || !this.model) {
      this.logger.log('Using mock session summary');
      return this.getMockSummary(scores);
    }

    const model = this.model;

    try {
      return await this.retryWithBackoff(async () => {
        const prompt = `Based on the following interview performance data:
	Scores: ${scores.join(', ')}
	Feedback: ${feedbacks.join(' | ')}

	Return ONLY JSON (no extra text, no markdown formatting):
	{
	  "summary": "2-3 sentence overall performance summary",
	  "topImprovements": ["improvement1", "improvement2", "improvement3"]
	}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed: unknown = JSON.parse(stripJsonFences(responseText));

        return parseSummaryPayload(parsed);
      });
    } catch (error: unknown) {
      this.logger.error('Error generating session summary:', errMessage(error));

      if (isQuotaOrRateLimitError(error)) {
        this.logger.warn('API quota exceeded, falling back to mock summary');
        return this.getMockSummary(scores);
      }

      throw new Error(
        `Failed to generate session summary: ${errMessage(error)}`,
      );
    }
  }

  private getMockQuestions(
    roleName: string,
    difficulty: string,
  ): GeneratedQuestion[] {
    const questionSets: { [key: string]: GeneratedQuestion[] } = {
      'Frontend Developer': [
        {
          text: `Explain the concept of virtual DOM in React and how it improves performance.`,
          idealAnswer: `The virtual DOM is a lightweight JavaScript representation of the actual DOM. React creates a virtual DOM tree in memory and syncs it with the real DOM using a process called reconciliation. When state changes, React creates a new virtual DOM tree, compares it with the previous one using diffing algorithm, and only updates the changed elements in the real DOM. This minimizes expensive DOM operations and improves performance significantly.`,
          type: 'technical',
          difficulty: difficulty,
        },
        {
          text: `Describe your experience with state management in React applications.`,
          idealAnswer: `I have experience with various state management solutions including Context API for simple state, Redux for complex applications with middleware, and React Query for server state. I understand when to use each approach based on application complexity, performance requirements, and team expertise. I prefer starting with Context API and upgrading to Redux when the state becomes too complex or when we need advanced features like time-travel debugging.`,
          type: 'behavioral',
          difficulty: difficulty,
        },
        {
          text: `How do you optimize the performance of a React application?`,
          idealAnswer: `I optimize React applications by using code splitting and lazy loading, implementing memoization with React.memo and useMemo, avoiding unnecessary re-renders with useCallback, optimizing images and assets, using production builds, implementing proper key props, avoiding inline functions in render, using virtual scrolling for large lists, and measuring performance with React DevTools Profiler.`,
          type: 'technical',
          difficulty: difficulty,
        },
        {
          text: `Tell me about a challenging frontend bug you fixed.`,
          idealAnswer: `In a previous project, we had a memory leak caused by event listeners not being properly cleaned up. I used React DevTools and Chrome Memory Profiler to identify the issue, tracked it down to a component that wasn't removing event listeners in useEffect cleanup, and implemented proper cleanup functions. This reduced memory usage by 60% and eliminated browser crashes. I also added linting rules to prevent similar issues.`,
          type: 'behavioral',
          difficulty: difficulty,
        },
        {
          text: `Explain CSS Grid vs Flexbox and when to use each.`,
          idealAnswer: `Flexbox is one-dimensional and designed for layout in a row or column. It's perfect for aligning items, distributing space, and handling responsive components. CSS Grid is two-dimensional and designed for complex layouts with rows and columns. I use Flexbox for component-level layouts like navigation bars and card arrangements, while Grid is better for page-level layouts like dashboards and image galleries. They can be used together effectively.`,
          type: 'technical',
          difficulty: difficulty,
        },
      ],
      'Backend Developer': [
        {
          text: `Explain the concept of database indexing and when to use indexes.`,
          idealAnswer: `Database indexes are data structures that improve query performance by allowing fast lookups, similar to a book index. I use indexes on columns frequently used in WHERE clauses, JOIN conditions, and ORDER BY statements. However, I'm careful not to over-index as they slow down INSERT/UPDATE operations and consume storage. I consider selectivity, query patterns, and table size when designing indexes.`,
          type: 'technical',
          difficulty: difficulty,
        },
        {
          text: `How do you handle authentication and authorization in your APIs?`,
          idealAnswer: `I implement authentication using JWT tokens for stateless authentication, OAuth 2.0 for third-party integration, and secure password hashing with bcrypt. For authorization, I use role-based access control (RBAC) with middleware to check permissions. I also implement rate limiting, input validation, HTTPS enforcement, and follow OWASP security guidelines. I store tokens securely with HttpOnly cookies and implement proper token refresh mechanisms.`,
          type: 'technical',
          difficulty: difficulty,
        },
        {
          text: `Describe a time you optimized a slow API endpoint.`,
          idealAnswer: `We had an endpoint that took 10 seconds to load due to N+1 queries. I identified the issue using query logging and profiling, implemented eager loading with proper joins, added database indexes on frequently queried columns, implemented Redis caching for static data, and used pagination for large datasets. The endpoint now loads in 200ms. I also set up monitoring to prevent similar issues.`,
          type: 'behavioral',
          difficulty: difficulty,
        },
        {
          text: `Explain microservices architecture and its trade-offs.`,
          idealAnswer: `Microservices break applications into small, independent services communicating via APIs. Benefits include independent deployment, technology diversity, better fault isolation, and improved scalability. Drawbacks include increased complexity, distributed system challenges, data consistency issues, and operational overhead. I recommend starting with a monolith and splitting into microservices when the team can handle the complexity and clear service boundaries emerge.`,
          type: 'technical',
          difficulty: difficulty,
        },
        {
          text: `How do you approach database design and normalization?`,
          idealAnswer: `I follow database normalization principles (1NF, 2NF, 3NF) to eliminate redundancy and ensure data integrity. However, I'm pragmatic about denormalization for performance when appropriate. I identify entities and relationships, use proper primary and foreign keys, consider indexing strategies upfront, and plan for scalability. I also use database constraints and validation rules to maintain data quality at the database level.`,
          type: 'behavioral',
          difficulty: difficulty,
        },
      ],
      'Full Stack Developer': [
        {
          text: `How do you ensure consistency between frontend and backend data models?`,
          idealAnswer: `I use TypeScript interfaces shared between frontend and backend, implement API contracts with OpenAPI/Swagger, use validation libraries like Zod for runtime validation, and maintain clear API documentation. I also implement proper error handling and loading states on the frontend, use DTOs to map between database models and API responses, and follow RESTful conventions for predictable API behavior.`,
          type: 'technical',
          difficulty: difficulty,
        },
        {
          text: `Describe your approach to full-stack debugging.`,
          idealAnswer: `I use browser DevTools for frontend debugging, backend logging and profiling for server issues, and network tab to analyze API calls. I set up proper error tracking with Sentry, use debugging breakpoints effectively, and implement comprehensive logging. I also write integration tests to catch issues early, use TypeScript for type safety, and follow systematic debugging approaches to isolate problems.`,
          type: 'behavioral',
          difficulty: difficulty,
        },
        {
          text: `How do you handle state synchronization between client and server?`,
          idealAnswer: `I implement optimistic updates for better UX, with rollback on error, use WebSockets for real-time updates when needed, implement proper cache invalidation strategies, and use server state management libraries like React Query. I also implement retry logic for failed requests, handle conflicts with versioning, and ensure data consistency with proper transaction management on the backend.`,
          type: 'technical',
          difficulty: difficulty,
        },
        {
          text: `Explain the full request lifecycle from browser to server.`,
          idealAnswer: `When a user makes a request, the browser performs DNS resolution, establishes a TCP connection, sends the HTTP request through the internet, hits load balancers, routes to the appropriate server, passes through middleware for auth/logging, reaches the route handler, interacts with databases/external services, processes the response, sends it back through the same path, and the browser renders it. Each step has potential failure points and optimization opportunities.`,
          type: 'technical',
          difficulty: difficulty,
        },
        {
          text: `Tell me about a full-stack project you're proud of.`,
          idealAnswer: `I built a real-time collaboration tool using Next.js and Node.js with WebSockets. The main challenges were handling concurrent edits, managing connection state, and ensuring data consistency. I implemented operational transformation for conflict resolution, used Redis for session management, and built a scalable architecture handling thousands of concurrent users. The project taught me a lot about real-time systems and helped me understand performance optimization at every layer of the stack.`,
          type: 'behavioral',
          difficulty: difficulty,
        },
      ],
    };

    // Return questions for the specific role, or generic questions if role not found
    return (
      questionSets[roleName] ||
      questionSets['Frontend Developer'].map((q) => ({
        ...q,
        text: q.text.replace('React', 'modern web frameworks'),
      }))
    );
  }

  private getMockEvaluation(transcript: string): AnswerEvaluation {
    const length = transcript.length;
    const score = Math.min(100, Math.max(40, Math.floor(length / 5)));

    return {
      score: score,
      feedback: `Your answer demonstrates ${score > 70 ? 'good understanding' : 'basic knowledge'} of the topic. ${score > 70 ? 'You provided relevant details and showed confidence in your explanation.' : 'Consider providing more specific examples and technical details to strengthen your response.'}`,
      strengths: [
        'Demonstrated core understanding of the concept',
        'Provided a structured response',
        'Showed enthusiasm for the topic',
      ].slice(0, score > 70 ? 3 : 1),
      improvements: [
        'Include more specific technical examples',
        'Elaborate on practical implementations',
        'Mention relevant industry best practices',
      ].slice(0, score > 70 ? 1 : 3),
    };
  }

  private getMockSummary(scores: number[]): SessionSummary {
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    return {
      summary: `Overall performance was ${avgScore > 70 ? 'strong' : avgScore > 50 ? 'satisfactory' : 'developing'}. You ${avgScore > 70 ? 'demonstrated solid technical knowledge' : 'showed understanding in several areas'} and would benefit from ${avgScore > 70 ? 'continuing to build on your strengths' : 'more practice with technical concepts'}.`,
      topImprovements: [
        'Practice providing more detailed technical explanations',
        'Include specific examples from your experience',
        'Study industry best practices and patterns',
      ],
    };
  }
}
