import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const RoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    icon: { type: String, required: true },
    description: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

const Role = mongoose.model('Role', RoleSchema);

async function seedRoles() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/interview-coach';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Define default roles
    const defaultRoles = [
      {
        name: 'Frontend Developer',
        icon: '🎨',
        description:
          'Focuses on user interface, user experience, and client-side development',
      },
      {
        name: 'Backend Developer',
        icon: '⚙️',
        description:
          'Focuses on server-side logic, databases, and application architecture',
      },
      {
        name: 'Full Stack Developer',
        icon: '🔄',
        description: 'Works on both frontend and backend development',
      },
      {
        name: 'DevOps Engineer',
        icon: '🚀',
        description: 'Focuses on deployment, infrastructure, and automation',
      },
      {
        name: 'Data Scientist',
        icon: '📊',
        description:
          'Focuses on data analysis, machine learning, and statistical modeling',
      },
      {
        name: 'Mobile Developer',
        icon: '📱',
        description: 'Specializes in mobile application development',
      },
      {
        name: 'UI/UX Designer',
        icon: '🎯',
        description: 'Focuses on user interface design and user experience',
      },
      {
        name: 'Product Manager',
        icon: '📋',
        description: 'Manages product development and strategy',
      },
    ];

    // Insert roles
    for (const role of defaultRoles) {
      const existingRole = await Role.findOne({ name: role.name });

      if (existingRole) {
        console.log(`ℹ️  Role "${role.name}" already exists, skipping...`);
      } else {
        await Role.create(role);
        console.log(`✅ Created role: ${role.name}`);
      }
    }

    console.log('\n🎉 Role seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedRoles();
