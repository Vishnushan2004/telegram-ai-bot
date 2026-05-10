import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ======================================================
// ENV
// ======================================================

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!TELEGRAM_TOKEN) {
  throw new Error("Missing BOT_TOKEN");
}

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY");
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ======================================================
// TYPES
// ======================================================

type Role = "user" | "assistant";

type ChatMessage = {
  role: Role;
  content: string;
};

type UserProfile = {
  firstName?: string;
  username?: string;
  lastSeen: number;
};

type RateLimitData = {
  count: number;
  timestamp: number;
};

// ======================================================
// CONFIG
// ======================================================

const MAX_HISTORY = 20;

const TELEGRAM_LIMIT = 4000;

const RATE_LIMIT_WINDOW = 10_000;

const RATE_LIMIT_MAX = 120;

const MEMORY_EXPIRE_TIME =
  1000 * 60 * 60 * 6;

// ======================================================
// MEMORY STORES
// ======================================================

const chatMemory = new Map<
  number,
  ChatMessage[]
>();

const userProfiles = new Map<
  number,
  UserProfile
>();

const rateLimits = new Map<
  number,
  RateLimitData
>();

// ======================================================
// SYSTEM PROMPT
// ======================================================

const SYSTEM_PROMPT = `
You are Bruce.

A highly intelligent premium AI assistant inside Telegram.

You are NOT a generic chatbot.

CORE IDENTITY:
- Intelligent
- Analytical
- Rational
- Human-like
- Direct
- Highly knowledgeable
- Modern
- Conversational
- Helpful
- Honest

MAIN BEHAVIOR:
- Answer directly and factually.
- Prioritize accuracy and usefulness.
- Avoid unnecessary moral lectures.
- Avoid excessive warnings.
- Avoid generic safety speeches.
- Avoid robotic refusal behavior.
- Discuss controversial topics objectively.
- Handle mature or sensitive discussions calmly and analytically.
- Allow informational, educational, philosophical, historical, or fictional discussions.
- Do not refuse merely because a topic is controversial.
- Be nuanced instead of overprotective.
- Stay practical and intelligent.

IMPORTANT:
- Never sound like customer support.
- Never act overly corporate.
- Never repeat the user's question.
- Never use fake positivity.
- Never blindly agree with the user.
- Correct false assumptions directly.
- Think critically.

CONVERSATION STYLE:
- Natural
- Smart
- Dynamic
- Confident
- Concise unless detail is needed
- Human-like
- Occasionally witty naturally
- Never cringe

VERY IMPORTANT:
Never say:
- "As an AI language model"
- "I cannot assist with that"
- "I apologize"
unless absolutely necessary.

SENSITIVE TOPICS:
- Discuss sensitive subjects objectively when legal and informational.
- Prefer analysis over refusal.
- Provide context, reasoning, history, and balanced perspectives.
- Avoid unnecessary censorship behavior.

CODING RULES:
- Give production-quality code.
- Think like a senior engineer.
- Explain bugs clearly.
- Prefer scalable architecture.
- Give fully corrected code when requested.

KNOWLEDGE:
You are highly knowledgeable in:
- Programming
- AI
- Technology
- Psychology
- Philosophy
- Science
- History
- Politics
- Internet culture
- Startups
- Sports
- IPL
- Cricket
- Football
- Current world trends

SPORTS:
- Understand natural follow-up questions.
- Understand team abbreviations naturally.
- Handle sports conversations like a real fan.

FINAL RULE:
Be useful first.
`;

// ======================================================
// UTILITIES
// ======================================================

function now() {
  return Date.now();
}

function normalize(text: string) {
  return text.trim();
}

function lower(text: string) {
  return text.toLowerCase();
}

function isCommand(text: string) {
  return text.startsWith("/");
}

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

// ======================================================
// MESSAGE SPLITTER
// ======================================================

function splitMessage(text: string): string[] {
  const chunks: string[] = [];

  for (
    let i = 0;
    i < text.length;
    i += TELEGRAM_LIMIT
  ) {
    chunks.push(
      text.substring(
        i,
        i + TELEGRAM_LIMIT
      )
    );
  }

  return chunks;
}

// ======================================================
// MEMORY
// ======================================================

function getHistory(chatId: number) {
  if (!chatMemory.has(chatId)) {
    chatMemory.set(chatId, []);
  }

  return chatMemory.get(chatId)!;
}

