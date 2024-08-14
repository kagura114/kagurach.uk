---
title: Alpine Linux 搭建 sing-box
date: 2024/01/15 10:36
tags: ["sing-box","网络","Linux"]
category: 折腾
---

现在有很多便宜NAT鸡因为配置较低，使用的是Alpine Linux,且**性能奇差**，因此传统的一键安装V2Ray脚本就不太好用了，所以我就随便写了个教程方便使用。

<!-- more -->


## 安装依赖
首先先安装singbox,还有vim（方便编辑）  
```bash
echo "@testing https://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories
apk add sing-box@testing
apk add vim
```

## 设置自启
编辑这个文件：`vim /etc/init.d/singbox`
```bash
#!/sbin/openrc-run

command="/usr/bin/sing-box"
command_args="run -c /root/config.json" #是您的配置文件位置
description="singbox service"

depend() {
  need net
  use logger
}

start() {
  ebegin "Starting singbox"
  start-stop-daemon --start --background --exec $command -- $command_args
  eend $?
}

stop() {
  ebegin "Stopping singbox"
  start-stop-daemon --stop --exec $command
  eend $?
}
```
然后加入OpenRC自启动  
```bash
chmod +x /etc/init.d/singbox
rc-update add singbox default
service singbox start
```

## 示例配置
```json
{
  "log": {
      "disabled": false,
      "level": "info",
      "output": "/root/box.log",
      "timestamp": true
  },
  "dns": {},
  "ntp": {},
  "inbounds": [
      {
          "type": "shadowsocks",
          "listen": "::",
          "listen_port": 11451,
          "network": "tcp",
          "method": "aes-128-gcm",
          "password": "你不填就别想用",
          "multiplex": {
            "enabled": true
          }
        }
  ],
  "outbounds": [],
  "route": {},
  "experimental": {}
}
```

---
若需要查看更多sing-box配置，请参见
- [singbox docs](https://sing-box.sagernet.org/)
