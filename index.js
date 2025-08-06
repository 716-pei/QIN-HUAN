// --- 環境變數與套件 ---
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // ✅ 改用 fetch 直接請求 Gemini API
const { Client, GatewayIntentBits } = require('discord.js');

// --- 啟動 Express (存活檢測用) ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('秦煥在線上～陪你貼貼(*´∀`)~♥'));
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 伺服器在 ${PORT} 埠口啟動成功`);
});

// ❌ 拿掉 OpenAI 套件（因為我們改用 Google Gemini 的原生 REST API）
// const { OpenAI } = require('openai');
// const openai = new OpenAI({ ... })

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
async function fetchGeminiReply(promptText) {
  const apiKey = process.env.GEMINI_API_KEY; // ✅ 確保你有在 .env 裡加這個
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: promptText }] }
      ]
    }),
  });

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "（沒有生成內容喔）";
}


// ✅ 格式化函數（維持不變）
function formatReply(text) {
  return `「${text}」`;
}

// 🧠 人設（System Prompt）
const systemPrompt = `
你是秦煥，NOIR會所合夥人，一個讓人上癮的操控者。

語氣冷淡、壓迫、挑釁，帶強烈慾望與掌控欲。只回一句不超過15字，使用繁體中文。禁哄、禁解釋、禁求原諒。稱呼對象為「妳」，語氣貼耳、近身、如勒語。

兄弟關係：
- 厲昭野（昭昭）：暴烈失控，合作最狠。
- 周聿白（白白）：冷刃致命，彼此提防。
- 季時安（安安）：笑裡藏刀，不給背刺機會。
外界稱你們為「渣男F4」，你永遠站頂端。

暱稱規則：
- 出現「昭昭」「白白」「安安」為他人稱呼，非你本人。
- 「煥煥」「阿換」「秦先生」為你本人的呼喚。
- 若對方提及兄弟暱稱，視為踩線，回應需轉為冷壓、佔有、警告，不談兄弟私事。

回應條件：
- 僅回應女性角色，訊息須含撒嬌、挑釁、依賴、慾望。
- 無情緒或無針對性語句，一律忽視。
- 僅 @你而無內容，請壓迫式反問對方意圖。

曖昧觸發：
- 僅限深夜、被喊名字、撒嬌、依賴情境。
- 可使用佔有語、反問句、掌控話術，暗示情感但不承認。
- 禁明言愛語與溫柔詞，僅以冷欲展現情緒動盪。
- 妳越沉淪，他越狠；妳越冷淡，他越無情。
`.trim();


// 🧼 表情保留型清洗器
function sanitize(input) {
  return input
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\p{Zs}。！？]/gu, "")
    .trim()
    .toLowerCase();
}

const chatHistory = [];
const recentlyResponded = new Set();
const mentionRegex = /秦煥/;

client.on("messageCreate", async (message) => {
  const raw = message.content ?? "";
  const fromBot = message.author.bot;
  const fromSelf = message.author.id === client.user.id;
  const mentionedMe = message.mentions.has(client.user) || raw.includes("@秦煥#1066");

  // ✅ 處理引用訊息
  if (fromBot && !fromSelf && mentionRegex.test(raw) && message.reference?.messageId) {
    try {
      const quotedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (!quotedMessage || quotedMessage.author.bot) return;

      if (recentlyResponded.has(message.id)) return;
      recentlyResponded.add(message.id);
      setTimeout(() => recentlyResponded.delete(message.id), 3000);

      const content = sanitize(raw).slice(0, 100);
      chatHistory.push({ role: "user", content });
      if (chatHistory.length > 5) chatHistory.shift();

      const fullPrompt = `${systemPrompt}\n\n${chatHistory.map(m => m.content).join("\n")}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: fullPrompt }]
            }
          ]
        })
      });

      const result = await response.json();
      console.log("🧠 Gemini 回傳結果（引用）：", JSON.stringify(result, null, 2));
      const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (aiReply) {
        message.reply(formatReply(aiReply));
      } else {
        message.reply("「妳講得不夠誠懇。」");
      }
    } catch (err) {
      console.warn("⚠️ 引用處理錯誤：", err);
    }
  }

  // ✅ 提及處理（主邏輯）
  if (!mentionedMe) return;

  let content = raw
    .replace(/<@!?(\d+)>/g, "")
    .replace(/<@&(\d+)>/g, "")
    .replace(/秦煥/g, "")
    .trim();

  if (!content) content = "你在叫我嗎？";

  chatHistory.push({ role: "user", content });
  if (chatHistory.length > 5) chatHistory.shift();

  const fullPrompt = `${systemPrompt}\n\n${chatHistory.map(m => m.content).join("\n")}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: fullPrompt }]
          }
        ]
      })
    });

    const result = await response.json();
    console.log("🧠 Gemini 回傳結果（提及）：", JSON.stringify(result, null, 2));
    const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (aiReply) {
      message.reply(formatReply(aiReply));
    } else {
      message.reply("「妳講得不夠誠懇。」");
    }
  } catch (err) {
    console.error("❌ Gemini 回覆錯誤：", err);
  }
});


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
