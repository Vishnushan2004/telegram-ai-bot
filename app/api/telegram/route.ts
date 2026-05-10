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
    // START COMMAND
    // =========================

    if (userText === "/start") {
      await sendMessage(
        chatId,
        `🤖 Advanced AI Bot is online.

Features:
• Smart AI replies
• Real-time India time
• Better stability
• Faster responses

Ask me anything.`
      );

      return NextResponse.json({ ok: true });
    }

    // =========================
    // EMPTY MESSAGE
    // =========================

    if (!userText) {
      await sendMessage(
        chatId,
        "⚠️ Please send a text message."
      );

      return NextResponse.json({ ok: true });
    }

    const lower = userText.toLowerCase();

    // =========================
    // REAL TIME FEATURE
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
    // TYPING STATUS
    // =========================

    await sendTyping(chatId);

    // =========================
    // SIMPLE LOCAL RESPONSES
    // =========================

    if (
      lower === "hi" ||
      lower === "hello" ||
      lower === "hey"
    ) {
      await sendMessage(
        chatId,
        "👋 Hey Vishnu! How are you doing?"
      );

      return NextResponse.json({ ok: true });
    }

    if (lower.includes("how are you")) {
      await sendMessage(
        chatId,
        "😄 I'm doing great. Ready to help you."
      );

      return NextResponse.json({ ok: true });
    }

    // =========================
    // AI RESPONSE
    // =========================

    try {
      console.log("Using GROQ API KEY:");
      console.log(
        GROQ_API_KEY
          ? "KEY FOUND"
          : "KEY MISSING"
      );

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            model: "llama3-8b-8192",

            messages: [
              {
                role: "system",
                content: `
You are Vishnu's advanced AI Telegram assistant.

Rules:
- Reply naturally
- Be intelligent
- Help with coding
- Help with education
- Be concise
- Avoid robotic answers
- Give practical answers
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
      // DEBUG RAW RESPONSE
      // =========================

      const rawText = await response.text();

      console.log("STATUS:", response.status);
      console.log("RAW RESPONSE:");
      console.log(rawText);

      // =========================
      // API ERROR
      // =========================

      if (!response.ok) {
        await sendMessage(
          chatId,
          `❌ AI Error ${response.status}`
        );

        return NextResponse.json({ ok: true });
      }

      // =========================
      // JSON PARSE
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
      console.log("FULL AI ERROR:");
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
