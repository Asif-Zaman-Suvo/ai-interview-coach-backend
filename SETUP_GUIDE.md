# Interview Coach Backend - Setup Guide

## 🚀 Complete Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and set:

```env
PORT=3333
MONGODB_URI=mongodb://127.0.0.1:27017/ai-interview-coach
BETTER_AUTH_SECRET=your_secret_key_here
BETTER_AUTH_URL=http://localhost:3333
FRONTEND_URL=http://localhost:3000
```

Interview questions are loaded only from MongoDB (`questions` collection). Populate them via the admin UI (`/admin/questions`) or seeds — no external AI keys.

### 2. Database Setup

Make sure MongoDB is running:

```bash
# If using local MongoDB
brew services start mongodb-community

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 3. Seed Initial Data

**Seed Roles (Required):**

```bash
npx ts-node src/seeds/roles.seed.ts
```

**Create Admin User:**

```bash
# First, register a user through your frontend
# Then promote them to admin:
npx ts-node src/seeds/admin.seed.ts user@example.com
```

### 4. Start the Server

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## 📋 API Endpoints

### Authentication Endpoints (Better Auth)

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user

### Dashboard Endpoints (Auth Required)

- `GET /sessions/me/stats` - Get user statistics
- `GET /sessions/recent` - Get recent 5 sessions
- `GET /sessions/score-trend` - Get score trend for charts
- `GET /sessions/difficulties` - Get available difficulty levels

### Interview Session Endpoints (Auth Required)

- `GET /roles` - Get all available roles
- `POST /sessions/start` - Start new interview session (samples up to 5 questions from the bank for `roleId` + `difficulty`; fails if pool is empty)

  ```json
  {
    "roleId": "role_id_here",
    "difficulty": "Medium",
    "resumeText": "Optional; ignored for question selection"
  }
  ```

- `POST /sessions/:id/answer` - Submit answer to question

  ```json
  {
    "questionId": "question_id_here",
    "transcript": "User's spoken answer from Web Speech API"
  }
  ```

- `POST /sessions/:id/complete` - Complete session and get summary
- `GET /sessions/:id` - Get session details with all Q&A
- `GET /sessions?page=1&limit=10` - Get paginated session history

### Admin Endpoints (Admin + Auth Required)

- `GET /admin/stats` - Get platform statistics
- `GET /admin/users` - Get all users
- `PUT /admin/users/:id/role` - Update user role

  ```json
  {
    "role": "admin"
  }
  ```

- `DELETE /admin/users/:id` - Delete user
- `GET /admin/questions/bank` - List question bank entries (ideal answers, categories, difficulties)
- `POST /admin/questions` - Add question to bank (linked to `roleId`)
- `PUT /admin/questions/:id` - Update question / ideal answer
- `DELETE /admin/questions/:id` - Delete question
- `POST /admin/roles` - Create job role
- `PUT /admin/roles/:id` - Update job role
- `DELETE /admin/roles/:id` - Delete job role

## 🔧 Module Structure

```
src/
├── sessions/
│   ├── sessions.module.ts
│   ├── sessions.controller.ts  # Session endpoints
│   ├── sessions.service.ts
│   ├── interview-evaluation.service.ts  # Deterministic scoring vs ideal answers
│   └── session.schema.ts
├── questions/
│   ├── questions.module.ts
│   ├── questions.service.ts
│   └── question.schema.ts
├── answers/
│   ├── answers.module.ts
│   ├── answers.service.ts
│   └── answer.schema.ts
├── roles/
│   ├── roles.module.ts
│   ├── roles.controller.ts     # Public roles list
│   ├── roles.service.ts
│   └── role.schema.ts
├── admin/
│   ├── admin.module.ts
│   ├── admin.controller.ts     # Admin endpoints
│   └── admin.service.ts
├── auth/
│   ├── auth.guard.ts           # Authentication guard
│   └── admin.guard.ts          # Admin authorization guard
└── seeds/
    ├── admin.seed.ts           # Promote user to admin
    └── roles.seed.ts           # Seed initial roles
