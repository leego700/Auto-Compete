// api/generate.ts
import { GoogleGenAI } from '@google/genai'; // 确保这里的包名和你之前在 App.tsx 里用的一致

export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 从前端接收你要发送给 AI 的数据
    const { prompt } = req.body;

    // 在云端（Vercel服务器）初始化 AI，这里会自动读取 Vercel 后台配置的 API Key
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 向 Google 发起请求（使用免费且强大的 gemini-2.0-flash）
    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
    });

    // 将生成的结果返回给前端
    res.status(200).json({ text: response.text });
    
  } catch (error) {
    console.error("API 调用失败:", error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
