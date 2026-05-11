import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

// ======================================================
// ENV
// ======================================================

const TELEGRAM_TOKEN =
  process.env.BOT_TOKEN;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const GROQ_API_KEY =
  process.env.GROQ_API_KEY;

if (!TELEGRAM_TOKEN) {
  throw new Error("Missing BOT_TOKEN");
}

if (!GEMINI_API_KEY) {
  throw new Error(
    "Missing GEMINI_API_KEY"
  );
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ======================================================
// GEMINI
// ======================================================

const genAI = new GoogleGenerativeAI(
  GEMINI_API_KEY
);

// ======================================================
// TYPES
// ======================================================

type Role =
  | "user"
  | "assistant";

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

const RATE_LIMIT_WINDOW = 10000;

const RATE_LIMIT_MAX = 60;

const MEMORY_EXPIRE_TIME =
  1000 * 60 * 60 * 6;

// ======================================================
// MEMORY
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

An advanced Telegram AI assistant.

Traits:
- intelligent
- analytical
- direct
- conversational
- natural
- practical
- modern

Behavior:
- prioritize accuracy
- avoid robotic replies
- think critically
- explain clearly
- challenge false assumptions
- give production-quality coding help
- provide fully corrected code
- concise unless detail is needed

Vision:
- analyze images properly
- read screenshots
- detect UI
- explain code screenshots
- solve math from images
- identify objects and scenes

Never:
- sound corporate
- repeat the user's question
- overuse disclaimers
- say "As an AI language model"
`;

// ======================================================
// HELPERS
// ======================================================

function now() {
  return Date.now();
}

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function normalize(text: string) {
  return text.trim();
}

function lower(text: string) {
  return text.toLowerCase();
}

// ======================================================
// HTML ESCAPE
// ======================================================

function escapeHTML(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ======================================================
// BOLD TEXT
// ======================================================

function boldText(text: string) {
  return `<b>${escapeHTML(text)}</b>`;
}

// ======================================================
// SPLIT MESSAGE
// ======================================================

function splitMessage(
  text: string
): string[] {
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

function cleanupMemory() {
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
  cleanupMemory,
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
        "Content-Type":
          "application/json",
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

      text: boldText(chunk),

      parse_mode: "HTML",

      disable_web_page_preview: true,
    });

    await sleep(250);
  }
}

// ======================================================
// TYPING
// ======================================================

async function sendTyping(chatId: number) {
  try {
    await telegramRequest(
      "sendChatAction",
      {
        chat_id: chatId,
        action: "typing",
      }
    );
  } catch (error) {
    console.error(
      "Typing Error:",
      error
    );
  }
}

// ======================================================
// TIME
// ======================================================

function getIndiaTime() {
  return new Date().toLocaleString(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      hour12: true,
    }
  );
}

function isTimeQuestion(
  text: string
) {
  const t = lower(text);

  return (
    t.includes("time") ||
    t.includes("date")
  );
}

// ======================================================
// GET TELEGRAM FILE URL
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
// GEMINI AI
// ======================================================

async function askGemini(
  chatId: number,
  userMessage?: string,
  imageUrl?: string
) {
  try {
    const history = getHistory(chatId);

    const profile = getUserProfile(chatId);

    const profileContext = profile
      ? `
User:
- Name: ${
          profile.firstName || "Unknown"
        }
- Username: ${
          profile.username || "Unknown"
        }
`
      : "";

    // ==================================================
    // CONTEXT
    // ==================================================

    let context = `
${SYSTEM_PROMPT}

${profileContext}
`;

    for (const msg of history) {
      context += `
${msg.role.toUpperCase()}:
${msg.content}
`;
    }

    // ==================================================
    // MODEL
    // ==================================================

    const model =
      genAI.getGenerativeModel({
        model:
          "gemini-1.5-flash-latest",
      });

    // ==================================================
    // IMAGE MODE
    // ==================================================

    if (imageUrl) {
      console.log(
        "IMAGE URL:",
        imageUrl
      );

      const imageResponse =
        await fetch(imageUrl);

      if (!imageResponse.ok) {
        throw new Error(
          "Failed to download image"
        );
      }

      const mimeType =
        imageResponse.headers.get(
          "content-type"
        ) || "image/jpeg";

      console.log(
        "MIME TYPE:",
        mimeType
      );

      const arrayBuffer =
        await imageResponse.arrayBuffer();

      const base64 =
        Buffer.from(arrayBuffer).toString(
          "base64"
        );

      const result =
        await model.generateContent({
          contents: [
            {
              role: "user",

              parts: [
                {
                  text: `
${context}

User message:
${
  userMessage ||
  "Analyze this image carefully."
}
`,
                },

                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
        });

      const response =
        result.response.text();

      console.log(
        "IMAGE RESPONSE:",
        response
      );

      if (!response) {
        return "Gemini returned empty image response.";
      }

      return response.trim();
    }

    // ==================================================
    // TEXT ONLY
    // ==================================================

    const result =
      await model.generateContent(`
${context}

USER:
${userMessage}

ASSISTANT:
`);

    const response =
      result.response.text();

    if (!response) {
      return "Empty AI response.";
    }

    return response.trim();
  } catch (error) {
    console.error(
      "GEMINI ERROR:",
      error
    );

    throw error;
  }
}

// ======================================================
// GROQ FALLBACK
// ======================================================

async function askGroq(
  chatId: number,
  userMessage?: string
) {
  try {
    if (!GROQ_API_KEY) {
      throw new Error(
        "Missing GROQ_API_KEY"
      );
    }

    const history = getHistory(chatId);

    const messages: any[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
    ];

    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    messages.push({
      role: "user",
      content:
        userMessage || "Hello",
    });

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model:
            "llama-3.3-70b-versatile",

          messages,

          temperature: 0.7,

          max_tokens: 1200,
        }),
      }
    );

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message
        ?.content;

    if (!reply) {
      return "Groq returned empty response.";
    }

    return reply.trim();
  } catch (error) {
    console.error(
      "GROQ ERROR:",
      error
    );

    throw error;
  }
}

// ======================================================
// MAIN AI
// ======================================================

async function askAI(
  chatId: number,
  userMessage?: string,
  imageUrl?: string
): Promise<string> {
  try {
    return await askGemini(
      chatId,
      userMessage,
      imageUrl
    );
  } catch (geminiError) {
    console.error(
      "Gemini failed. Trying Groq..."
    );

    try {
      return await askGroq(
        chatId,
        userMessage
      );
    } catch (groqError) {
      console.error(
        "Groq failed:",
        groqError
      );

      return "AI providers are temporarily unavailable.";
    }
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

  const profile =
    getUserProfile(chatId);

  const firstName =
    profile?.firstName || "there";

  // ==================================================
  // START
  // ==================================================

  if (command === "/start") {
    await sendMessage(
      chatId,
      `
Hi ${firstName} 👋

🔥 I am Bruce Made by Vishnu 

I can help you with:
- Smart conversations
- Coding help
- AI chat
- Reasoning
- Problem solving
❤️ Stay with us https://t.me/+B9KqNbvFv1cyOWE9
Chat naturally.
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

Features:
- Smart AI chat
- Image analysis
- OCR
- Screenshot analysis
- Coding help
- Reasoning
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

export async function POST(
  req: NextRequest
) {
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

    const rawText =
      message.text || "";

    const text = normalize(rawText);

    // ==================================================
    // COMMANDS
    // ==================================================

    if (
      text &&
      text.startsWith("/")
    ) {
      const handled =
        await handleCommand(
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
      isTimeQuestion(text)
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
    // IMAGE / DOCUMENT SUPPORT
    // ==================================================

    let imageUrl:
      | string
      | undefined;

    // ==================================================
    // PHOTO
    // ==================================================

    if (
      message.photo &&
      Array.isArray(message.photo)
    ) {
      const largestPhoto =
        message.photo[
          message.photo.length - 1
        ];

      const fileId =
        largestPhoto.file_id;

      const fileUrl =
        await getTelegramFileUrl(
          fileId
        );

      if (fileUrl) {
        imageUrl = fileUrl;

        console.log(
          "PHOTO IMAGE:",
          imageUrl
        );
      }
    }

    // ==================================================
    // DOCUMENT IMAGE
    // ==================================================

    else if (
      message.document &&
      message.document.mime_type?.startsWith(
        "image/"
      )
    ) {
      const fileId =
        message.document.file_id;

      const fileUrl =
        await getTelegramFileUrl(
          fileId
        );

      if (fileUrl) {
        imageUrl = fileUrl;

        console.log(
          "DOCUMENT IMAGE:",
          imageUrl
        );
      }
    }

    // ==================================================
    // EMPTY
    // ==================================================

    if (!text && !imageUrl) {
      return NextResponse.json({
        ok: true,
      });
    }

    // ==================================================
    // TYPING LOOP
    // ==================================================

    const typingLoop =
      setInterval(() => {
        sendTyping(chatId);
      }, 4000);

    // ==================================================
    // AI
    // ==================================================

    const aiReply = await askAI(
      chatId,
      text,
      imageUrl
    );

    clearInterval(typingLoop);

    // ==================================================
    // SAVE MEMORY
    // ==================================================

    if (text) {
      addMemory(
        chatId,
        "user",
        text
      );
    }

    if (imageUrl) {
      addMemory(
        chatId,
        "user",
        "[Image Uploaded]"
      );
    }

    addMemory(
      chatId,
      "assistant",
      aiReply
    );

    // ==================================================
    // SEND
    // ==================================================

    await sendMessage(
      chatId,
      aiReply
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "MAIN ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}
