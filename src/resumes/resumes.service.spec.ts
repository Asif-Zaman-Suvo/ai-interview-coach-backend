import { ResumesService } from './resumes.service';
import { profile } from '../../test/fixtures/resume-profile.fixture';
import { validateResumeProfile } from './resume.contract';
const id = '6ac38d37172d31d72f563feb';
const roleId = '6a05ae0156de6aad7e6a701f';
describe('resume persistence and ownership', () => {
  let service: ResumesService;
  let doc: {
    _id: string;
    userId: string;
    extractedText: string;
    format: string;
    status: string;
    analysis?: ReturnType<typeof validateResumeProfile>;
    reviewedProfile?: ReturnType<typeof validateResumeProfile>;
  };
  const exec = jest.fn();
  const select = jest.fn();
  const findOne = jest.fn();
  const updateOne = jest.fn();
  const findOneAndUpdate = jest.fn();
  const generateStructured = jest.fn();
  const create = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    doc = {
      _id: id,
      userId: 'candidate',
      extractedText: 'PRIVATE CV DATA',
      format: 'pdf',
      status: 'extracted',
    };
    exec.mockImplementation(() => Promise.resolve(doc));
    const query = { exec, select };
    select.mockReturnValue(query);
    findOne.mockReturnValue(query);
    updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    findOneAndUpdate.mockImplementation(
      (_filter: unknown, update: { $set: Record<string, unknown> }) => ({
        exec: () => Promise.resolve(Object.assign(doc, update.$set)),
      }),
    );
    generateStructured.mockResolvedValue(profile);
    create.mockResolvedValue(doc);
    service = new ResumesService(
      {
        findOne,
        updateOne,
        findOneAndUpdate,
        create,
      } as unknown as ConstructorParameters<typeof ResumesService>[0],
      {
        extract: jest.fn().mockResolvedValue({
          text: doc.extractedText,
          format: 'pdf',
          sizeBytes: 100,
        }),
      },
      { generateStructured },
      {
        findById: jest.fn().mockResolvedValue({ name: 'Full Stack Engineer' }),
      } as unknown as ConstructorParameters<typeof ResumesService>[3],
    );
  });
  it('persists validated analysis and returns an allowlisted profile', async () => {
    const result = await service.analyze(id, 'candidate');
    expect(result.profile).toEqual(profile);
    expect(doc.analysis).toEqual(profile);
    expect(result.status).toBe('analyzed');
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'resume_profile',
        context: { resumeContent: 'PRIVATE CV DATA' },
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE|extractedText|provider|model|apiKey/,
    );
  });
  it('saves extracted text once without returning it', async () => {
    const result = await service.upload('candidate');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'candidate',
        extractedText: 'PRIVATE CV DATA',
      }),
    );
    expect(result).not.toHaveProperty('extractedText');
  });
  it('retains extracted text after invalid output and allows retry without upload', async () => {
    generateStructured.mockResolvedValueOnce({ summary: 'wrong format' });
    await expect(service.analyze(id, 'candidate')).rejects.toMatchObject({
      status: 502,
    });
    expect(updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'candidate' }),
      expect.objectContaining({
        $set: {
          status: 'analysis_failed',
          errorCode: 'ANALYSIS_INVALID_OUTPUT',
        },
      }),
    );
    expect((await service.analyze(id, 'candidate')).profile).toEqual(profile);
    expect(create).not.toHaveBeenCalled();
  });
  it.each([
    ['provider_timeout', 504],
    ['provider_network_error', 503],
  ])('handles %s without leaking provider details', async (message, status) => {
    generateStructured.mockRejectedValue(new Error(message));
    await expect(service.analyze(id, 'candidate')).rejects.toMatchObject({
      status,
    });
    expect(doc.extractedText).toBe('PRIVATE CV DATA');
  });
  it('returns cached analysis instead of calling the model again', async () => {
    doc.analysis = validateResumeProfile(profile);
    await service.analyze(id, 'candidate');
    expect(generateStructured).not.toHaveBeenCalled();
  });
  it('queries by owner and never calls LLM for another user', async () => {
    exec.mockResolvedValue(null);
    await expect(service.analyze(id, 'other')).rejects.toMatchObject({
      status: 404,
    });
    expect(findOne).toHaveBeenCalledWith({ _id: id, userId: 'other' });
    expect(generateStructured).not.toHaveBeenCalled();
  });
  it('persists reviewed corrections with a different target role and chosen difficulty', async () => {
    doc.analysis = validateResumeProfile(profile);
    const edited = {
      ...profile,
      suggestedRole: 'Senior Frontend Engineer',
      coreSkills: ['Angular'],
    };
    const result = await service.confirm(id, 'candidate', {
      profile: edited,
      targetRoleId: roleId,
      difficulty: 'Hard',
    });
    expect(result.profile).toEqual(edited);
    expect(result.targetRoleId).toBe(roleId);
    expect(result.difficulty).toBe('Hard');
    expect(doc.analysis).toEqual(profile);
    await expect(
      service.assertConfirmed(id, 'candidate', roleId, 'Hard'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertConfirmed(id, 'candidate', roleId, 'Easy'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('requires analysis before confirmation and confirmation before starting', async () => {
    await expect(service.confirm(id, 'candidate', {})).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.assertConfirmed(id, 'candidate', roleId, 'Hard'),
    ).rejects.toMatchObject({ status: 400 });
  });
});
