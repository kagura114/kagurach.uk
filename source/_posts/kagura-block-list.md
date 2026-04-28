---
title: Kagura's Block List
date: 2026/04/10 22:13
tags: ["Linux"]
category: 折腾
---

被屏蔽的 IP， ASN 等

<!-- more -->

# ASN
| AS Number | AS Name | Reason |
| :---: | :---: | --- |
|48090| Techoff Srv Limited | SSH 爆破天才聚集地 |
|47890| Unmanaged Ltd | SSH 爆破大师，貌似和 Techoff 还有一腿 |
|211590| Bucklog SARL | HTTP 爬虫大师 |

## CrowdSec Config
`/etc/crowdsec/config.yaml` 最上面写，遇到这些 ASN 的告警，直接 ban ASN
```yaml
name: block_bad_asn
filters:
  - "Alert.Source != nil && Alert.Source.AsNumber in ['47890', '48090', '211590']"
decisions:
  - type: ban
    duration: 72h
on_success: break
```