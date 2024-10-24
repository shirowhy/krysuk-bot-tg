import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import { db } from '../firebase';
import { getResponseChance } from './firebaseHelper';
import aiSettings from '../aiSettings.json';

interface Message {
  text: string;
  senderId: number;
  date: string;
}

const preprocessText = (text: string): string => {
  return text.trim();
};

export const getMessagesFromFirestore = async (chatId: string, limitNumber: number = 10): Promise<Message[]> => {
  const messages: Message[] = [];
  try {
    const q = db.collection(`messages_${chatId}`)
      .orderBy("date", "desc")
      .limit(limitNumber);
    const querySnapshot = await q.get();

    querySnapshot.forEach((doc) => {
      messages.push(doc.data() as Message);
    });
  } catch (e) {
    console.error("Error getting messages: ", e);
  }
  return messages;
};

const generateAIResponse = async (messageText: string, chatContext: string): Promise<string | null> => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key is not defined');
    }

    const preprocessedText = preprocessText(messageText);

    if (!preprocessedText) {
      return null;
    }

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: aiSettings.systemMessage },
        { role: 'user', content: chatContext },
        { role: 'user', content: preprocessedText },
      ],
      max_tokens: aiSettings.maxTokens,
      temperature: aiSettings.temperature,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Failed to generate AI response:', error.response?.data || error.message);
    } else if (error instanceof Error) {
      console.error('Failed to generate AI response:', error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
    return null;
  }
};

export const handleAIResponse = async (
  msg: TelegramBot.Message, 
  forceResponse = false, 
  bot: TelegramBot, 
  responseTemplate?: string
): Promise<void> => {
  const chatId = msg.chat.id.toString();
  const messageText = msg.text || '';

  let responseChance = await getResponseChance(chatId);

  if (forceResponse) {
    responseChance = 100;
  }

  const randomValue = Math.random() * 100;

  if (randomValue > responseChance) {
    console.log(`Random value: ${randomValue}, Response chance: ${responseChance} - No response.`);
    return;
  } else {
    console.log(`Random value: ${randomValue}, Response chance: ${responseChance} - Responding.`);
  }

  const previousMessages = await getMessagesFromFirestore(chatId, 15);
  const chatContext = previousMessages.map(msg => `${msg.senderId}: ${msg.text}`).join('\n');

  const aiResponse = await generateAIResponse(messageText.trim(), chatContext);

  console.log('Generated AI response:', aiResponse);
  if (aiResponse) {
    const finalResponse = responseTemplate ? `${responseTemplate} ${aiResponse}` : aiResponse;
    await bot.sendMessage(chatId, finalResponse);
  } else {
    console.log('AI did not generate a response.');
  }
};
