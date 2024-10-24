import TelegramBot from 'node-telegram-bot-api';
import { db } from '../firebase';
import { DateTime } from 'luxon';
import axios, { AxiosError } from 'axios';
import aiSettings from '../aiSettings.json';

const zodiacSigns: Record<string, string> = {
  'овен': '♈️',
  'телец': '♉️',
  'близнецы': '♊️',
  'рак': '♋️',
  'лев': '♌️',
  'дева': '♍️',
  'весы': '♎️',
  'скорпион': '♏️',
  'стрелец': '♐️',
  'козерог': '♑️',
  'водолей': '♒️',
  'рыбы': '♓️'
};

interface HoroscopeLog {
  lastGeneratedDate: string;
  lastResponse: string;
}

const generateAIHoroscope = async (sign: string, trainingData: string): Promise<string | null> => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key is not defined');
    }

    const prompt = `Сгенерируй нелепый гороскоп для знака зодиака ${sign}, используя следующие данные: \n\n${trainingData}. Добавь креативности, разнообразия и не повторяйся. Количество знаков должно быть до 300 символов. НЕ добавляй обращения в начало текста, по типу "Овен,".`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: aiSettings.systemMessage },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: aiSettings.temperature + 0.5,
      top_p: aiSettings.topP
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      console.error('Failed to generate AI horoscope:', error.response?.data || error.message);
    } else if (error instanceof Error) {
      console.error('Failed to generate AI horoscope:', error.message);
    } else {
      console.error('An unexpected error occurred during AI horoscope generation.');
    }
    return null;
  }
};

export const handleHoroscopeCommand = async (
  msg: TelegramBot.Message,
  bot: TelegramBot,
  zodiacSign: string
): Promise<void> => {
  const chatId = msg.chat.id.toString();
  const initiatorId = msg.from?.id?.toString();
  if (!initiatorId) {
    console.warn('User ID is undefined, skipping horoscope generation.');
    return;
  }

  const nowInMoscow = DateTime.now().setZone('Europe/Moscow');
  const todayDate = nowInMoscow.toISODate();

  const userDocRef = db.collection('horoscopes_logs').doc(`${initiatorId}_${zodiacSign}`);
  const userDoc = await userDocRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data() as HoroscopeLog;
    const lastGeneratedDate = userData?.lastGeneratedDate;
    const lastResponse = userData?.lastResponse;

    if (lastGeneratedDate === todayDate) {
      await bot.sendMessage(chatId, lastResponse);
      return;
    }
  }

  const horoscopesSnapshot = await db.collection('horoscopes').doc('horoscopes').get();
  const horoscopesData = horoscopesSnapshot.data();

  if (!horoscopesData || !horoscopesData.data) {
    console.error('No horoscopes data object found in Firestore.');
    await bot.sendMessage(chatId, 'Что-то пошло не так, попробуйте позже.');
    return;
  }

  const horoscopes = horoscopesData.data['horoscopes-text'] as string[];

  if (!horoscopes || horoscopes.length === 0) {
    console.error('Horoscopes array is empty in Firestore.');
    await bot.sendMessage(chatId, 'Что-то пошло не так, попробуйте позже.');
    return;
  }

  const shuffledHoroscopes = horoscopes.sort(() => 0.5 - Math.random()).slice(0, 10);
  const trainingData = shuffledHoroscopes.join('\n');

  const aiGeneratedHoroscope = await generateAIHoroscope(zodiacSign, trainingData);

  if (!aiGeneratedHoroscope) {
    await bot.sendMessage(chatId, 'Не удалось сгенерировать гороскоп. Попробуй позже 😕');
    return;
  }

  const response = `${zodiacSigns[zodiacSign.toLowerCase()]}${zodiacSign.charAt(0).toUpperCase() + zodiacSign.slice(1)}: ${aiGeneratedHoroscope}`;

  await userDocRef.set({
    lastGeneratedDate: todayDate,
    lastResponse: response,
  });

  await bot.sendMessage(chatId, response);
};
