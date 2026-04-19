import { beforeAll, afterAll } from 'vitest';
import sequelize from '../config/database';
import '../models/index';

beforeAll(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Test database connected!');
  } catch (error) {
    console.error('❌ Test database connection failed:', error);
    process.exit(1);
  }
});

afterAll(async () => {
  await sequelize.close();
  console.log('✅ Test database connection closed.');
});
