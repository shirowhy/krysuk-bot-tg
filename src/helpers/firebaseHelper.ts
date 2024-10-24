import { Message } from 'firebase-admin/lib/messaging/messaging-api';
import { db } from '../firebase';

interface ChatSettings {
  responseChance: number;
}

export const getMessagesCountFromFirestore = async (chatId: string): Promise<number> => {
  try {
    const messagesRef = db.collection(`messages_${chatId}`);
    const snapshot = await messagesRef.get();
    return snapshot.size;
  } catch (error) {
    console.error('Error getting messages count from Firestore:', error);
    return 0;
  }
};

export const saveResponseChance = async (chatId: string, chance: number) => {
  const chatRef = db.collection('chat_settings').doc(chatId);
  await chatRef.set({ responseChance: chance }, { merge: true });
};

export const getResponseChance = async (chatId: string): Promise<number> => {
  const chatRef = db.collection('chat_settings').doc(chatId);
  const chatDoc = await chatRef.get();
  if (chatDoc.exists) {
    const responseChance = chatDoc.data()?.responseChance;
    if (responseChance !== undefined) {
      return responseChance;
    }
  }
  return 5;
};

export const getChatSettings = async (chatId: number): Promise<ChatSettings> => {
  const settingsRef = db.collection('chat_settings').doc(chatId.toString());
  const docSnap = await settingsRef.get();

  if (docSnap.exists) {
    return docSnap.data() as ChatSettings;
  } else {
    return { responseChance: 5 };
  }
};

export const updateChatSettings = async (chatId: number, newSettings: Partial<ChatSettings>): Promise<void> => {
  const settingsRef = db.collection('chat_settings').doc(chatId.toString());

  const docSnap = await settingsRef.get();
  if (docSnap.exists) {
    const currentSettings = docSnap.data() as ChatSettings;
    const updatedSettings = { ...currentSettings, ...newSettings };
    await settingsRef.set(updatedSettings, { merge: true });
  } else {
    await settingsRef.set(newSettings);
  }
};

export const getRandomMessagesFromFirestore = async (chatId: string, numberOfMessages: number = 5): Promise<Message[]> => {
  const allMessages: Message[] = [];
  const randomMessages: Message[] = [];
  try {
    const q = db.collection(`messages_${chatId}`);

    const querySnapshot = await q.get();

    querySnapshot.forEach((doc) => {
      allMessages.push(doc.data() as Message);
    });

    while (randomMessages.length < numberOfMessages && allMessages.length > 0) {
      const randomIndex = Math.floor(Math.random() * allMessages.length);
      randomMessages.push(allMessages.splice(randomIndex, 1)[0]);
    }
  } catch (e) {
    console.error("Error getting random messages: ", e);
  }
  return randomMessages;
};

export const removeOldMessagesIfNeeded = async (chatId: string, limit: number = 5000): Promise<void> => {
  try {
    const messagesRef = db.collection(`messages_${chatId}`);
    const snapshot = await messagesRef.orderBy('date', 'asc').get();

    if (snapshot.size > limit) {
      const messagesToDelete = snapshot.size - limit;
      console.log(`Deleting ${messagesToDelete} old messages from chat: ${chatId}`);

      const batch = db.batch();
      snapshot.docs.slice(0, messagesToDelete).forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Successfully deleted ${messagesToDelete} messages.`);
    }
  } catch (error) {
    console.error('Error removing old messages from Firestore:', error);
  }
};