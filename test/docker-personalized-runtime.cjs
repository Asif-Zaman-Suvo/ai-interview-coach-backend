// Run inside the production backend container with a synthetic fixture JSON at /tmp/aic-personalized-fixture.json.
// Uses a temporary, isolated Mongo database and removes only that database on completion.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Session, SessionSchema } = require('/app/dist/sessions/session.schema');
const { ResumeSchema } = require('/app/dist/resumes/resume.schema');
const { QuestionSchema } = require('/app/dist/questions/question.schema');
const { SessionsService } = require('/app/dist/sessions/sessions.service');
const { SessionPayloadService } = require('/app/dist/sessions/session-payload.service');
const { ResumesService } = require('/app/dist/resumes/resumes.service');
const { QuestionsService } = require('/app/dist/questions/questions.service');
const { QuestionGenerationService } = require('/app/dist/sessions/question-generation.service');
const { SessionsController } = require('/app/dist/sessions/sessions.controller');
const fixture = require('/tmp/aic-personalized-fixture.json');

async function main() {
  const dbName = `aic_personalized_check_${Date.now()}`;
  const connection = await mongoose.createConnection(process.env.MONGODB_URI, { dbName }).asPromise();
  try {
    const sessionsModel = connection.model(Session.name, SessionSchema);
    const resumesModel = connection.model('Resume', ResumeSchema);
    const questionsModel = connection.model('Question', QuestionSchema);
    const roleId = String(new mongoose.Types.ObjectId());
    const roles = { findById: async () => ({ name: 'Senior Frontend Engineer' }) };
    const redis = { getJson: async () => null, setJson: async () => {}, delByPattern: async () => {} };
    const questions = new QuestionsService(questionsModel, redis);
    let generations = 0;
    const generator = new QuestionGenerationService({ generateStructured: async () => { generations++; return { questions: fixture.generatedQuestions }; } });
    const resumes = new ResumesService(resumesModel, {}, {}, roles);
    const resume = await resumesModel.create({
      userId: 'synthetic-owner', extractedText: 'React reporting dashboard synthetic private evidence',
      format: 'pdf', sizeBytes: 100, status: 'confirmed', analysis: { ...fixture.profile, coreSkills: ['Incorrect analysis'] },
      reviewedProfile: fixture.profile, targetRoleId: roleId, difficulty: 'Hard',
    });
    const bank = await questionsModel.create({
      sessionId: '__question_bank__', roleId, difficulty: 'Hard', type: 'technical', text: fixture.bankTexts[0],
      idealAnswer: 'Private reference: compare storage strategies, browser threats, expiry and security trade-offs.',
    });
    const answers = { findBySession: async () => [] };
    const sessions = new SessionsService(sessionsModel, roles, answers, questions, redis);
    const payload = new SessionPayloadService(sessions, answers, roles, questions);
    const users = { createProfileIfAbsent: async () => {}, getRoleForEmail: async () => 'admin' };
    const controller = new SessionsController(sessions, payload, questions, answers, roles, {}, users, resumes, generator);
    const request = { user: { id: 'synthetic-owner', email: 'synthetic@example.test' } };
    const started = await controller.startSession({ roleId, difficulty: 'Hard', resumeId: String(resume._id) }, request);
    assert.equal(started.questions.length, 5);
    const saved = await sessionsModel.findById(started.sessionId);
    assert.equal(saved.questionSnapshots.filter(q => q.source === 'resume_personalized').length, 2);
    assert.equal(saved.questionSnapshots.filter(q => q.source === 'target_role').length, 2);
    assert.equal(saved.questionSnapshots.filter(q => q.source === 'curated_bank').length, 1);
    assert.ok(saved.questionSnapshots.every(q => q.idealAnswer));
    const before = await payload.assembleSessionPayload(started.sessionId);
    await questionsModel.findByIdAndUpdate(bank._id, { text: 'Edited after creation', idealAnswer: 'Edited reference' });
    await questionsModel.findByIdAndDelete(bank._id);
    await resumesModel.findByIdAndUpdate(resume._id, { reviewedProfile: { ...fixture.profile, coreSkills: ['Changed later'] } });
    const after = await payload.assembleSessionPayload(started.sessionId);
    assert.deepEqual(after.questions, before.questions);
    assert.equal(generations, 1);
    assert.ok(!/idealAnswer|resumeEvidence|rationale|extractedText|reviewedProfile|Private reference/.test(JSON.stringify(after)));
    assert.equal(await questionsModel.countDocuments(), 0); // Generated questions never entered the bank.
    console.log(JSON.stringify({ mongoPersistence: 'passed', sources: { resume_personalized: 2, target_role: 2, curated_bank: 1 }, bankAndResumeEditsStable: true, generationCalls: generations, learnerPrivacy: 'passed' }));
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
}
main().catch(() => { console.error('Synthetic Docker persistence check failed.'); process.exitCode = 1; });
