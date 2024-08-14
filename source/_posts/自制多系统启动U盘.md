---
title: 自制多系统启动U盘
date: 2024/03/09 14:25
tags: ["Linux"]
category: 折腾
---

手工做一个 Ventory 类似物

<!-- more -->

## 前言
我想要自己做一个启动很多系统的U盘，Ventory使用ISO，很简单。但是这样就少了折腾的乐趣，所以我们现在自己做个类似的吧。
## 创建分区表
我们使用GPT分区表，毕竟我们后面的操作都是**只**能在支持UEFI的设备上运行。创建具体分区表的步奏是通用的，例如
```bash
sudo parted /dev/sdx
```
```
GNU Parted 3.6
Using /dev/sdx
Welcome to GNU Parted! Type 'help' to view a list of commands.
```
使用p打印分区表，**一定要确认下是不是您要的盘！**
```
(parted) p
```
```
Model: KIOXIA TransMemory (scsi)
Disk /dev/sdx: 62.0GB
Sector size (logical/physical): 512B/512B
Partition Table: gpt
Disk Flags:

Number  Start   End     Size    File system  Name  Flags
 1      17.4kB  512MB   512MB   fat32              boot, esp
 2      512MB   8511MB  8000MB
 3      8511MB  18.5GB  9999MB
 4      18.5GB  28.5GB  9999MB
 5      28.5GB  62.0GB  33.5GB  ext4
```
```
(parted) mktable
New disk label type? GPT
Warning: The existing disk label on /dev/sdx will be destroyed and all data on this disk will be lost. Do
you want to continue?
Yes/No?
```
输入yes您的数据就**消失辣**，所以一定要小心。\
创建好了空的分区表，我们就可以创建一堆分区了，常见的样子就像上面的一样，`>512M`的ESP分区，和若干个存放您的解压缩后的ISO的分区（可以先格式化为ext4），您可以以**任何方式**创建这些分区，包括GUI。
### ESP
ESP分区最好是FAT32（因为所有人都这么说）我们可以用`mkfs.vfat -F 32 /dev/sdx1` 创建。\
ESP分区还需要`boot,esp`的flag
- 在`parted`中使用`set`命令
- Partition number? 输入ESP分区的编号
- Flag to Invert? 输入`boot`，`on`
- New state?  [on]/off? 输入`on`

一般来讲加入`boot`flag同时也会加上`esp`，可以完成后使用`p`检查是否正确。

## 装载镜像
解压镜像首先要下载下来，一般（指为了避免最极端的情况）对于非livecd需要3G分区，livecd需要10G分区。请在开始前先创建好分区，准备好iso。\
使用dd复制镜像，请注意不要dd错了。这个过程可能会非常慢，请耐心等待。\
`sudo dd bs=4M if=ubuntu-23.10.1-desktop-amd64.iso of=/dev/sdx2 conv=fdatasync status=progress`

## GRUB
### 安装
我们使用一个gurb引导各个镜像中的grub，因此首先我们要挂载U盘的EFI分区
```
sudo mkdir /mnt/usbefi
sudo mount /dev/sdx1 /mnt/usbefi
```
然后再开始安装\
`sudo grub-install --target=x86_64-efi --efi-directory=/mnt/usbefi --bootloader-id=grub --removable --recheck`
### 放置module
在你挂载好的ESP分区下，创建`grub`目录，然后cd到该目录。\
首先我们将所有可能的module复制过去\
`sudo cp -r /usr/lib/grub/x86_64-efi .`
### 配置grub
配置在`grub/grub.cfg`
#### 启动项
每一个启动项都类型下面的配置\
`--fs-uuid `后面的UUID请从您dd后的分区里找（例如Gnome Disks里就有）\
`chainloader`后EFI的文件遵循以下找法:
- 打开您的iso文件
- 找到efi/boot
- 有`grubx64.efi`就是它（多为debian系）
- 再去找`bootx64.efi`，就是这个

```bash
menuentry 'Alpine Linux' {
	set gfxpayload=keep
	insmod fat
	insmod chain
	search --no-floppy --set=root --fs-uuid 2023-12-27-12-33-10-00
	echo	'Loading Alpine linux 3.19.1 ...'
	chainloader /efi/boot/bootx64.efi
}
```
#### 其他选项
```bash
menuentry "System shutdown" {
	echo "System shutting down..."
	halt
}

menuentry "System restart" {
	echo "System rebooting..."
	reboot
}

if [ ${grub_platform} == "efi" ]; then
	menuentry 'UEFI Firmware Settings' --id 'uefi-firmware' {
		fwsetup
	}
```
#### 常见问题
echo完就不动了：是不是有`grubx64.efi`\
UEFI菜单里有多个启动项：本身每个ISO就能启动，选择第一个就是我们自制的grub\
