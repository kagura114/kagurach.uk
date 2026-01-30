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
echo "https://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories
apk add sing-box
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

或者使用 hysteria2

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
      "type": "hysteria2",
      "listen": "::",
      "listen_port": 47854,
      "users": [
        {
          "name": "your user",
          "password": "pAssw0rd"
        }
      ],
      "obfs": {
        "type": "salamander",
        "password": "p_ass_world"
      },
      "tls": {
        "enabled": true,
        "server_name": "example.org",
        "key_path": "/root/key.pem",
        "certificate_path": "/root/certificate.pem"
      }
    }
  ],
  "outbounds": [],
  "route": {},
  "experimental": {}
}
```

然后我们自签名一个证书
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out certificate.pem -days 365 -nodes -subj "/CN=example.org"
```

---
若需要查看更多sing-box配置，请参见
- [singbox docs](https://sing-box.sagernet.org/)
