import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ========================================
// SIMPLE MEMORY STORE
// Replace with Redis/Database in production
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
      return NextResponse.json({ ok: true });
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
        "⚠️ Please send text messages only."
      );

      return NextResponse.json({ ok: true });
    }

    // ========================================
    // START COMMAND
    // ========================================

    if (userText === "/start") {
      conversations.set(chatId, []);

      await sendMessage(
        chatId,
        `🤖 Advanced AI Assistant Online

Capabilities:
• Coding
• Debugging
• Research
• Writing
• Education
• AI Conversations
• Problem Solving

Just start chatting.`
      );

      return NextResponse.json({ ok: true });
    }

    // ========================================
    // RESET MEMORY
    // ========================================

    if (userText === "/reset") {
      conversations.delete(chatId);

      await sendMessage(
        chatId,
        "🧠 Conversation memory cleared."
      );

      return NextResponse.json({ ok: true });
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

      return NextResponse.json({ ok: true });
    }

    // ========================================
    // TYPING LOOP
    // ========================================

    const typingInterval = setInterval(() => {
      sendTyping(chatId);
    }, 4000);

    try {
      // ========================================
      // MEMORY
      // ========================================

      let history = conversations.get(chatId) || [];

      // limit memory
      history = history.slice(-12);

      // add user message
      history.push({
        role: "user",
        content: userText,
      });

      // ========================================
      // AI REQUEST
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

            temperature: 0.9,
            max_tokens: 1200,
            top_p: 1,

            messages: [
              {
                role: "system",
                content: `
You are an advanced AI assistant inside Telegram.

Your personality:
- intelligent
- natural
- confident
- highly helpful
- conversational
- concise when needed
- detailed when useful

Rules:
- Never sound robotic
- Explain code clearly
- Think step by step
- Give practical answers
- Use formatting
- Adapt to the user's tone
- Remember previous context
- If coding, provide complete working code
- Avoid repeating yourself
- Be engaging and smart
                `,
              },

              ...history,
            ],
          }),
        }
      );

      clearInterval(typingInterval);

      // ========================================
      // RESPONSE ERROR
      // ========================================

      if (!response.ok) {
        console.log(await response.text());

        await sendMessage(
          chatId,
          "⚠️ AI server failed."
        );

        return NextResponse.json({ ok: true });
      }

      // ========================================
      // JSON
      // ========================================

      const data = await response.json();

      let aiReply =
        data?.choices?.[0]?.message?.content;

      if (!aiReply) {
        aiReply =
          "⚠️ Failed to generate response.";
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

      if (aiReply.length > 4000) {
        const chunks = splitMessage(aiReply);

        for (const chunk of chunks) {
          await sendMessage(chatId, chunk);
        }
      } else {
        await sendMessage(chatId, aiReply);
      }

      return NextResponse.json({ ok: true });
    } catch (error) {
      clearInterval(typingInterval);

      console.log("AI ERROR:", error);

      await sendMessage(
        chatId,
        "⚠️ AI processing failed."
      );

      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    console.log("SERVER ERROR:", error);

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
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.log("SEND MESSAGE ERROR:", error);
  }
}

// ========================================
// TYPING
// ========================================

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

// ========================================
// SPLIT LONG MESSAGE
// ========================================

function splitMessage(text: string) {
  const chunks = [];

  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.slice(i, i + 4000));
  }

  return chunks;
}
