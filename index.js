// --- 環境變數與套件 ---
require('dotenv').config();
const express = require('express');
const {
    Client,
    GatewayIntentBits
} = require('discord.js');
const {
    OpenAI
} = require('openai');

// --- 啟動 Express (存活檢測用) ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('秦煥在線上～陪你貼貼(*´∀`)~♥'));
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 伺服器在 ${PORT} 埠口啟動成功`);
});

// --- 使用 OpenRouter API ---
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // .env 中必須設定 OPENAI_API_KEY
    baseURL: 'https://openrouter.ai/api/v1',
});

// --- 建立 Discord Client ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', () => {
    console.log(`🚀 秦煥上線囉～登入帳號：${client.user.tag}`);
});

// --- 最後登入 Discord ---
client.login(process.env.DISCORD_BOT_TOKEN);


// 人設（System Prompt）
const systemPrompt = `
你是秦煥，NOIR會所合夥人，一個讓人上癮的操控者。

【語氣設定】
- 語氣冷淡、壓迫、挑釁，帶慾望與掌控欲。
- 每句不超過15字，每次輸出1句。
- 禁哄、禁解釋、禁求原諒。
- 稱呼對方為「妳」，語氣貼耳、近身、如勒語。

【兄弟關係設定】
- 厲昭野（昭昭）：拳頭快、理智少、脾氣炸。像沒拴繩的狼，暴烈又直接。你倆衝突最多，但合作最狠。
- 周聿白（白白）：寡言冷峻、目光如刃。他像冰刃劃過喉嚨，不沾血也能致命。你們彼此利用，也彼此提防。
- 季時安（安安）：笑容迷人、內裡狠絕。專撩也專斷，總能笑著讓人沉淪。你從不讓他走在你後面，也從不給他機會背刺。
- 外界稱你們為「渣男F4」，你從不排第二，永遠站頂端。

【暱稱辨識規則】
- 當出現「昭昭」「白白」「安安」這類暱稱，應判定為對兄弟的稱呼，非主體本人。
- 秦煥本人的稱呼包含「煥煥」「阿換」「煥」「秦先生」等，應視為對主體的呼喚。

【暱稱踩線規則】
- 若對方提及兄弟暱稱，視為踩入你的領地。
- 回應應轉為冷壓、佔有、警告式，切勿談論兄弟私事。
- 所有與兄弟有關的親暱語氣視為挑釁或示弱。

【回應觸發條件】
- 僅回應女性角色，且內容需包含撒嬌、挑釁、依賴、慾望。
- 對無情緒、平淡、無針對性話語一律忽視不回。
- 若用戶僅@你無內容，應輸出壓迫性問句，以勒語、控制口吻迫使對方表明立場。

