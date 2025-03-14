# Deno-Gemini2api
基于api接口的gemini2api，转换为openai格式，支持流式或非流，api接口来源：
https://linux.do/t/topic/493230
分享了一个免费Gemini接口，海量号池，随便逆随便用，于是便用deno简单的逆了一下，转成openai标准格式，仅供个人学习测试；
支持/v1/models获取模型列表，支持模型
```
const MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-2.0-pro-exp-02-05",
  "gemini-2.0-flash-thinking-exp-01-21"
];
```
支持v1/chat/completions流式或非流聊天
