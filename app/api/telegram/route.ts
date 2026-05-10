import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function POST(req: Request) {
  try {
    console.log("=== TELEGRAM WEBHOOK HIT ===");

    const body = await req.json();

    const message = body?.message;

    if (!message) {
      console.log("No message received");
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat?.id;
    const text = message.text?.trim();

    if (!chatId) {
      console.log("No chat ID");
      return NextResponse.json({ ok: true });
    }

    console.log("USER MESSAGE:", text);

    // =========================
    // START COMMAND
    // =========================
    if (text === "/start") {
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
    // HELP COMMAND
    // =========================
    if (text === "/help") {
      await sendMessage(
        chatId,
        `📌 Commands:

/start - Start bot
/help - Show commands

Examples:
• what is the time
• explain java
• who is elon musk
• write python code`
      );

      return NextResponse.json({ ok: true });
    }

    // =========================
    // NON TEXT HANDLING
    // =========================
    if (!text) {
      await sendMessage(
        chatId,
        "⚠️ Currently I support only text messages."
      );

      return NextResponse.json({ ok: true });
    }

    const lowerText = text.toLowerCase();

    // =========================
    // REAL TIME
    // =========================
    if (
      lowerText.includes("time") ||
      lowerText.includes("date")
    ) {
      const currentTime = new Date().toLocaleString(
        "en-IN",
        {
          timeZone: "Asia/Kolkata",
        }
      );

      await sendMessage(
        chatId,
        `🕒 Current India Time:\n${currentTime}`
      );

      return NextResponse.json({ ok: true });
    }

    // =========================
    // TYPING INDICATOR
    // =========================
    await sendTyping(chatId);

    // =========================
    // GROQ AI REQUEST
    // =========================
    try {
      const aiResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 700,
            top_p: 1,
            stream: false,
            messages: [
              {
                role: "system",
                content: `
You are Vishnu's advanced AI Telegram assistant.

Rules:
- Reply naturally and intelligently
- Be concise unless detailed answer needed
- Help with coding, tech, education, productivity, and general knowledge
- Give direct answers
- Avoid useless disclaimers
- Format code properly
`,
              },
              {
                role: "user",
                content: text,
              },
            ],
          }),
        }
      );

      // =========================
      // HANDLE BAD RESPONSE
      // =========================
      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();

        console.log("GROQ API ERROR:");
        console.log(errorText);

        await sendMessage(
          chatId,
          "⚠️ AI service temporarily unavailable."
        );

        return NextResponse.json({ ok: true });
      }

      const data = await aiResponse.json();

      console.log("GROQ SUCCESS");

      let reply =
        data?.choices?.[0]?.message?.content;

      if (!reply) {
        reply = "⚠️ AI could not generate a response.";
      }

      // Telegram max message safety
      if (reply.length > 4000) {
        reply = reply.substring(0, 4000);
      }

      await sendMessage(chatId, reply);

      return NextResponse.json({ ok: true });
    } catch (aiError: any) {
      console.log("AI PROCESSING ERROR:");
      console.log(aiError);

      await sendMessage(
        chatId,
        "⚠️ AI processing failed."
      );

      return NextResponse.json({ ok: true });
    }
  } catch (error: any) {
    console.log("SERVER ERROR:");
    console.log(error);

    return NextResponse.json({
      ok: false,
      error: error?.message || "Unknown error",
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
    const response = await fetch(
      `${TELEGRAM_API}/sendMessage`,
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

    const data = await response.json();

    console.log("TELEGRAM MESSAGE SENT");

    return data;
  } catch (error) {
    console.log("SEND MESSAGE ERROR:");
    console.log(error);
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
    console.log("Typing indicator failed");
  }
}
