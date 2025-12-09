// --- 環境變數與套件 ---
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
// 🌟 引入 Google 官方 AI 套件
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- 啟動 Express (存活檢測用) ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('秦煥在線上～陪你貼貼(*´∀`)~♥'));
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 伺服器在 ${PORT} 埠口啟動成功`);
});

// --- 設定 Google Gemini ---
// 這裡會自動處理版本和網址，不用我們手動操心
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// 使用最穩定的 1.5 Flash 模型
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
`.trim();

// 🧼 清洗器
function sanitize(input) {
  return input
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\p{Zs}。！？]/gu, "")
    .trim()
    .toLowerCase();
}

// 🛠️ 通用發送請求函數 (使用 SDK)
async function sendToGemini(promptText) {
    try {
        // 設定生成參數 (降低被擋機率)
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }],
                },
                {
                    role: "model",
                    parts: [{ text: "哼，知道了。說吧，想玩什麼？" }],
                },
            ],
        });

        const result = await chat.sendMessage(promptText);
        const response = await result.response;
        const text = response.text();
        return text.trim();

    } catch (err) {
        console.error("❌ Google SDK 報錯:", err);
        return null;
    }
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
      // 這裡直接傳送對話內容，因為 System Prompt 已經在 startChat 裡了
      const aiReply = await sendToGemini(`她說：「${latestMessage}」\n\n你會怎麼回？`);
      
      if (aiReply) message.reply(formatReply(aiReply));

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
  const aiReply = await sendToGemini(`她說：「${latestMessage}」\n\n你會怎麼回？`);
  
  if (aiReply) {
    message.reply(formatReply(aiReply));
  } else {
    message.reply("「……（秦煥眼神暗了暗，沒有說話）」");
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
