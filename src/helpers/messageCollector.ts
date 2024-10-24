import TelegramBot from 'node-telegram-bot-api';
import { db } from '../firebase';

export const collectMessage = async (msg: TelegramBot.Message): Promise<void> => {
  const chatId = msg.chat.id.toString();
  const senderId = msg.from?.id?.toString();

  if (!chatId || !senderId) {
    console.warn('Chat ID or Sender ID is undefined, skipping message collection.');
    return;
  }

  const message = {
    text: msg.text?.trim() || '',
    senderId: senderId,
    date: new Date().toISOString(),
    chatId: chatId,
  };

  try {
    const docRef = await db.collection(`messages_${chatId}`).add(message);
    console.log(`Message saved in collection 'messages_${chatId}' with ID:`, docRef.id);
  } catch (e) {
    console.error('Error saving message:', e as Error);
    const error = e as Error;
    if (error.message.includes('NOT_FOUND')) {
      console.error('Resource not found. Please ensure that the Firestore collection exists.');
    }
  }
};