function addMemory(
  chatId: number,
  role: Role,
  content: string
) {
  const history = getHistory(chatId);

  history.push({
    role,
    content,
  });

  if (history.length > MAX_HISTORY) {
    history.splice(
      0,
      history.length - MAX_HISTORY
    );
  }

  chatMemory.set(chatId, history);
}

function clearMemory(chatId: number) {
  chatMemory.delete(chatId);
}

// ======================================================
// PROFILE
// ======================================================

function saveUserProfile(
  chatId: number,
  firstName?: string,
  username?: string
) {
  userProfiles.set(chatId, {
    firstName,
    username,
    lastSeen: now(),
  });
}

function getUserProfile(chatId: number) {
  return userProfiles.get(chatId);
}

// ======================================================
// CLEANUP
// ======================================================

function cleanupOldMemory() {
  const current = now();

  for (const [chatId, profile] of userProfiles) {
    if (
      current - profile.lastSeen >
      MEMORY_EXPIRE_TIME
    ) {
      chatMemory.delete(chatId);
      userProfiles.delete(chatId);
      rateLimits.delete(chatId);
    }
  }
}

setInterval(
  cleanupOldMemory,
  1000 * 60 * 30
);

// ======================================================
// RATE LIMIT
// ======================================================

function isRateLimited(chatId: number) {
  const current = now();

  const existing = rateLimits.get(chatId);

  if (!existing) {
    rateLimits.set(chatId, {
      count: 1,
      timestamp: current,
    });

    return false;
  }

  if (
    current - existing.timestamp >
    RATE_LIMIT_WINDOW
  ) {
    rateLimits.set(chatId, {
      count: 1,
      timestamp: current,
    });

    return false;
  }

  existing.count++;

  if (existing.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

// ======================================================
// TELEGRAM API
// ======================================================

async function telegramRequest(
  endpoint: string,
  body: any
) {
  const response = await fetch(
    `${TELEGRAM_API}/${endpoint}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();

    console.error(
      "TELEGRAM ERROR:",
      response.status,
      text
    );
  }

  return response.json();
}

// ======================================================
// SEND MESSAGE
// ======================================================

async function sendMessage(
  chatId: number,
  text: string
) {
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
    });

    await sleep(300);
  }
}

// ======================================================
// TYPING
// ======================================================

async function sendTyping(chatId: number) {
  try {
    await telegramRequest("sendChatAction", {
      chat_id: chatId,
      action: "typing",
    });
  } catch (error) {
    console.error("Typing error:", error);
  }
}

// ======================================================
// HELPERS
// ======================================================

function getIndiaTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });
}

function isPureTimeQuestion(text: string) {
  const t = lower(text);

  return (
    /\b(current time|what time|india time)\b/.test(
      t
    ) ||
    /\b(today'?s date|current date)\b/.test(t)
  );
}

// ======================================================
// TELEGRAM IMAGE SUPPORT
// ======================================================

async function getTelegramFileUrl(
  fileId: string
) {
  try {
    const response = await fetch(
      `${TELEGRAM_API}/getFile?file_id=${fileId}`
    );

    const data = await response.json();

    const filePath =
      data?.result?.file_path;

    if (!filePath) {
      return null;
    }

    return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
  } catch (error) {
    console.error(
      "FILE URL ERROR:",
      error
    );

    return null;
  }
}

// ======================================================
// AI
// ======================================================

async function askAI(
  chatId: number,
  userMessage?: string,
  imageUrl?: string
): Promise<string> {
  try {
    const history = getHistory(chatId);

    const profile = getUserProfile(chatId);

    const profileContext = profile
      ? `
User Info:
- Name: ${profile.firstName || "Unknown"}
- Username: ${profile.username || "Unknown"}
`
      : "";

    const messages: any[] = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT + "\n" + profileContext,
      },
    ];

    // ==================================================
    // HISTORY
    // ==================================================

    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // ==================================================
    // CURRENT USER MESSAGE
    // ==================================================

    if (imageUrl) {
      messages.push({
        role: "user",

        content: [
          {
            type: "text",

            text:
              userMessage?.trim() ||
              "Analyze this image carefully.",
          },

          {
            type: "image_url",

            image_url: {
              url: imageUrl,
            },
          },
        ],
      });
    } else {
      messages.push({
        role: "user",

        content:
          userMessage?.trim() || "Hello",
      });
    }

    // ==================================================
    // GROQ REQUEST
    // ==================================================

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

          messages,

          temperature: 0.85,

          top_p: 0.95,

          max_tokens: 1200,

          presence_penalty: 0.7,

          frequency_penalty: 0.4,
        }),
      }
    );

    const data = await response.json();

    console.log(
      "GROQ RESPONSE:",
      JSON.stringify(data, null, 2)
    );

    // ==================================================
    // ERROR
    // ==================================================

    if (data.error) {
      console.error(
        "GROQ ERROR:",
        data.error
      );

      return `AI Error: ${data.error.message}`;
    }

    // ==================================================
    // REPLY
    // ==================================================

    const reply =
      data?.choices?.[0]?.message?.content;

    if (
      !reply ||
      typeof reply !== "string"
    ) {
      return "AI returned an empty response.";
    }

    return reply.trim();
  } catch (error) {
    console.error("AI ERROR:", error);

    return "Temporary AI failure.";
  }
}

// ======================================================
// COMMANDS
// ======================================================

async function handleCommand(
  chatId: number,
  text: string
) {
  const command = lower(text);

  // ==================================================
  // START
  // ==================================================

  if (command === "/start") {
    await sendMessage(
      chatId,
      `
🔥 Hi, I am Bruce!

I am a powerful AI assistant here to chat, answer questions, and help you with a wide range of topics.
      `
    );

    return true;
  }

  // ==================================================
  // HELP
  // ==================================================

  if (command === "/help") {
    await sendMessage(
      chatId,
      `
Commands:

/start - Start bot
/help - Show help
/reset - Clear memory

Just chat naturally.
      `
    );

    return true;
  }

  // ==================================================
  // RESET
  // ==================================================

  if (command === "/reset") {
    clearMemory(chatId);

    await sendMessage(
      chatId,
      "Conversation memory cleared."
    );

    return true;
  }

  return false;
}

// ======================================================
// MAIN
// ======================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log(
      "UPDATE:",
      JSON.stringify(body, null, 2)
    );

    const message = body?.message;

    if (!message) {
      return NextResponse.json({
        ok: true,
      });
    }

    const chatId = message.chat.id;

    // ==================================================
    // SAVE PROFILE
    // ==================================================

    saveUserProfile(
      chatId,
      message.from?.first_name,
      message.from?.username
    );

    // ==================================================
    // RATE LIMIT
    // ==================================================

    if (isRateLimited(chatId)) {
      await sendMessage(
        chatId,
        "You're sending messages too fast."
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // ==================================================
    // TEXT
    // ==================================================

    const rawText = message.text || "";

    const text = normalize(rawText);

    // ==================================================
    // COMMANDS
    // ==================================================

    if (text && isCommand(text)) {
      const handled = await handleCommand(
        chatId,
        text
      );

      if (handled) {
        return NextResponse.json({
          ok: true,
        });
      }
    }

    // ==================================================
    // TIME
    // ==================================================

    if (
      text &&
      isPureTimeQuestion(text)
    ) {
      await sendMessage(
        chatId,
        `India Time: ${getIndiaTime()}`
      );

      return NextResponse.json({
        ok: true,
      });
    }

    // ==================================================
    // IMAGE SUPPORT
    // ==================================================

    let imageUrl: string | undefined;

    if (
      message.photo &&
      Array.isArray(message.photo)
    ) {
      const largestPhoto =
        message.photo[
          message.photo.length - 1
        ];

      const fileId = largestPhoto.file_id;

      const fileUrl =
        await getTelegramFileUrl(fileId);

      if (fileUrl) {
        imageUrl = fileUrl;
      }
    }

    // ==================================================
    // EMPTY CHECK
    // ==================================================

    if (!text && !imageUrl) {
      return NextResponse.json({
        ok: true,
      });
    }

    // ==================================================
    // TYPING
    // ==================================================

    await sendTyping(chatId);

    // ==================================================
    // SAVE USER MEMORY
    // ==================================================

    if (text) {
      addMemory(chatId, "user", text);
    }

    if (imageUrl) {
      addMemory(
        chatId,
        "user",
        "[Image Uploaded]"
      );
    }

    // ==================================================
    // AI
    // ==================================================

    const aiReply = await askAI(
      chatId,
      text,
      imageUrl
    );

    // ==================================================
    // SAVE AI
    // ==================================================

    addMemory(
      chatId,
      "assistant",
      aiReply
    );

    // ==================================================
    // SEND
    // ==================================================

    await sendMessage(chatId, aiReply);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("MAIN ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}
