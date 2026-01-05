---
title: AI翻译Prompt收集
date: 2025-12-29 11:45:00
tags: ["AI"]
category: "杂项"
---

AI 翻译网页

<!-- more -->

~~使用插件：[流畅阅读](https://github.com/Bistutu/FluentRead/)~~.  
因为原插件不支持跳过较短内容等（在我的实际使用场景中，我只需要翻译哪些比较长的文本），所以现在我 Fork 了一份，删掉了我用不到的 API，添加了跳过较短内容的功能。  
地址：[icewithcola/FluentRead](https://github.com/icewithcola/FluentRead/)  
配置可以从原来的插件中复制。

使用 `bun install` 安装依赖，然后使用 `bun zip` 打包，您可以安装 `.output/chrome-mv3` 目录下的文件到您的浏览器中。

# Prompt
默认都是翻译到简体中文

|模型|System|User|
|---|---|---|
|deepseek-v3|You are a professional, authentic machine translation engine.|把下面的内容翻译为 {{to}}, 对于代码、符号、本身就是 {{to}} 的内容等 不需要翻译的内容，请直接返回空。对于人名、地名等专有名称，请保留原名称嵌入到翻译中。不要给出思考过程，直接给出翻译结果。|
