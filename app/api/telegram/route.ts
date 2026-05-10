import { Telegraf } from "telegraf";
import OpenAI from "openai";

const bot = new Telegraf(process.env.BOT_TOKEN!);

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: "https://api.groq.com/openai/v1",
});

async function askAI(prompt: string) {
  const completion =
    await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",

      messages: [
        {
          role: "system",
          content: `
You are a smart Telegram AI assistant.

Rules:
- Give short useful answers.
- Help with coding.
- Explain uploaded code clearly.
- Be conversational.
`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

  return (
    completion.choices[0].message.content ||
    "No response."
  );
}

function getCurrentTime() {
  return new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
}

function getCurrentDate() {
  return new Date().toLocaleDateString("en-IN");
}

bot.start(async (ctx) => {
  await ctx.reply(
    "🤖 Hi, I am Vishnu's Assistant"
  );
});

bot.on("text", async (ctx) => {
  try {
    const userMessage =
      ctx.message.text.toLowerCase();

    console.log("TEXT:", userMessage);

    // ===== REALTIME TIME =====

    if (
      userMessage.includes("time")
    ) {
      const time = getCurrentTime();

      await ctx.reply(
        `🕒 Current time: ${time}`
      );

      return;
    }

    // ===== REALTIME DATE =====

    if (
      userMessage.includes("date") ||
      userMessage.includes("today")
    ) {
      const date = getCurrentDate();

      await ctx.reply(
        `📅 Today's date: ${date}`
      );

      return;
    }

    // ===== NORMAL AI =====

    const reply = await askAI(userMessage);

    await ctx.reply(reply);
  } catch (error) {
    console.error(error);

    await ctx.reply("Text processing failed.");
  }
});

bot.on("document", async (ctx) => {
  try {
    const file = ctx.message.document;

    const fileId = file.file_id;

    const telegramFile =
      await ctx.telegram.getFile(fileId);

    const filePath =
      telegramFile.file_path;

    const fileUrl =
      `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

    const response =
      await fetch(fileUrl);

    const fileContent =
      await response.text();

    const prompt = `
Explain this code clearly:

${fileContent}
`;

    const aiReply =
      await askAI(prompt);

    await ctx.reply(aiReply);
  } catch (error) {
    console.error(error);

    await ctx.reply(
      "File processing failed."
    );
  }
});

export async function POST(req: Request) {
  try {
    console.log("WEBHOOK HIT");

    const body = await req.json();

    await bot.handleUpdate(body);

    return new Response("OK");
  } catch (error) {
    console.error(error);

    return new Response("ERROR", {
      status: 500,
    });
  }
}