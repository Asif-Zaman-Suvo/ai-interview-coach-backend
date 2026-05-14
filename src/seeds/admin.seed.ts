import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    name: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  {
    collection: 'user_profiles',
    timestamps: true,
  },
);

const User = mongoose.model('User', UserSchema);

/** Better Auth mongo adapter default collection for users. */
const BETTER_AUTH_USER_COLLECTION =
  process.env.BETTER_AUTH_USER_COLLECTION || 'user';

async function seedAdmin() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/interview-coach';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const rawEmail = process.argv[2];
    if (!rawEmail?.trim()) {
      console.error('Please provide an email address:');
      console.error('npx ts-node src/seeds/admin.seed.ts user@example.com');
      process.exit(1);
    }

    const email = rawEmail.trim().toLowerCase();

    let user = await User.findOne({ email });

    if (!user) {
      const db = mongoose.connection.db;
      if (!db) {
        console.error('No database connection');
        process.exit(1);
      }

      const baUser = await db
        .collection(BETTER_AUTH_USER_COLLECTION)
        .findOne<{ email?: string; name?: string }>({
          email: { $regex: new RegExp(`^${escapeRegExp(email)}$`, 'i') },
        });

      if (!baUser?.email) {
        console.error(
          `No user with email "${email}" in user_profiles or ` +
            `collection "${BETTER_AUTH_USER_COLLECTION}" (Better Auth).`,
        );
        console.error(
          'Sign up first, or set BETTER_AUTH_USER_COLLECTION if your Better Auth user collection uses another name.',
        );
        process.exit(1);
      }

      const canonicalEmail = String(baUser.email).toLowerCase();
      user = await User.findOneAndUpdate(
        { email: canonicalEmail },
        {
          $set: {
            email: canonicalEmail,
            name: typeof baUser.name === 'string' ? baUser.name : undefined,
            role: 'admin',
          },
        },
        { upsert: true, new: true },
      );

      if (!user) {
        console.error('Failed to create or load user_profiles row');
        process.exit(1);
      }

      console.log(
        `Created/updated user_profiles from Better Auth and set admin for ${canonicalEmail}`,
      );
    } else {
      user.role = 'admin';
      await user.save();
      console.log(`✅ Successfully updated ${email} to admin role`);
    }

    console.log(`User ID: ${String(user._id)}`);
    console.log(`Name: ${user.name || 'N/A'}`);
    console.log(`Role: ${user.role}`);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

void seedAdmin();
