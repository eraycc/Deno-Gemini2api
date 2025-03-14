// server.ts
import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

// 配置信息
const AUTH_TOKEN = Deno.env.get("AUTH_TOKEN") || "sk-yourkey";
const TARGET_API = "https://www.deepseek.cloudns.org/api/chat";
const MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-2.0-pro-exp-02-05",
  "gemini-2.0-flash-thinking-exp-01-21"
];

// 生成标准 OpenAI 模型列表
function generateModelsResponse() {
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    object: "list",
    data: MODELS.map((model, index) => ({
      id: model.toLowerCase().replace(/ /g, "-"),
      object: "model",
      created: timestamp - index,
      owned_by: "clouddns"
    }))
  };
}

// 处理聊天请求
async function handleChatCompletion(req: Request, body: any) {
  const stream = Boolean(body.stream);
  const model = body.model || "gemini-2.0-flash-exp";
  
  // 提取最后一个用户消息
  const messages = body.messages || [];
  const lastMessage = messages
    .slice()
    .reverse()
    .find(m => m.role === "user")?.content || "";

  // 转发请求到目标 API
  const response = await fetch(TARGET_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: messages, model })
  });

  if (!response.ok) {
    return new Response("Upstream API error", { status: 500 });
  }

  const { message } = await response.json();

  // 流式响应处理
  if (stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const char of message) {
          const chunk = JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              delta: { content: char },
              index: 0,
              finish_reason: null
            }]
          });
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          await new Promise(r => setTimeout(r, 20));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" }
    });
  }

  // 非流式响应
  return new Response(JSON.stringify({
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      message: { role: "assistant", content: message },
      finish_reason: "stop",
      index: 0
    }]
  }), { headers: { "Content-Type": "application/json" } });
}

// 主请求处理器
async function handler(req: Request) {
  const url = new URL(req.url);

  // 处理模型列表请求
  if (url.pathname === "/v1/models" && req.method === "GET") {
    return new Response(
      JSON.stringify(generateModelsResponse()),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // 处理聊天请求
  if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
    // 验证鉴权令牌
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ") || 
        authHeader.slice(7) !== AUTH_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = await req.json();
      return handleChatCompletion(req, body);
    } catch (e) {
      return new Response("Invalid request", { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
}

// 启动服务器
console.log("Server running at http://localhost:8000");
serve(handler， { port: 8000 });
