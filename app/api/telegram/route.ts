import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN");
}

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY");
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const SYSTEM_PROMPT = `
You are Vishnu's advanced Telegram AI assistant.

Rules:
- Be smart and concise
- Help with coding
- Give practical answers
- Avoid robotic responses
- Use clean formatting
- Keep replies readable
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("Incoming Update:", JSON.stringify(body));

    const message = body?.message;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message?.chat?.id;

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    const userText =
      typeof message.text === "string"
        ? message.text.trim()
        : "";

    // Non-text messages
    if (!userText) {
      await sendMessage(
        chatId,
        "⚠️ Please send a text message."
      );

      return NextResponse.json({ ok: true });
    }

    const lower = userText.toLowerCase();

    console.log("User:", userText);

    // =========================
    // START COMMAND
    // =========================

    if (lower === "/start") {
      await sendMessage(
        chatId,
        `
🤖 *Advanced AI Bot Online*

✨ Features:
• AI Chat
• Coding Help
• Fast Replies
• India Time
• Smart Responses

Send me anything.
        `
      );

      return NextResponse.json({ ok: true });
    }

    // =========================
    // TIME FEATURE
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
        `🕒 *India Time*\n\n${indiaTime}`
      );

      return NextResponse.json({ ok: true });
    }

    // =========================
    // SIMPLE LOCAL RESPONSES
    // =========================

    if (["hi", "hello", "hey"].includes(lower)) {
      await sendMessage(
        chatId,
        "👋 Hey Vishnu!"
      );

      return NextResponse.json({ ok: true });
    }

    // typing status

    await sendTyping(chatId);

    // =========================
    // AI REQUEST
    // =========================

    const aiReply = await getAIResponse(userText);

    await sendMessage(chatId, aiReply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SERVER ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================
// AI RESPONSE
// =========================

async function getAIResponse(userText: string) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 30000);

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        signal: controller.signal,

        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: "llama3-8b-8192",

          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
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

    clearTimeout(timeout);

    const raw = await response.text();

    console.log("Groq Status:", response.status);
    console.log("Groq Raw:", raw);

    if (!response.ok) {
      return `⚠️ AI Error (${response.status})`;
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return "⚠️ AI returned invalid response.";
    }

    let reply =
      data?.choices?.[0]?.message?.content;

    if (!reply || typeof reply !== "string") {
      return "⚠️ Empty AI response.";
    }

    reply = escapeMarkdown(reply);

    if (reply.length > 4000) {
      reply = reply.slice(0, 4000);
    }

    return reply;
  } catch (error: any) {
    console.error("AI ERROR:", error);

    if (error.name === "AbortError") {
      return "⚠️ AI request timed out.";
    }

    return "⚠️ Failed to process AI request.";
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

          parse_mode: "Markdown",

          disable_web_page_preview: true,

          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⚡ AI Bot",
                  callback_data: "ai",
                },
              ],
            ],
          },
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram Error:", data);
    }
  } catch (error) {
    console.error("SEND MESSAGE ERROR:", error);
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
    console.error("Typing Error:", error);
  }
}

// =========================
// MARKDOWN ESCAPE
// =========================

function escapeMarkdown(text: string) {
  return text.replace(
    /[_*[\]()~`>#+\-=|{}.!]/g,
    "\\$&"
  );
}
