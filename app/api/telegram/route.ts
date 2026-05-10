import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const chatId = body.message?.chat?.id;
    const text = body.message?.text;

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    if (text === "/start") {
      await sendMessage(
        chatId,
        "🤖 AI Bot Online"
      );

      return NextResponse.json({ ok: true });
    }

    if (!text) {
      await sendMessage(
        chatId,
        "Only text messages supported."
      );

      return NextResponse.json({ ok: true });
    }

    if (
      text.toLowerCase().includes("time")
    ) {
      const currentTime = new Date().toLocaleString(
        "en-IN",
        {
          timeZone: "Asia/Kolkata",
        }
      );

      await sendMessage(
        chatId,
        `Current India Time:\n${currentTime}`
      );

      return NextResponse.json({ ok: true });
    }

    const aiResponse = await fetch(
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
                "You are Vishnu's AI assistant.",
            },
            {
              role: "user",
              content: text,
            },
          ],
        }),
      }
    );

    const data = await aiResponse.json();

    let reply =
      data?.choices?.[0]?.message?.content ||
      "AI failed.";

    await sendMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log(error);

    return NextResponse.json({
      ok: false,
    });
  }
}

async function sendMessage(
  chatId: number,
  text: string
) {
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
