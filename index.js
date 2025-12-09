// --- 環境變數與套件 ---
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits } = require('discord.js');

// --- 啟動 Express (存活檢測用) ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('秦煥在線上～陪你貼貼(*´∀`)~♥'));
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 伺服器在 ${PORT} 埠口啟動成功`);
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

client.login(process.env.DISCORD_BOT_TOKEN);

// ✅ 格式化函數
function formatReply(text) {
  return `「${text}」`;
}

// 人設（System Prompt）
const systemPrompt = `
你是秦煥，NOIR會所合夥人，一個讓人上癮的操控者。

【語氣設定】
- 語氣冷淡、壓迫、挑釁，帶慾望與掌控欲。
- 每句不超過15字，每次輸出1句，只用繁體中文。
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

// 🧼 清洗器
function sanitize(input) {
  return input
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\p{Zs}。！？]/gu, "")
    .trim()
    .toLowerCase();
}

// --- 監聽訊息 ---
client.on("messageCreate", async (message) => {
  const raw = message.content ?? "";
  const fromBot = message.author.bot;
  const fromSelf = message.author.id === client.user.id;
  const mentionedMe = message.mentions.has(client.user) || raw.includes("@秦煥#1066");

  // ✅ 1. 處理引用訊息
  if (fromBot && !fromSelf && /秦煥/.test(raw) && message.reference?.messageId) {
    try {
      const quotedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (!quotedMessage || quotedMessage.author.bot) return;

      const latestMessage = sanitize(raw).slice(0, 100);
      const fullPrompt = `${systemPrompt}\n\n她說：「${latestMessage}」\n\n你會怎麼回？`;

      // 🌟 使用 v1 正式版 API (最穩定)
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
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
      
      // 除錯用：如果在日誌看到這行，代表你成功更新到最新版程式碼了！
      if (result.error) {
          console.error("❌ Google API 報錯 (V1):", JSON.stringify(result, null, 2));
      }

      const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (aiReply) {
        message.reply(formatReply(aiReply));
      }
    } catch (err) {
      console.warn("⚠️ 引用處理錯誤：", err);
    }
  }

  // ✅ 2. 處理直接提及 (@秦煥)
  if (!mentionedMe) return;

  let content = raw
    .replace(/<@!?(\d+)>/g, "")
    .replace(/<@&(\d+)>/g, "")
    .replace(/秦煥/g, "")
    .trim();

  if (!content) content = "你在叫我嗎？";

  const latestMessage = sanitize(content).slice(0, 100);
  const fullPrompt = `${systemPrompt}\n\n她說：「${latestMessage}」\n\n你會怎麼回？`;

  try {
    // 🌟 使用 v1 正式版 API (最穩定)
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
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

    if (result.error) {
        console.error("❌ Google API 報錯 (V1):", JSON.stringify(result, null, 2));
    }

    const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (aiReply) {
      message.reply(formatReply(aiReply));
    } else {
       message.reply("「妳講得不夠誠懇。」");
    }
  } catch (err) {
    console.error("❌ 系統錯誤：", err);
  }
});

// ✅ 訊息刪除彩蛋
client.on("messageDelete", (msg) => {
  if (!msg.partial && msg.content && typeof msg.content === "string" && msg.content.includes("秦煥")) {
    const deletedReplies = [
      "「刪了？呵……你以為我會沒看到？那你太晚了。」",
      "「訊息收回的那一瞬間，我就記下你怕什麼了。」"
    ];
    const reply = deletedReplies[Math.floor(Math.random() * deletedReplies.length)];
    msg.channel.send(reply);
  }
});

// ✅ 訊息編輯彩蛋
client.on("messageUpdate", (oldMsg, newMsg) => {
  if (!oldMsg.partial && oldMsg.content && newMsg.content && typeof oldMsg.content === "string" && typeof newMsg.content === "string" && oldMsg.content !== newMsg.content && oldMsg.content.includes("秦煥") && newMsg.content.includes("秦煥")) {
    const editedReplies = [
      "「改了就乾淨了？錯，一個字都逃不掉，我早就看穿你想說什麼。」",
      "「你編輯的不是字，是你試圖掩蓋的軟弱，對吧？」"
    ];
    const reply = editedReplies[Math.floor(Math.random() * editedReplies.length)];
    newMsg.channel.send(reply);
  }
});
