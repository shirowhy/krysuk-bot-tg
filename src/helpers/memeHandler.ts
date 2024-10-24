import sharp from 'sharp';
import { getRandomMessagesFromFirestore } from './firebaseHelper';
import TelegramBot from 'node-telegram-bot-api';
import { memeTemplates } from '../memeTemplates';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { createCanvas, loadImage, registerFont } from 'canvas';

const fontPath = path.resolve(__dirname, '../fonts/impact.ttf');
registerFont(fontPath, { family: 'Impact' });

export const handleMemeCommand = async (msg: TelegramBot.Message, bot: TelegramBot): Promise<void> => {
  try {
    const chatId = msg.chat.id.toString();

    const messages = await getRandomMessagesFromFirestore(chatId, 5);
    const randomMessages = messages.map(msg => (msg as unknown as { text: string }).text);
    const randomLength = Math.floor(Math.random() * 49) + 2;
    let memeText = randomMessages.join(' ').substring(0, randomLength);

    const lastSpaceIndex = memeText.lastIndexOf(' ');
    if (lastSpaceIndex > 0 && memeText.length === randomLength) {
      memeText = memeText.substring(0, lastSpaceIndex);
    }

    const textParts = memeText.split(' ');
    const middleIndex = Math.floor(textParts.length / 2);
    const topText = textParts.slice(0, middleIndex).join(' ');
    const bottomText = textParts.slice(middleIndex).join(' ');

    const randomTemplate = memeTemplates[Math.floor(Math.random() * memeTemplates.length)];

    const response = await axios.get(randomTemplate, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');

    const image = await sharp(imageBuffer).toBuffer();
    const loadedImage = await loadImage(image);

    const canvas = createCanvas(loadedImage.width, loadedImage.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(loadedImage, 0, 0);

    ctx.font = '64px Impact';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 6;
    ctx.textAlign = 'center';

    ctx.textBaseline = 'top';
    ctx.strokeText(topText, canvas.width / 2, 10, canvas.width - 20);
    ctx.fillText(topText, canvas.width / 2, 10, canvas.width - 20);

    ctx.textBaseline = 'bottom';
    ctx.strokeText(bottomText, canvas.width / 2, canvas.height - 10, canvas.width - 20);
    ctx.fillText(bottomText, canvas.width / 2, canvas.height - 10, canvas.width - 20);

    const outputFileName = `${uuidv4()}.jpg`;
    const outputPath = path.resolve('/tmp', outputFileName);
    const outputBuffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(outputPath, outputBuffer);

    await bot.sendPhoto(msg.chat.id, outputBuffer, {
      caption: 'Вот твой мем!',
    });

    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('Failed to generate meme:', error);
    await bot.sendMessage(msg.chat.id, 'Произошла ошибка при генерации мема.');
  }
};
