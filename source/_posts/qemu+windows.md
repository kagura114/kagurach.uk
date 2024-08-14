---
title: KVM + Windows Guest!
date: 2023/12/09 14:35
tags: ["Linux"]
category: 折腾
---

用 KVM 在 Windows 上玩游戏

<!-- more -->

## 前言
Linux下使用QEMU开Windows虚拟机是一个很正常的事情。正好，咱是核显+*一个几乎完全用不上的N卡*如果再加上GPU Passthrough那肯定就更好了
## 安装
### QEMU
```Bash
$ sudo apt install qemu-system-x86 virt-manager
```
咱只需要这两个软件包就可以（其实包含了很多）
### KVM
根据您的处理器，进行两个modprobe
```Bash
modprobe kvm
#modprobe kvm_intel  # Intel processors
#modprobe kvm_amd    # AMD processors
```
完成后，进行检查（咱只有AMD cpu）
```Bash
$ lsmod | grep kvm
kvm_amd               184320  2
kvm                  1363968  2 kvm_amd
irqbypass              12288  3 vfio_pci_core,kvm
ccp                   147456  1 kvm_amd
```
这样就表示您配置成功KVM了
### GPU Passthrough
检查**没有用上**的显卡
```Bash
$ lspci -nnk
10:00.0 3D controller [0302]: NVIDIA Corporation GP106 [P106-100] [10de:1c07] (rev a1)
	Subsystem: Shenzhen Colorful Yugong Technology and Development Co. GP106 [P106-100] [7377:1234]
	Kernel driver in use: vfio-pci
	Kernel modules: nouveau
```
*什么是没有用上？*  
就是说您的系统不是用这张显卡输出视频的  
因为我有`VGA compatible controller [0300]: Advanced Micro Devices, Inc. [AMD/ATI] Cezanne [Radeon Vega Series / Radeon Vega Mobile Series] [1002:1638] (rev c9)`这个核显，所以我根本不用这张显卡。否则很快您就可能看不到您的输出了  
您的`Kernel driver in use` 字段肯定不是`vfio-pci`，那我们来分下情况：
- nvidia  说明您安装了N卡驱动
- nouveau 说明您没有装N卡驱动，那直接继续
如果您不幸安装了N卡驱动，请先卸载，过程如下
```Bash
$ sudo nvidia-settings --uninstall
$ sudo apt-get remove --purge nvidia*
$ sudo apt-get remove --purge xserver-xorg-video-nouveau
$ sudo apt-get remove --purge xserver-xorg-video-nv
$ sudo apt-get install nvidia-common
$ sudo apt-get install xserver-xorg-video-nouveau
$ sudo apt-get install xserver-xorg-video-all
$ sudo apt-get install --reinstall libgl1-mesa-glx libgl1-mesa-dri
$ sudo apt-get install --reinstall xserver-xorg-core
$ sudo dpkg-reconfigure xserver-xorg
```
然后再编辑VFIO配置
```Bash
$ sudo vi /etc/modprobe.d/vfio.conf
```
内容如下
```
blacklist nouveau
blacklist snd_hda_intel
options vfio-pci ids=10de:1c07
```
其中`10de:1c07`是设备id，多个id用逗号隔开  
最后  
```Bash
$ sudo update-initramfs -u
```
然后重启。

## 创建虚拟机
见[参考2](https://askubuntu.com/questions/1406888/ubuntu-22-04-gpu-passthrough-qemu) 的Step13（意思就是别去做14）  
**注意**  
UEFI Firmware中有`ms`和`secboot`会开启安全启动，*如果您要安装自签名的驱动，请不要使用*，安全启动不会给您额外的安全  
您完全可以导入您已经安装好的系统，但您**必须**按照教程重新创建，第一步选择*Import*即可  
**Step5记得勾上Customize before Install,否则您手动改xml有其他问题**  

## Windows下安装驱动
字面意思，您平常怎么装的就怎么装  
*N卡显示为3D控制器是很正常的，安装驱动即可解决*  

## 参考
1.[Docker Documents关于KVM的部分](https://docs.docker.com/desktop/install/linux-install/)  
2.[GPU Passthrough部分](https://askubuntu.com/questions/1406888/ubuntu-22-04-gpu-passthrough-qemu)  
