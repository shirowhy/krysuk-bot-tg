import TelegramBot from 'node-telegram-bot-api';
import { db } from '../firebase';
import { DateTime } from 'luxon';

export const fandomMapping: Record<string, string> = {
  'генш': 'gensh',
  'титосы': 'AOT',
  'ззз': 'zzz'
};

export const handleIdentityCommand = async (msg: TelegramBot.Message, bot: TelegramBot): Promise<void> => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id.toString();
  const initiatorName = msg.from?.first_name;

  if (!chatId || !userId || !initiatorName) {
    console.warn('Chat ID, User ID, or Initiator Name is undefined, skipping identity response.');
    return;
  }

  const nowInMoscow = DateTime.now().setZone('Europe/Moscow');
  const todayDate = nowInMoscow.toISODate();

  const messageText = msg.text?.trim().toLowerCase();
  const commandParts = messageText?.split(' ');
  const command = commandParts?.[2]; // 'кто я' or 'кто все'

  if (command === 'все') {
    await handleShowAllIdentities(msg, bot, chatId);
    return;
  }

  const fandom = commandParts?.[3]; // 'генш' or 'титосы' or 'ззз'

  if (!fandom || !(fandom in fandomMapping)) {
    await bot.sendMessage(chatId, 'Это чё? Такого фэндома нет. Попробуй "Глитч кто я генш", "Глитч кто я титосы" или "Глитч кто я ззз"');
    return;
  }

  const collectionName = `${fandomMapping[fandom]}_identity_logs_${chatId}`;
  const userDocRef = db.collection(collectionName).doc(userId);
  const userDoc = await userDocRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data();
    const lastGeneratedDate = userData?.[`${collectionName}_lastGeneratedDate`];
    const lastResponse = userData?.[`${collectionName}_lastResponse`];

    if (lastGeneratedDate === todayDate) {
      await bot.sendMessage(chatId, lastResponse);
      return;
    }
  }

  const adjectivesDoc = await db.collection(`phrase_lists_${fandomMapping[fandom]}`).doc('adjectives').get();
  const subjectsDoc = await db.collection(`phrase_lists_${fandomMapping[fandom]}`).doc('subjects').get();
  const actionsDoc = await db.collection(`phrase_lists_${fandomMapping[fandom]}`).doc('actions').get();

  if (!adjectivesDoc.exists || !subjectsDoc.exists || !actionsDoc.exists) {
    console.error('One or more documents are missing from Firestore.');
    await bot.sendMessage(chatId, 'ЖЕСТЬ. Что-то пошло не так. Попробуй еще раз позже');
    return;
  }

  const adjectives = adjectivesDoc.data()?.data?.adjectives || [];
  const subjects = subjectsDoc.data()?.data?.subjects || [];
  const actions = actionsDoc.data()?.data?.actions || [];

  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];

  const gender = randomSubject.gender === 'female' ? 'female' : 'male';

  const randomAction = actions[Math.floor(Math.random() * actions.length)];
  const actionText = gender === 'female'
    ? randomAction['action-name-female']
    : randomAction['action-name-male'];

  const response = `${initiatorName}, ты — ${randomAdjective[`adjective-name-${gender}`]} ${randomSubject.name} ${actionText}`;

  await userDocRef.set({
    [`${collectionName}_lastGeneratedDate`]: todayDate,
    [`${collectionName}_lastResponse`]: response,
  });

  await bot.sendMessage(chatId, response);
};

const handleShowAllIdentities = async (msg: TelegramBot.Message, bot: TelegramBot, chatId: string): Promise<void> => {
  const nowInMoscow = DateTime.now().setZone('Europe/Moscow');
  const todayDate = nowInMoscow.toISODate();

  let response = '';

  for (const [fandomKey, collectionName] of Object.entries(fandomMapping)) {
    const logsSnapshot = await db.collection(`${collectionName}_identity_logs_${chatId}`)
      .where(`${collectionName}_lastGeneratedDate`, '==', todayDate)
      .get();

    if (!logsSnapshot.empty) {
      response += `${fandomKey.toUpperCase()}:\n`;
      logsSnapshot.forEach(doc => {
        const userData = doc.data();
        const lastResponse = userData[`${collectionName}_lastResponse`];
        const formattedResponse = lastResponse.replace(/, ты — /, ' — ');
        response += `${formattedResponse}\n`;
      });
      response += '\n';
    }
  }

  if (!response.trim()) {
    response = 'Сегодня ни один фэндом еще не был вызван.';
  }

  await bot.sendMessage(chatId, response.trim());
};