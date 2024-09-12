---
title: frp内网穿透
date: 2024-09-02 12:34:54
tags: ["网络","Linux"]
category: "折腾"
---

用 frp 将内网暴露到公网
<!-- more -->

# Why frp
- 单 TCP 连接，**对代理**十分友好
- 配置简单，自带 ssh 和 web 转发等

# 安装
官方文档写的很详细: [doc](https://gofrp.org/zh-cn/docs/setup/)\
对于客户端 `frpc` 或者服务端 `frps` ，安装方式均是下载 [Release](https://github.com/fatedier/frp/releases)（都在一个tar包中），然后选择性运行 `frpc` 或者 `frps`\
另外[官方文档](https://gofrp.org/zh-cn/docs/setup/systemd/)也提供了进程守护的相关内容

# 添加服务
文档里有例子：https://gofrp.org/zh-cn/docs/examples/

# 配置代理（如果frps在国外）
如果 `frps.toml` 只指定了一个 `bindPort`，可以使用类似 `AND ((IPCIDR,<server>/32) && (DstPort,<bindPort>)` 指定\
如果可以确定 `frpc` 一定是需要走代理的，也可以直接匹配 `Process`

# 例子
假设把 frp 解压在了 `/opt/frp` 下，我们配置 ssh proxy + web 代理

### 端口情况：
> 服务端:

|端口|作用|
|:---:|:---|
|30071|客户端连接用|
|30072|客户端ssh用|
|30073|vHost本地使用|

> 客户端:

|端口|作用|
|:---:|:---|
|22|本机ssh端口|
|5244|要转发的http服务|

## frps.toml
```toml
bindPort = 30071
vhostHTTPPort = 30073
```
## 防火墙配置（如果有
```sh
firewall-cmd --permanent --new-service=frps
firewall-cmd --permanent --service=frps --add-port=30071-30072/tcp
firewall-cmd --permanent --zone=public --add-service=frps
firewall-cmd --reload
```

## 配置 Systemd Unit
`/etc/systemd/system/frps.service`
```sh
[Unit]
Description = frp server
After = network.target syslog.target
Wants = network.target

[Service]
Type = simple
ExecStart = /opt/frp/frps -c /opt/frp/frps.toml

[Install]
WantedBy = multi-user.target
```
运行查看是否正常
```sh
systemctl daemon-reload
systemctl start frps
systemctl status frps
```

## Web:反代网页
毕竟直接用 http 也太危险了，我们只要简单反代下即可\
>记得别忘了配置 DNS
```
location / {
    proxy_pass http://localhost:30073;
    proxy_set_header Host example.com;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

}
```

## frpc 配置
```
serverAddr = "114.51.4.191"
serverPort = 30071

[[proxies]]
name = "web"
type = "http"
localIP = "127.0.0.1"
localPort = 5244
customDomains = ["example.com"]

[[proxies]]
name = "ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 30072
```

## 之后
反代网页：你配置的什么域名你就访问那个呗。\
ssh：`ssh -p 30072 user@114.51.4.191`