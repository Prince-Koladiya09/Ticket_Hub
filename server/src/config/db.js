import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../common/logger.js';

mongoose.set('strictQuery', true);

export async function connectMongo() {
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000, maxPoolSize: 20 });
  logger.info('MongoDB connected');
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}
