import dotenv from 'dotenv';

dotenv.config();

interface ChatSettings {
  responseChance?: number;
}

interface AllSettings {
  [key: number]: ChatSettings;
}

export const config = {
  token: process.env.TOKEN || ''
};