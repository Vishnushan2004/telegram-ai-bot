import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN");
}

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY");
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ========================================
// MEMORY
// ========================================

const conversations = new Map<
  number,
  { role: string; content: string }[]
>();

// ========================================
// MAIN
// ========================================

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message = body.message;

    if (!message) {
      return NextResponse.json({
        ok: true,
      });
    }

    const chatId = message.chat.id;
    const userText = message.text?.trim();

    console.log("MESSAGE:", userText);

    // ========================================
    // ONLY TEXT
    // ========================================

    if (!userText) {
      await sendMessage(
        chatId,
        "⚠️ Please send text only."
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // ========================================
    // START
    // ========================================

    if (userText === "/start") {
      conversations.set(chatId, []);

      await sendMessage(
        chatId,
        `🤖 Advanced AI Bot Online

Commands:
/start
/reset

Ask me anything.`
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // ========================================
    // RESET
    // ========================================

    if (userText === "/reset") {
      conversations.delete(chatId);

      await sendMessage(
        chatId,
        "🧠 Memory cleared."
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // ========================================
    // TIME
    // ========================================

    const lower = userText.toLowerCase();

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
        `🕒 India Time:\n${indiaTime}`
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // ========================================
    // TYPING
    // ========================================

    const typing = setInterval(() => {
      sendTyping(chatId);
    }, 3000);

    try {
      // ========================================
      // MEMORY
      // ========================================

      let history =
        conversations.get(chatId) || [];

      history = history.slice(-10);

      history.push({
        role: "user",
        content: userText,
      });

      // ========================================
      // GROQ REQUEST
      // ========================================

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",

            messages: [
              {
                role: "system",
                content: `
You are an advanced AI assistant.

Rules:
- Natural replies
- Smart answers
- Helpful
- Good at coding
- Good at reasoning
- Keep answers clean
- Avoid robotic responses
                `,
              },

              ...history,
            ],

            temperature: 0.8,
            max_tokens: 800,
          }),
        }
      );

      clearInterval(typing);

      // ========================================
      // RAW RESPONSE
      // ========================================

      const raw = await response.text();

      console.log("RAW RESPONSE:");
      console.log(raw);

      // ========================================
      // FAILED REQUEST
      // ========================================

      if (!response.ok) {
        await sendMessage(
          chatId,
          "⚠️ AI server error."
        );

        return NextResponse.json({
          ok: true,
        });
      }

      // ========================================
      // SAFE JSON PARSE
      // ========================================

      let data;

      try {
        data = JSON.parse(raw);
      } catch (err) {
        console.log("JSON PARSE ERROR:", err);

        await sendMessage(
          chatId,
          "⚠️ Failed to parse AI response."
        );

        return NextResponse.json({
          ok: true,
        });
      }

      // ========================================
      // AI REPLY
      // ========================================

      let aiReply =
        data?.choices?.[0]?.message?.content;

      if (!aiReply) {
        aiReply =
          "⚠️ Empty response from AI.";
      }

      // ========================================
      // SAVE MEMORY
      // ========================================

      history.push({
        role: "assistant",
        content: aiReply,
      });

      conversations.set(chatId, history);

      // ========================================
      // TELEGRAM LIMIT
      // ========================================

      const chunks = splitMessage(aiReply);

      for (const chunk of chunks) {
        await sendMessage(chatId, chunk);
      }

      return NextResponse.json({
        ok: true,
      });
    } catch (error) {
      clearInterval(typing);

      console.log("AI ERROR:");
      console.log(error);

      await sendMessage(
        chatId,
        "⚠️ AI processing failed."
      );

      return NextResponse.json({
        ok: true,
      });
    }
  } catch (error) {
    console.log("SERVER ERROR:");
    console.log(error);

    return NextResponse.json({
      ok: false,
    });
  }
}

// ========================================
// SEND MESSAGE
// ========================================

async function sendMessage(
  chatId: number,
  text: string
) {
  try {
    await fetch(
      `${TELEGRAM_API}/sendMessage`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          disable_web_page_preview: true,
        }),
      }
    );
  } catch (error) {
    console.log(
      "SEND MESSAGE ERROR:"
    );

    console.log(error);
  }
}

// ========================================
// TYPING
// ========================================

async function sendTyping(
  chatId: number
) {
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

// ========================================
// SPLIT LONG MESSAGE
// ========================================

function splitMessage(text: string) {
  const chunks = [];

  for (
    let i = 0;
    i < text.length;
    i += 4000
  ) {
    chunks.push(
      text.substring(i, i + 4000)
    );
  }

  return chunks;
}
