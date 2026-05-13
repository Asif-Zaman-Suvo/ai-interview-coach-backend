import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

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

async function seedAdmin() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/interview-coach';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get email from command line argument
    const email = process.argv[2];

    if (!email) {
      console.error('Please provide an email address:');
      console.error('npx ts-node src/seeds/admin.seed.ts user@example.com');
      process.exit(1);
    }

    // Find and update user to admin
    const user = await User.findOne({ email });

    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    user.role = 'admin' as any;
    await user.save();

    console.log(`✅ Successfully updated ${email} to admin role`);
    console.log(`User ID: ${user._id}`);
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

seedAdmin();
