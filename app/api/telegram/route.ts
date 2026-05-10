import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function sendMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

function getIndianTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });
}

async function askGroq(userMessage: string) {
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.7,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: `
You are Bruce, Vishnu's advanced AI Telegram assistant.

Rules:
- Reply naturally and intelligently.
- Keep answers concise unless asked for details.
- Be friendly and modern.
- Answer coding questions clearly.
- Give real examples when useful.
- Never say you are unable to answer simple things.
- Never mention limitations unless necessary.
              `,
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log("GROQ RESPONSE:", JSON.stringify(data, null, 2));

    if (data.error) {
      return `❌ AI Error: ${data.error.message}`;
    }

    return (
      data?.choices?.[0]?.message?.content ||
      "⚠️ Empty AI response."
    );
  } catch (error) {
    console.log("GROQ ERROR:", error);
    return "⚠️ AI temporarily unavailable.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("TELEGRAM UPDATE:", JSON.stringify(body, null, 2));

    const message = body.message;

    if (!message) {
      return NextResponse.json({
        ok: true,
      });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim();

    if (!text) {
      await sendMessage(
        chatId,
        "⚠️ Please send a text message."
      );

      return NextResponse.json({
        ok: true,
      });
    }

    console.log("MESSAGE:", text);

    const lowerText = text.toLowerCase();

    // START COMMAND
    if (lowerText === "/start") {
      await sendMessage(
        chatId,
        `🤖 Advanced AI Bot is online.

Features:
• Smart AI replies
• Real-time India time
• Coding help
• Better performance
• Faster responses

Ask me anything.`
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // TIME COMMAND
    if (
      lowerText.includes("time") ||
      lowerText.includes("date")
    ) {
      const indiaTime = getIndianTime();

      await sendMessage(
        chatId,
        `🕒 Current India Time:\n${indiaTime}`
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // SIMPLE FAST REPLIES
    if (
      lowerText === "hi" ||
      lowerText === "hello" ||
      lowerText === "hey"
    ) {
      const replies = [
        "👋 Hey Vishnu! How are you doing?",
        "🔥 Hello! What are we building today?",
        "🚀 Hey! Ask me anything.",
      ];

      const randomReply =
        replies[Math.floor(Math.random() * replies.length)];

      await sendMessage(chatId, randomReply);

      return NextResponse.json({
        ok: true,
      });
    }

    if (lowerText.includes("how are you")) {
      await sendMessage(
        chatId,
        "😎 I'm running perfectly. Ready to help you."
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // AI RESPONSE
    const aiReply = await askGroq(text);

    await sendMessage(chatId, aiReply);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.log("MAIN ERROR:", error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}
