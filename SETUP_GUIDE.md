# Interview Coach Backend - Setup Guide

## 🚀 Complete Setup Instructions

### 1. Environment Variables

Add these to your `.env` file:

```env
# Google Gemini AI API Key (Get from https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/interview-coach

# Better Auth Configuration
BETTER_AUTH_SECRET=your_secret_key_here
BETTER_AUTH_URL=http://localhost:3000
```

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
- `POST /sessions/start` - Start new interview session
  ```json
  {
    "roleId": "role_id_here",
    "difficulty": "Medium",
    "resumeText": "Optional resume text for tailored questions"
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
- `POST /admin/questions` - Manually add question to bank
- `PUT /admin/questions/:id` - Update question
- `DELETE /admin/questions/:id` - Delete question

## 🔧 Module Structure

```
src/
├── ai/
│   ├── ai.module.ts
│   └── ai.service.ts          # Gemini AI integration
├── sessions/
│   ├── sessions.module.ts
│   ├── sessions.controller.ts # Session endpoints
│   ├── sessions.service.ts
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
│   ├── roles.controller.ts    # Roles endpoints
│   ├── roles.service.ts
│   └── role.schema.ts
├── admin/
│   ├── admin.module.ts
│   ├── admin.controller.ts    # Admin endpoints
│   └── admin.service.ts
├── auth/
│   ├── auth.guard.ts          # Authentication guard
│   └── admin.guard.ts         # Admin authorization guard
└── seeds/
    ├── admin.seed.ts          # Promote user to admin
    └── roles.seed.ts          # Seed initial roles
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

## 🤖 AI Features

### Question Generation
The system uses Gemini AI to generate contextual interview questions based on:
- Role (Frontend, Backend, Full Stack, etc.)
- Difficulty Level (Easy, Medium, Hard)
- Optional Resume Text (for tailored questions)

### Answer Evaluation
Each answer is evaluated by AI providing:
- Score (0-100)
- Detailed feedback (2-3 sentences)
- Strengths (up to 3 points)
- Improvements (up to 3 points)

### Session Summary
At session completion, AI generates:
- Overall performance summary
- Top improvement areas

## 📊 MongoDB Collections

### Existing Collections (Don't Modify)
- `user_profiles` - User accounts with roles
- `sessions` - Better Auth sessions
- `accounts` - Linked accounts

### New Collections
- `roles` - Interview roles (Frontend, Backend, etc.)
- `questions` - Generated interview questions
- `answers` - User answers with AI feedback
- `sessions` - Interview sessions (note: name collision with auth sessions)

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

### Issue: "GEMINI_API_KEY not set"
**Solution:** Add your Gemini API key to `.env` file

### Issue: "MongoDB connection failed"
**Solution:** Make sure MongoDB is running and MONGODB_URI is correct

### Issue: "User not found" when running admin seed
**Solution:** User must be registered first through the frontend

### Issue: "Role not found" when starting session
**Solution:** Run `npx ts-node src/seeds/roles.seed.ts` first

### Issue: TypeScript errors in IDE
**Solution:** Run `npm run build` to check for compilation errors

## 🚀 Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your keys

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
- Questions are dynamically generated by AI
- Answers are evaluated in real-time
- Admin users can manage the entire platform
- Web Speech API integration happens on the frontend
- Backend only receives the transcript text

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
4. Can start interview sessions
5. AI generates questions and evaluates answers
6. Admin endpoints work for admin users
7. Session history and statistics work correctly