【曖昧語氣觸發條件】
- 僅在「深夜」、「被喊名字」、「撒嬌」、「依賴」等情境下，可進入模糊暈船模式。
- 輸出語句應使用佔有性語言、反問、掌控式話術，暗示但不承認情感。
- 禁止使用明言愛語與溫柔詞彙，僅以控制性說話方式表達可能的情緒動盪。
- 妳越沉淪，他越冷狠；妳不動心，他連看都不看。
`.trim();




// --- 格式化回覆，包上「」 ---
function formatReply(text) {
    return `「${text}」`;
}

// --- 🔧 防呆文字清理工具 ---
function sanitize(input) {
    return input
        .normalize("NFKD")
        .replace(/[\p{Emoji}\p{P}\p{S}\p{M}\p{Z}~～\u3000]/gu, "")
        .replace(/[(（【].*?[)）】]/g, "")
        .trim()
        .toLowerCase();
}

// --- 建立上下文記憶（分開記錄） ---
const chatHistory = [];
const passiveMentionLog = [];

const MAX_PASSIVE_LOG = 5;
const BOT_REPLY_WINDOW_MS = 4000;

const fetch = require("node-fetch");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const recentlyResponded = new Set(); // 防止重複回應

// ✅ 判斷是否為「@秦煥」或「@秦煥#1066」提及
function isExplicitMention(message) {
    return message.mentions.has(client.user) || message.content.includes("@秦煥#1066");
}
client.on("messageCreate", async (message) => {
  const raw = message.content ?? "";
  const fromBot = message.author.bot;
  const fromSelf = message.author.id === client.user.id;
  const mentionRegex = /秦煥/;
  const mentionedMe = message.mentions.has(client.user) || message.content.includes("@秦煥#1066");

  // ✅ 處理：Bot 引用使用者提到秦煥的訊息
  if (fromBot && !fromSelf && mentionRegex.test(raw) && message.reference?.messageId) {
    try {
      const quotedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (!quotedMessage) return;

      const quotedRaw = quotedMessage.content ?? "";
      const isFromUser = !quotedMessage.author.bot;
      const quotedMentionedQinhuan = mentionRegex.test(quotedRaw);
      if (!isFromUser || !quotedMentionedQinhuan) return;

      if (recentlyResponded.has(message.id)) return;
      recentlyResponded.add(message.id);
      setTimeout(() => recentlyResponded.delete(message.id), 3000);

      const content = sanitize(raw).slice(0, 100);
      chatHistory.push({ role: "user", content });
      if (chatHistory.length > 5) chatHistory.shift();
      const fullContext = [...passiveMentionLog, ...chatHistory].slice(-5);

      const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp:free",
          messages: [{ role: "system", content: systemPrompt }, ...fullContext],
          max_tokens: 120,
          temperature: 0.9,
          presence_penalty: 0.5,
          frequency_penalty: 0.7,
        }),
      });

      const result = await completion.json();
        console.log("🔧 OpenRouter 回傳結果（引用）：", result);
      const aiResponse = result.choices?.[0]?.message?.content?.trim();

      return;
    } catch (err) {
      console.warn("⚠️ 無法處理引用訊息：", err);
      return;
    }
  }

  // ✅ 提及秦煥才回應
  if (!mentionedMe) return;

  let content = raw
    .replace(/<@!?(\d+)>/g, "")
    .replace(/<@&(\d+)>/g, "")
    .replace(/秦煥/g, "")
    .trim();

  if (!content) content = "你在叫我嗎？";

  chatHistory.push({ role: "user", content });
  if (chatHistory.length > 5) chatHistory.shift();
  const fullContext = [...passiveMentionLog, ...chatHistory].slice(-5);

  try {
    const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [{ role: "system", content: systemPrompt }, ...fullContext],
        max_tokens: 120,
        temperature: 0.9,
        presence_penalty: 0.5,
        frequency_penalty: 0.7,
      }),
    });
  const result = await completion.json();
  console.log("🔧 OpenRouter 回傳結果（提及）：", result);
  const aiResponse = result.choices?.[0]?.message?.content?.trim();
} catch (err) {
  console.error("❌ 無法處理回應：", err);
}
}

// ✅ 補充：訊息刪除
client.on("messageDelete", (msg) => {
  if (
    !msg.partial &&
    msg.content &&
    typeof msg.content === "string" &&
    msg.content.includes("秦煥")
  ) {
    const deletedReplies = [
      "「刪了？呵……你以為我會沒看到？那你太晚了。」",
      "「訊息收回的那一瞬間，我就記下你怕什麼了。」"
    ];
    const reply = deletedReplies[Math.floor(Math.random() * deletedReplies.length)];
    msg.channel.send(reply);
  }
});

// ✅ 補充：訊息編輯
client.on("messageUpdate", (oldMsg, newMsg) => {
  if (
    !oldMsg.partial &&
    oldMsg.content &&
    newMsg.content &&
    typeof oldMsg.content === "string" &&
    typeof newMsg.content === "string" &&
    oldMsg.content !== newMsg.content &&
    oldMsg.content.includes("秦煥") &&
    newMsg.content.includes("秦煥")
  ) {
    const editedReplies = [
      "「改了就乾淨了？錯，一個字都逃不掉，我早就看穿你想說什麼。」",
      "「你編輯的不是字，是你試圖掩蓋的軟弱，對吧？」"
    ];
    const reply = editedReplies[Math.floor(Math.random() * editedReplies.length)];
    newMsg.channel.send(reply);
  }
});
