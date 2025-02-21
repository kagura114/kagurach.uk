---
title: 一次 Btrfs 修复
date: 2025/02/21 11:45
tags: ["Linux", "修理"]
category: 爆炸心得
---

Btrfs 炸了，第二次，但是这次也好了

<!-- more -->

# 起因
两次的起因都是对文件进行操作的时候，突然系统就变成 Read-Only Filesystem  
`dmesg` 就像是这样：
```
BTRFS error (device dm-0): failed to run delayed ref for logical 1074845970432 num_bytes 4096 type 178 action 1 ref_mod 1: -17
------------[ cut here ]------------
BTRFS: Transaction aborted (error -17)
WARNING: CPU: 2 PID: 1408 at fs/btrfs/extent-tree.c:2191 btrfs_run_delayed_refs.cold+0x53/0x57 [btrfs]
```
看到这些，我就心中一愣，知道是文件系统爆炸了

# 备份
呃我没有别的盘了，这里如果是还能读取的话**赶快备份**

# 查错
## **如果有硬件问题，越修你的数据只会死的越快！！**
`smartctl` 由 `smartmontools` 提供
```
sudo smartctl -a /dev/nvme1n1
...这部分没啥好看的
=== START OF SMART DATA SECTION ===
SMART overall-health self-assessment test result: PASSED

SMART/Health Information (NVMe Log 0x02)
Critical Warning:                   0x00
Temperature:                        28 Celsius
Available Spare:                    100%
Available Spare Threshold:          5%
Percentage Used:                    4% <- 这个最好别太大
Data Units Read:                    18,574,496 [9.51 TB]
Data Units Written:                 37,349,435 [19.1 TB]
Host Read Commands:                 129,544,406
Host Write Commands:                905,426,372
Controller Busy Time:               792
Power Cycles:                       604
Power On Hours:                     4,433
Unsafe Shutdowns:                   63
Media and Data Integrity Errors:    0 <- 这个不是 0 就完蛋了
Error Information Log Entries:      1,141 <- 这个没啥用
...后面那个 Error 是因为该部分被厂商随便用，谁遵守标准）
```
如果你实在看不懂，[ChatGPT](https://chatgpt.com) 可以帮你解读的。（但是可能会给你出昏招）

## btrfs scrub
`scrub` 是 btrfs 里一个较为无害的操作，基本不会让你的数据消失，要求要挂载上才可以进行操作
```
sudo btrfs scrub status /
UUID:             035944f3-41a6-4007-a447-5b66ed05f34d
Scrub started:    
Status:           finished
Duration:         0:07:03
Total to scrub:   693.51GiB
Rate:             1.64GiB/s
Error summary:    csum=1 <- Error
  Corrected:      0
  Uncorrectable:  1
  Unverified:     0
```
此时其实 `dmesg` 也会打出东西，例如  
`BTRFS error (device dm-0): unable to fixup (regular) error at logical 1074845908992 on dev /dev/mapper/root physical 347931082752`  
不过对我这各来说，Uncorrectable Error = 1，这下麻烦大了

# 修复（LiveCD）中
## 绝对要在 LiveCD 里面修，而且镜像越新越好
## 解密
我开了 Luks，所以要先解密
```bash
sudo cryptsetup luksOpen /dev/disk somePart
```
这里 `somePart` 最后会在 `/dev/mapper/somePart` 作为解密好的分区出现

## btrfs scrub, again
先 `mount` 到喜欢的地方，再跑一遍，因为之前是系统盘，`dmesg`里没有成功找到有问题的文件，所以我们再跑一次，这次的 `dmesg`
```
BTRFS warning (device dm-0): checksum error at logical 1074845970432 on dev /dev/mapper/dm0, physical 347931144192, root 257, inode 23287266, offset 0, length 4096, links 1 (path: somefile) <- 这里
BTRFS error (device dm-0): bdev /dev/mapper/dm0 errs: wr 0, rd 0, flush 0, corrupt 17, gen 0
BTRFS error (device dm-0): unable to fixup (regular) error at logical 1074845970432 on dev /dev/mapper/dm0
```
现在终于找到了有问题的文件，解决方式也简单，没用的，删了，有用的，重命名放一边当地雷）

## btrfs check
这次先 `umount`，先检查一下，`check` 需要不 `mount`（虽然 mount 也可以，但是我上次就是这么从 readonly 变成 bad superblock 的）
```
sudo btrfs check /dev/mapper/dm0 
Opening filesystem to check...
Checking filesystem on /dev/mapper/dm0
UUID: 035944f3-41a6-4007-a447-5b66ed05f34d
[1/7] checking root items
[2/7] checking extents
[3/7] checking free space tree
free space extent ends at 36029871598870528, beyond end of block group 1073772232704-1074845974528
free space info recorded 751 extents, counted 421
there is no free space entry for 1074579873792-1074579906560
cache appears valid but isn't 1073772232704
[4/7] checking fs roots
        unresolved ref dir 26806343 index 2 namelen 15 name Elver_Wings.dat filetype 1 errors 2, no dir index
        unresolved ref dir 26806343 index 2 namelen 15 name El�er_Wings.dat filetype 1 errors 5, no dir item, no inode ref
ERROR: errors found in fs roots
found 739940659200 bytes used, error(s) found
total csum bytes: 490689588
total tree bytes: 4604461056
total fs tree bytes: 3693199360
total extent tree bytes: 300187648
btree space waste bytes: 740603716
file data blocks allocated: 12058437595136
 referenced 660959006720
```
看上去一点也不好啊，现在得大修了
# 特别危险，数据会丢失！！！
# 如果提示你可以用force参数千万别用，老实umount掉
```
sudo btrfs check --repair 你解密好的盘
```
# 让你看十秒的意思是可能让你的数据永远消失（建议搜索此命令受害者有多少）

## 结尾
这次运气好，跑完以后错误都修复好了，皆大欢喜

# 树死了😇
如果你不幸用了 `--repair` 以后文件系统升天，树根结点报错（大概率跑的时候爆了很多东西，别停，停了死的更快），如果是树死了，其实也有办法  
## 首先我能解决树死了是这样的
```
btrfs check /dev/xxx
Opening filesystem to check...
parent transid verify failed on ...
Ignoring transid failure
ERROR: child eb corrupted: parent ... child level=0
ERROR: failed to read block groups: Input/output error
ERROR: cannot open file system
```
mount 的 dmesg 直接报 `open_ctree failed`
## n板斧
```
btrfs rescue super-recover
btrfs zero-log super-recover
btrfs chunk-recover super-recover
```
您可以自行搜索每一条的意思，然后决定是否使用
## 大杀器
重建树
```
btrfs check --init-extent-tree
```
600G数据差不多要10小时，NVME SSD  
最后这个修好了