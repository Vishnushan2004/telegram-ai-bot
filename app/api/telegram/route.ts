import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("Webhook received");

    const chatId = body.message?.chat?.id;
    const text = body.message?.text;

    if (!chatId || !text) {
      return NextResponse.json({ ok: true });
    }

    console.log("User:", text);

    // START COMMAND
    if (text === "/start") {
      await sendMessage(
        chatId,
        "🤖 Hi, I am Vishnu's Assistance, How can I Assistance today."
      );

      return NextResponse.json({ ok: true });
    }

    // TIME COMMAND
    if (text.toLowerCase().includes("time")) {
      const currentTime = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });

      await sendMessage(
        chatId,
        `🕒 Current India Time:\n${currentTime}`
      );

      return NextResponse.json({ ok: true });
    }

    // GROQ AI REQUEST
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              role: "system",
              content:
                "You are Vishnu's advanced Telegram AI assistant.",
            },
            {
              role: "user",
              content: text,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log("Groq Response:", data);

    const reply =
      data?.choices?.[0]?.message?.content ||
      "AI failed to respond.";

    await sendMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("FULL ERROR:", error);

    return NextResponse.json({
      ok: false,
    });
  }
}

async function sendMessage(chatId: number, text: string) {
  await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }
  );
}
