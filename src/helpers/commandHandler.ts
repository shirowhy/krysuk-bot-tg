import TelegramBot from 'node-telegram-bot-api';
import { commands, Command } from '../commands';
import { commandImages } from '../commandImages';
import axios from 'axios';
import { getMessagesCountFromFirestore, getResponseChance, saveResponseChance } from './firebaseHelper';

const commandCases: Record<Command, 'именительный' | 'винительный' | 'дательный' | 'родительный'> = {
  'погладить': 'винительный',
  'потрогать траву': 'именительный',
  'обнять': 'винительный',
  'поцеловать': 'винительный',
  'засосать': 'винительный',
  'укусить': 'винительный',
  'лизнуть': 'винительный',
  'херак': 'винительный',
  'отмудохать': 'винительный',
  'пятюня': 'дательный',
  'пожать руку': 'дательный',
  'закопать': 'винительный',
  'жамк': 'родительный',
  'жамк-жамк': 'винительный',
  'съесть': 'винительный',
  'откусить': 'дательный',
  'аминь': 'дательный',
  'обезвредить': 'винительный',
  'очистить': 'родительный',
  'шишка': 'именительный',
  'проверить шанс': 'именительный',
  'установить шанс': 'винительный',
  'глитч, че по интеллекту': 'именительный',
};

const formatNameForCase = (name: string, caseType: 'именительный' | 'винительный' | 'дательный' | 'родительный'): string => {
  switch (caseType) {
    case 'винительный':
      return formatNameForAccusativeCase(name);
    case 'дательный':
      return formatNameForDativeCase(name);
    case 'родительный':
      return formatNameForGenitiveCase(name);
    default:
      return name;
  }
};

const formatNameForAccusativeCase = (name: string): string => {
  const lastChar = name.slice(-1);
  let formattedName = name;

  switch (lastChar) {
    case 'а':
      formattedName = name.slice(0, -1) + 'у';
      break;
    case 'я':
      formattedName = name.slice(0, -1) + 'ю';
      break;
    default:
      formattedName = name;
  }
  return formattedName;
};

const formatNameForDativeCase = (name: string): string => {
  const lastChar = name.slice(-1);
  let formattedName = name;

  switch (lastChar) {
    case 'а':
    case 'я':
      formattedName = name.slice(0, -1) + 'е';
      break;
  }
  return formattedName;
};

const formatNameForGenitiveCase = (name: string): string => {
  const lastChar = name.slice(-1);
  let formattedName = name;

  switch (lastChar) {
    case 'а':
      formattedName = name.slice(0, -1) + 'ы';
      break;
    case 'я':
      formattedName = name.slice(0, -1) + 'и';
      break;
  }
  return formattedName;
};

export const handleCommand = async (
  msg: TelegramBot.Message, 
  bot: TelegramBot, 
  command: Command, 
  targetUser: string
): Promise<void> => {
  const chatId = msg.chat.id.toString();
  const initiatorName = msg.from?.first_name || 'Кто-то';

  if (!chatId) {
    console.warn('Chat ID is undefined, skipping command handling.');
    return;
  }

  if (command === 'глитч, че по интеллекту') {
    const messageCount = await getMessagesCountFromFirestore(chatId);
    await bot.sendMessage(chatId, `Я сохранил аж ${messageCount} сообщений из чата! Я крут? Определённо.`);
    return;
  }

  if (command === 'проверить шанс') {
    const responseChance = await getResponseChance(chatId);
    await bot.sendMessage(chatId, `Текущий шанс ответа бота: ${responseChance}%`);
    return;
  }

  if (command === 'установить шанс') {
    const chanceValue = parseInt(targetUser, 10);
    if (isNaN(chanceValue) || chanceValue < 0 || chanceValue > 100) {
      await bot.sendMessage(chatId, `Пожалуйста, укажите корректное значение шанса от 0 до 100.`);
      return;
    }
    await saveResponseChance(chatId, chanceValue);
    await bot.sendMessage(chatId, `Шанс ответа бота установлен на: ${chanceValue}%`);
    return;
  }

  if (command === 'шишка') {
    await bot.sendMessage(chatId, 'шишка');
    return;
  }

  let formattedTargetUser = targetUser.trim();
  if (msg.reply_to_message) {
    const replyUser = msg.reply_to_message.from?.first_name;
    if (replyUser) {
      const caseType = commandCases[command];
      formattedTargetUser = formatNameForCase(replyUser, caseType);
    }
  } else {
    const caseType = commandCases[command];
    formattedTargetUser = formatNameForCase(targetUser, caseType);
  }

  const responseMessage = `${initiatorName} ${commands[command]} ${formattedTargetUser}`;
  const images = commandImages[command];

  if (images && images.length > 0) {
    const randomImageUrl = images[Math.floor(Math.random() * images.length)];

    try {
      const imageBuffer = (await axios.get(randomImageUrl, { responseType: 'arraybuffer' })).data;

      await bot.sendPhoto(chatId, imageBuffer, {
        caption: responseMessage
      });
    } catch (error) {
      console.error('Failed to upload image:', error);
      await bot.sendMessage(chatId, responseMessage);
    }
  } else {
    await bot.sendMessage(chatId, responseMessage);
  }
};