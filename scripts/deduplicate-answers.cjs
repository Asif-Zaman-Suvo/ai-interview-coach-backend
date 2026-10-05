// Dry run by default. Stop backend replicas and back up MongoDB before --apply.
require('dotenv/config');
const { MongoClient } = require('mongodb');
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = process.env.MONGODB_DB
      ? client.db(process.env.MONGODB_DB)
      : client.db();
    const answers = db.collection('answers');
    const groups = await answers
      .aggregate([
        { $sort: { createdAt: 1, _id: 1 } },
        {
          $group: {
            _id: { sessionId: '$sessionId', questionId: '$questionId' },
            ids: { $push: '$_id' },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
    console.log(
      `Duplicate question groups: ${groups.length}; extra answers: ${groups.reduce((n, g) => n + g.count - 1, 0)}`,
    );
    if (!process.argv.includes('--apply')) {
      console.log(
        'Dry run only. Stop backend replicas, back up MongoDB, then rerun with --apply.',
      );
      return;
    }
    const affected = new Set();
    for (const group of groups) {
      const ids = group.ids.slice(1);
      const duplicates = await answers.find({ _id: { $in: ids } }).toArray();
      // Retain originals in an archive before removing them from scoring.
      for (const doc of duplicates) {
        await db
          .collection('answer_duplicates_archive')
          .replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
      await answers.deleteMany({ _id: { $in: ids } });
      affected.add(group._id.sessionId);
    }
    // Recompute completed scores. Existing summaries remain historical text.
    const { ObjectId } = require('mongodb');
    for (const sessionId of affected) {
      const rows = await answers.find({ sessionId }).toArray();
      const score = rows.length
        ? Math.round(rows.reduce((n, a) => n + a.score, 0) / rows.length)
        : 0;
      if (ObjectId.isValid(sessionId)) {
        await db
          .collection('sessions')
          .updateOne(
            { _id: new ObjectId(sessionId), status: 'completed' },
            { $set: { score } },
          );
      }
    }
    await answers.createIndex(
      { sessionId: 1, questionId: 1 },
      { unique: true },
    );
    console.log(
      'Migration complete; duplicates archived and affected completed scores recalculated.',
    );
  } finally {
    await client.close();
  }
}
main().catch(() => {
  console.error(
    'Migration failed. Check database connectivity and index/data state.',
  );
  process.exitCode = 1;
});
