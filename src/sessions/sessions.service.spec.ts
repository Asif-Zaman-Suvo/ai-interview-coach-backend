import { SessionsService } from './sessions.service';
type Deps = ConstructorParameters<typeof SessionsService>;
describe('atomic session completion', () => {
  const result = {
    score: 80,
    summary: 'Saved',
    topImprovements: ['Practice'],
    summarySource: 'llm' as const,
  };
  it('only completes active sessions and invalidates marketing cache', async () => {
    const completed = { status: 'completed', ...result };
    const model = {
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(completed) }),
    };
    const redis = { delByPattern: jest.fn().mockResolvedValue(undefined) };
    const service = new SessionsService(
      ...([model, {}, {}, {}, redis] as unknown as Deps),
    );
    expect(await service.completeIfActive('id', result)).toBe(completed);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'id', status: 'active' },
      { $set: { ...result, status: 'completed' } },
      { new: true, runValidators: true },
    );
    expect(redis.delByPattern).toHaveBeenCalled();
  });
  it('returns the persisted winner if another backend completed first', async () => {
    const model = {
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(null) }),
    };
    const service = new SessionsService(
      ...([model, {}, {}, {}, {}] as unknown as Deps),
    );
    const winner = { score: 90, summary: 'First persisted result' };
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue(
        winner as unknown as Awaited<ReturnType<SessionsService['findById']>>,
      );
    expect(await service.completeIfActive('id', result)).toBe(winner);
  });
});
