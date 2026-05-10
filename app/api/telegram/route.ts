import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message = body.message;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    console.log("MESSAGE:", userText);

    // =========================
    // START
    // =========================

    if (userText === "/start") {
      await sendMessage(
        chatId,
        "🤖 Advanced AI Bot Online.\n\nAsk me anything."
      );

      return NextResponse.json({ ok: true });
    }

    // =========================
    // EMPTY TEXT
    // =========================

    if (!userText) {
      await sendMessage(chatId, "⚠️ Send text messages only.");
      return NextResponse.json({ ok: true });
    }

    const lower = userText.toLowerCase();

    // =========================
    // REAL TIME
    // =========================

    if (
      lower.includes("time") ||
      lower.includes("date")
    ) {
      const indiaTime = new Date().toLocaleString(
        "en-IN",
        {
          timeZone: "Asia/Kolkata",
        }
      );

      await sendMessage(
        chatId,
        `🕒 Current India Time:\n${indiaTime}`
      );

      return NextResponse.json({ ok: true });
    }

    // =========================
    // TYPING
    // =========================

    await sendTyping(chatId);

    // =========================
    // AI REQUEST
    // =========================

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
            model: "llama3-70b-8192",

            messages: [
              {
                role: "system",
                content: `
You are Vishnu's smart Telegram AI assistant.

Rules:
- Talk naturally
- Give useful answers
- Help with coding
- Help with education
- Be concise
- Avoid robotic replies
                `,
              },
              {
                role: "user",
                content: userText,
              },
            ],

            temperature: 0.7,
            max_tokens: 500,
          }),
        }
      );

      // =========================
      // RAW RESPONSE
      // =========================

      const rawText = await response.text();

      console.log("RAW GROQ:");
      console.log(rawText);

      // =========================
      // RESPONSE FAIL
      // =========================

      if (!response.ok) {
        await sendMessage(
          chatId,
          "⚠️ AI server error."
        );

        return NextResponse.json({ ok: true });
      }

      // =========================
      // PARSE JSON
      // =========================

      const data = JSON.parse(rawText);

      let aiReply =
        data?.choices?.[0]?.message?.content;

      if (!aiReply) {
        aiReply =
          "⚠️ AI could not generate a response.";
      }

      // Telegram limit safety

      if (aiReply.length > 4000) {
        aiReply = aiReply.substring(0, 4000);
      }

      await sendMessage(chatId, aiReply);

      return NextResponse.json({ ok: true });
    } catch (error) {
      console.log("AI ERROR:");
      console.log(error);

      await sendMessage(
        chatId,
        "⚠️ AI processing failed."
      );

      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    console.log("SERVER ERROR:");
    console.log(error);

    return NextResponse.json({
      ok: false,
    });
  }
}

// =========================
// SEND MESSAGE
// =========================

async function sendMessage(
  chatId: number,
  text: string
) {
  try {
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
  } catch (error) {
    console.log("SEND MESSAGE ERROR");
  }
}

// =========================
// TYPING STATUS
// =========================

async function sendTyping(chatId: number) {
  try {
    await fetch(
      `${TELEGRAM_API}/sendChatAction`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          action: "typing",
        }),
      }
    );
  } catch (error) {
    console.log("Typing failed");
  }
}
