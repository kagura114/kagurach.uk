---
title: Indorm Proxy 说明
date: 2024-10-23 22:13:19
tags: [ "啊？" ]
---

# Indorm Proxy 使用条件
- 连接到Wifi: `MashiroX`\
就这么简单，太好了

# 手动使用
服务器位于`192.168.1.149`,端口号为`30080`，支持 `http`,`socks5`

# 半自动使用（Windows）
- 首先你要先配置一次代理设置，这里只影响开关
```Powershell
if (Get-NetConnectionProfile | Out-String | Select-String -Pattern "MashiroX" -CaseSensitive -SimpleMatch) { Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" ProxyEnable -Value 1 ; echo "Switched on"} else {  Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" ProxyEnable -Value 0; echo "Switched Off" }
```