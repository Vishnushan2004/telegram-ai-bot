import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("WEBHOOK RECEIVED");

    const chatId = body.message?.chat?.id;
    const text = body.message?.text;

    if (!chatId) {
      console.log("No chat ID");
      return NextResponse.json({ ok: true });
    }

    // START COMMAND
    if (text === "/start") {
      await sendMessage(
        chatId,
        "🤖 Advanced AI Bot is online.\n\nAsk me anything."
      );

      return NextResponse.json({ ok: true });
    }

    // NO TEXT MESSAGE
    if (!text) {
      await sendMessage(
        chatId,
        "⚠️ Only text messages are supported right now."
      );

      return NextResponse.json({ ok: true });
    }

    console.log("USER MESSAGE:", text);

    // REAL TIME COMMAND
    if (
      text.toLowerCase().includes("time") ||
      text.toLowerCase().includes("date")
    ) {
      const currentTime = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });

      await sendMessage(
        chatId,
        `🕒 Current India Time:\n${currentTime}`
      );

      return NextResponse.json({ ok: true });
    }

    // AI REQUEST
    try {
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
            temperature: 0.7,
            max_tokens: 500,
            messages: [
              {
                role: "system",
                content:
                  "You are Vishnu's powerful Telegram AI assistant. Reply naturally, intelligently, and briefly unless detailed explanation is needed.",
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

      console.log("GROQ RESPONSE:");
      console.log(JSON.stringify(data, null, 2));

      let reply = "⚠️ AI could not generate response.";

      if (
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content
      ) {
        reply = data.choices[0].message.content;
      }

      await sendMessage(chatId, reply);
    } catch (aiError) {
      console.log("AI ERROR:");
      console.log(aiError);

      await sendMessage(
        chatId,
        "⚠️ AI temporarily unavailable."
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("SERVER ERROR:");
    console.log(error);

    return NextResponse.json({
      ok: false,
      error: "Server crashed",
    });
  }
}

// SEND TELEGRAM MESSAGE
async function sendMessage(chatId: number, text: string) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
        }),
      }
    );

    const data = await response.json();

    console.log("TELEGRAM RESPONSE:");
    console.log(data);
  } catch (error) {
    console.log("SEND MESSAGE ERROR:");
    console.log(error);
  }
}
