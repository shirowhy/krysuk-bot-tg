import TelegramBot from 'node-telegram-bot-api';
import { db } from '../firebase';
import { DateTime } from 'luxon';

interface Partner {
    name: string;
}

export const handlePartnerCommand = async (msg: TelegramBot.Message, bot: TelegramBot, commandText: string): Promise<void> => {
    const chatId = msg.chat.id.toString();
    const userId = msg.from?.id?.toString();
    const initiatorName = msg.from?.first_name;

    if (!chatId || !userId || !initiatorName) {
        console.warn('Chat ID, User ID, or Initiator Name is undefined, skipping response.');
        return;
    }

    if (commandText.startsWith('глитч все пары')) {
        await handleShowAllPairs(bot, chatId);
        return;
    }

    if (commandText.startsWith('глитч мой гача муж')) {
        await assignPartner(bot, initiatorName, `husbands`, `assigned_husbands_${chatId}`, 'твой муж', userId);
        return;
    }

    if (commandText.startsWith('глитч моя гача жена')) {
        await assignPartner(bot, initiatorName, `wives`, `assigned_wives_${chatId}`, 'твоя жена', userId);
        return;
    }
};

const assignPartner = async (
    bot: TelegramBot, 
    initiatorName: string, 
    partnerCollection: string, 
    assignedCollection: string, 
    responseText: string, 
    userId: string
): Promise<void> => {
    const nowInMoscow = DateTime.now().setZone('Europe/Moscow');
    const todayDate = nowInMoscow.toISODate();

    const assignedDoc = await db.collection(assignedCollection).doc(userId).get();
    if (assignedDoc.exists) {
        const assignedData = assignedDoc.data();
        const lastAssignedDate = assignedData?.dateAssigned;

        if (lastAssignedDate === todayDate) {
            const response = `${initiatorName}, ${responseText} — ${assignedData?.name}`;
            await bot.sendMessage(userId, response);
            return;
        }
    }

    const partnersDoc = await db.collection(partnerCollection).doc('names').get();
    if (!partnersDoc.exists) {
        console.error(`${partnerCollection} document is missing in Firestore.`);
        await bot.sendMessage(userId, 'Ой, что-то пошло не так. Попробуй позже!');
        return;
    }

    const partnersData = partnersDoc.data();
    const partners = (partnersData?.data?.names || []) as Partner[];

    if (partners.length === 0 || !partners.every(p => p.name)) {
        console.error(`Invalid data format: Expected array of objects with a "name" field in ${partnerCollection}.`);
        await bot.sendMessage(userId, 'Ой, данные повреждены. Попробуй позже!');
        return;
    }

    const randomPartner = partners[Math.floor(Math.random() * partners.length)].name;

    await db.collection(assignedCollection).doc(userId).set({
        name: randomPartner,
        userName: initiatorName,
        dateAssigned: todayDate,
    });

    const response = `${initiatorName}, ${responseText} — ${randomPartner}`;
    await bot.sendMessage(userId, response);
};

const handleShowAllPairs = async (bot: TelegramBot, chatId: string): Promise<void> => {
    const nowInMoscow = DateTime.now().setZone('Europe/Moscow');
    const todayDate = nowInMoscow.toISODate();

    // Fetch all assigned husbands for this chat
    const husbandsSnapshot = await db.collection(`assigned_husbands_${chatId}`)
        .where('dateAssigned', '==', todayDate)
        .get();

    // Fetch all assigned wives for this chat
    const wivesSnapshot = await db.collection(`assigned_wives_${chatId}`)
        .where('dateAssigned', '==', todayDate)
        .get();

    if (husbandsSnapshot.empty && wivesSnapshot.empty) {
        await bot.sendMessage(chatId, 'Сегодня ещё нет назначенных пар.');
        return;
    }

    let response = 'СЕГОДНЯШНИЕ ПАРЫ\n\n';

    // Handle husbands section
    if (!husbandsSnapshot.empty) {
        response += 'Мужья:\n';
        husbandsSnapshot.forEach(doc => {
            const husbandData = doc.data();
            response += `${husbandData.name} / ${husbandData.userName}\n`;
        });
        response += '\n';
    }

    // Handle wives section
    if (!wivesSnapshot.empty) {
        response += 'Жены:\n';
        wivesSnapshot.forEach(doc => {
            const wifeData = doc.data();
            response += `${wifeData.userName} / ${wifeData.name}\n`;
        });
    }

    await bot.sendMessage(chatId, response.trim());
};