```

## 🔒 Authentication & Authorization

### Guards Usage:

- `@UseGuards(AuthGuard)` - Logged in users only
- `@UseGuards(AuthGuard, AdminGuard)` - Admin users only

### Example:

```typescript
@Post('start')
@UseGuards(AuthGuard)  // Only authenticated users
async startSession(@Req() req) {
  // req.user.id contains the user ID
  // req.user.role contains 'user' or 'admin'
}

@Get('stats')
@UseGuards(AuthGuard, AdminGuard)  // Only admins
async getStats() {
  // Admin only logic
}
```

## 📊 Interview Flow

### Questions

Questions are stored per role and difficulty in the admin question bank. Starting a session randomly samples from that pool.

### Answer Evaluation

Answers are scored deterministically against each question’s stored ideal/model answer (`InterviewEvaluationService`): score, feedback, strengths, and improvements — no LLM calls.

### Session Summary

Completion aggregates scores and highlights improvement themes from the same deterministic pipeline.

## 📊 MongoDB Collections

### Existing Collections (Don't Modify)

- `user_profiles` - User accounts with roles
- `sessions` - Better Auth sessions
- `accounts` - Linked accounts

### Application Collections

- `roles` - Job roles for grouping questions
- `questions` - Interview question bank (text, category, difficulty, `roleId`, ideal answer)
- `answers` - User answers with evaluation payloads
- Interview `sessions` documents (same DB; distinct from Better Auth session storage patterns — see `session.schema.ts`)

## 🎯 Default Roles

After seeding, you'll have these roles:

- Frontend Developer 🎨
- Backend Developer ⚙️
- Full Stack Developer 🔄
- DevOps Engineer 🚀
- Data Scientist 📊
- Mobile Developer 📱
- UI/UX Designer 🎯
- Product Manager 📋

## 🐛 Troubleshooting

### Issue: "MongoDB connection failed"

**Solution:** Make sure MongoDB is running and `MONGODB_URI` is correct

### Issue: "User not found" when running admin seed

**Solution:** User must be registered first through the frontend

### Issue: "Role not found" when starting session

**Solution:** Run `npx ts-node src/seeds/roles.seed.ts` first

### Issue: Empty question pool / 400 when starting interview

**Solution:** Add questions for that role and difficulty in `/admin/questions` (or via `POST /admin/questions`)

### Issue: TypeScript errors in IDE

**Solution:** Run `npm run build` to check for compilation errors

## 🚀 Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with secrets and URLs

# 3. Start MongoDB
brew services start mongodb-community

# 4. Seed roles
npx ts-node src/seeds/roles.seed.ts

# 5. Start development server
npm run start:dev

# 6. Register a user and promote to admin
npx ts-node src/seeds/admin.seed.ts user@example.com
```

## 📝 Notes

- All sessions are tied to the authenticated user
- Questions come only from the database (admin-maintained bank)
- Answers are evaluated server-side against ideal answers
- Admin users manage roles, question bank, and users via `/admin/*` APIs

## 🔐 Security Notes

- Never commit `.env` files
- Use strong `BETTER_AUTH_SECRET` in production
- Admin guard protects sensitive endpoints
- User data isolation enforced in controllers
- MongoDB should use authentication in production

## 📱 Frontend Integration

The backend expects these frontend features:

- Web Speech API for voice-to-text
- Session management for interview flow
- Real-time feedback display
- Dashboard with statistics
- Admin panel for platform management

## 🎉 Success Indicators

If everything is set up correctly:

1. Server starts without errors
2. MongoDB connections successful
3. Can register/login users
4. Can start interview sessions when the bank has questions for the chosen role/difficulty
5. Answers receive scores and feedback after each submission
6. Admin endpoints work for admin users
7. Session history and statistics work correctly
