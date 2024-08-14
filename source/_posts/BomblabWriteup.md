---
title: Bomblab Writeup
date: 2024/05/07 9:30
tags: ["学校课程","Linux"]
category:
---

Bomblab 的一些做法等

<!-- more -->

# 警告 Warning
**请勿**直接照抄本内容作为答案以及实验报告，本篇所述仅代表能作出本人的题目，如有错误欢迎指出。\
Please **do not** copy this content directly as answers or in your experiment reports. The content presented here only represents the author's unique question. If there are any errors, please feel free to point them out.

# Warp Zone
- [phase_1](#0x401614-phase_1)
- [phase_1答案](#phase_1-解答)
- [phase_2找答案方法](#0x401638-phase_2)
- [phase_3](#0x4016aa-phase_3)
- [phase_3速通](#直接做)
- [phase_4](#0x4017a0-phase_4)
- [phase_4速通](#速通)
- [phase_5](#0x401815-phase_5)
- [phase_6](#0x4018ac-phase_6)
- [secret_phase](#401a5a-secret_phase)

# 0x401614 phase_1
## 代码
```asm
0000000000401614 <phase_1>:
  401614:	f3 0f 1e fa          	endbr64
  401618:	48 83 ec 08          	sub    $0x8,%rsp
  40161c:	48 8d 35 29 1b 00 00 	lea    0x1b29(%rip),%rsi        # 40314c <_IO_stdin_used+0x14c>
  401623:	e8 3e 05 00 00       	call   401b66 <strings_not_equal>
  401628:	85 c0                	test   %eax,%eax
  40162a:	75 05                	jne    401631 <phase_1+0x1d>
  40162c:	48 83 c4 08          	add    $0x8,%rsp
  401630:	c3                   	ret
  401631:	e8 1f 08 00 00       	call   401e55 <explode_bomb>
  401636:	eb f4                	jmp    40162c <phase_1+0x18>
```
## 流程
```
  401628:	85 c0                	test   %eax,%eax
  40162a:	75 05                	jne    401631 <phase_1+0x1d>
```
`%eax` 如果不是0的话就爆炸\
那么往上找 `%eax` 是那里来的，很明显这段代码里没有出现，那肯定是在 `<strings_not_equal>` 中得到的了。

# 0x401b66 strings_not_equal
## 代码
```asm
0000000000401b66 <strings_not_equal>:
  401b66:	f3 0f 1e fa          	endbr64
  401b6a:	41 54                	push   %r12
  401b6c:	55                   	push   %rbp
  401b6d:	53                   	push   %rbx
  401b6e:	48 89 fb             	mov    %rdi,%rbx
  401b71:	48 89 f5             	mov    %rsi,%rbp
  401b74:	e8 cc ff ff ff       	call   401b45 <string_length>
  401b79:	41 89 c4             	mov    %eax,%r12d 
  401b7c:	48 89 ef             	mov    %rbp,%rdi
  401b7f:	e8 c1 ff ff ff       	call   401b45 <string_length>
  401b84:	89 c2                	mov    %eax,%edx
  401b86:	b8 01 00 00 00       	mov    $0x1,%eax
  401b8b:	41 39 d4             	cmp    %edx,%r12d
  401b8e:	75 31                	jne    401bc1 <strings_not_equal+0x5b> //401bc1
  401b90:	0f b6 13             	movzbl (%rbx),%edx
  401b93:	84 d2                	test   %dl,%dl
  401b95:	74 1e                	je     401bb5 <strings_not_equal+0x4f>
  401b97:	b8 00 00 00 00       	mov    $0x0,%eax
  401b9c:	38 54 05 00          	cmp    %dl,0x0(%rbp,%rax,1)
  401ba0:	75 1a                	jne    401bbc <strings_not_equal+0x56> //401bc1
  401ba2:	48 83 c0 01          	add    $0x1,%rax
  401ba6:	0f b6 14 03          	movzbl (%rbx,%rax,1),%edx
  401baa:	84 d2                	test   %dl,%dl
  401bac:	75 ee                	jne    401b9c <strings_not_equal+0x36>
  401bae:	b8 00 00 00 00       	mov    $0x0,%eax
  401bb3:	eb 0c                	jmp    401bc1 <strings_not_equal+0x5b>
  401bb5:	b8 00 00 00 00       	mov    $0x0,%eax
  401bba:	eb 05                	jmp    401bc1 <strings_not_equal+0x5b>
  401bbc:	b8 01 00 00 00       	mov    $0x1,%eax
  401bc1:	5b                   	pop    %rbx
  401bc2:	5d                   	pop    %rbp
  401bc3:	41 5c                	pop    %r12
  401bc5:	c3                   	ret
```
## 流程
我们不管这个函数如何判断，当我们看到 `call 401b45 <string_length>` 时，我们很容易猜到这里分别获取了咱们输入的字符串和答案字符串的长度。那这个时候这两个字符串肯定会被访问到，因此我们看看这个函数。

# 0x401b45 string_length
## 代码
```asm
0000000000401b45 <string_length>:
  401b45:	f3 0f 1e fa          	endbr64
  401b49:	80 3f 00             	cmpb   $0x0,(%rdi) // *c == 0 return 0 
  401b4c:	74 12                	je     401b60 <string_length+0x1b>
  401b4e:	b8 00 00 00 00       	mov    $0x0,%eax // length = 0
  401b53:	48 83 c7 01          	add    $0x1,%rdi // c = c+sizeof(char)
  401b57:	83 c0 01             	add    $0x1,%eax // length++
  401b5a:	80 3f 00             	cmpb   $0x0,(%rdi) // *c == 0 return length 
  401b5d:	75 f4                	jne    401b53 <string_length+0xe>
  401b5f:	c3                   	ret
  401b60:	b8 00 00 00 00       	mov    $0x0,%eax
  401b65:	c3                   	ret
```
## 流程
我注释了代码，我们就能很明显发现这个函数使用了类似指针来计算字符串长度，而很明显，`$rdi` 指向了字符串的头。\
在gdb中使用 `x/s $rdi` 就可以打印出字符串了

## phase_1 解答
```
(gdb)break explode_bomb 
Breakpoint 1 at 0x401e55
(gdb) break string_length
Breakpoint 2 at 0x401b45
(gdb) r made_by_kagura 
Starting program: /home/kagura/bomb114514/bomb made_by_kagura
[Thread debugging using libthread_db enabled]
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1".
Welcome to my fiendish little bomb. You have 6 phases with
which to blow yourself up. Have a nice day!

Breakpoint 2, 0x0000000000401b45 in string_length ()
(gdb) x/s $rdi
0x405820 <input_strings>:	"Do not copy my answer - Kagura"
(gdb) c               
Continuing.

Breakpoint 2, 0x0000000000401b45 in string_length ()
(gdb) x/s $rdi
0x40314c:	"Public speaking is very easy."
```
很明显上面是我们输入的，下面是就是答案。

# 0x401638 phase_2
## 代码
```
0000000000401638 <phase_2>:
  401638:	f3 0f 1e fa          	endbr64
  40163c:	55                   	push   %rbp
  40163d:	53                   	push   %rbx
  40163e:	48 83 ec 28          	sub    $0x28,%rsp
  401642:	64 48 8b 04 25 28 00 	mov    %fs:0x28,%rax //rax=0x405870
  401649:	00 00 
  40164b:	48 89 44 24 18       	mov    %rax,0x18(%rsp)
  401650:	31 c0                	xor    %eax,%eax
  401652:	48 89 e6             	mov    %rsp,%rsi
  401655:	e8 3d 08 00 00       	call   401e97 <read_six_numbers> //len!=6 bomb 格式是 %d %d %d %d %d %d
  40165a:	83 3c 24 00          	cmpl   $0x0,(%rsp)
  40165e:	78 0a                	js     40166a <phase_2+0x32> // *rsp<0 goto explode_bomb 
  401660:	48 89 e5             	mov    %rsp,%rbp  
  401663:	bb 01 00 00 00       	mov    $0x1,%ebx  // ebx 初始值：1
  401668:	eb 13                	jmp    40167d <phase_2+0x45> // 40167d
  ----------------------
  40166a:	e8 e6 07 00 00       	call   401e55 <explode_bomb>
  40166f:	eb ef                	jmp    401660 <phase_2+0x28>
  》》》》》》》》》》》》》》》》》》》
  401671:	83 c3 01             	add    $0x1,%ebx // rbx=2
  401674:	48 83 c5 04          	add    $0x4,%rbp // rbp指向输入的第二个数字
  401678:	83 fb 06             	cmp    $0x6,%ebx // rbx-6==0->goto* rbx:for循环内变量
  40167b:	74 11                	je     40168e <phase_2+0x56>
  *****************************
  ----------------------
  40167d:	89 d8                	mov    %ebx,%eax
  40167f:	03 45 00             	add    0x0(%rbp),%eax //eax += *rbp rbp:输入的数字 ;eax=[1+input[0],2+input[1],...]: (n+1)+input[n]: 0 1 3 6 10 15
  401682:	39 45 04             	cmp    %eax,0x4(%rbp) // *(rbp+4)-eax==0->bomb , rbp 输入的第x+1个数字
  401685:	74 ea                	je     401671 <phase_2+0x39>
  》》》》》》》》》》》》》》》》》》》
  401687:	e8 c9 07 00 00       	call   401e55 <explode_bomb>
  40168c:	eb e3                	jmp    401671 <phase_2+0x39>
  ******************************
  40168e:	48 8b 44 24 18       	mov    0x18(%rsp),%rax //rax = *rsp+16+8
  401693:	64 48 2b 04 25 28 00 	sub    %fs:0x28,%rax
  40169a:	00 00 
  40169c:	75 07                	jne    4016a5 <phase_2+0x6d>
  40169e:	48 83 c4 28          	add    $0x28,%rsp
  4016a2:	5b                   	pop    %rbx
  4016a3:	5d                   	pop    %rbp
  4016a4:	c3                   	ret
  4016a5:	e8 c6 fb ff ff       	call   401270 <__stack_chk_fail@plt>
```
## 注释解读
第一个对我们有意义的操作是 `401655: call 401e97 <read_six_numbers>`，这个函数意思十分明显，就是读取六个数字。其具体实现等我们先不用看（当然[这里]()我也写了），反正您只要知道，输入格式是 `%d %d %d %d %d %d` 而没有匹配到六个就爆炸就可以了。\
下一步是 `cmpl $0x0,(%rsp);js 40166a <phase_2+0x32> // *rsp<0 goto explode_bomb` ，又到了性命攸关的时候，那么rsp里面是什么呢？
```
(gdb) x/6 $rsp
0x7fffffffe940:	1	1	4	5
0x7fffffffe950:	14	19	
```
看来是我们输入的数字，也就是说我们不可以输入负数。\
再接着，我们看到 `rbp` 被变成了 `rsp` 一样的内容，也就是输入的数字们，`ebx` 变成了1,进入了下面。\
顺着跳转到的位置往下看，到 `401685: je 401671 <phase_2+0x39>` ，我们发现下一行是 `explode_bomb` 因此我们必须在这里跳转。看其判断条件 ` 401682: cmp %eax,0x4(%rbp)` `rbp+4` 很明显就是下一个数字，那 `eax` 是什么呢？
```
  40167d:	89 d8                	mov    %ebx,%eax
  40167f:	03 45 00             	add    0x0(%rbp),%eax
```
我们发现每次 `eax` 都是复制的 `ebx`的值并加上 `*rbp`，即加上了我们输入的数字。这么看来，我们不想爆炸，只需要每次满足 `input[n]+ebx[n]=inpit[n+1],n=0..5` 。所以我们现在来找 `ebx` 变化规律。\
如果我们的炸弹没有爆炸，我们便跳转到
```
  401671:	83 c3 01             	add    $0x1,%ebx
  401674:	48 83 c5 04          	add    $0x4,%rbp
  401678:	83 fb 06             	cmp    $0x6,%ebx 
  40167b:	74 11                	je     40168e <phase_2+0x56>
```
这里先 `ebx+=1` ，又将 `rbp` 地址向后推4到下一个数字，最后比较 `ebx` 是否为6，是的话跳到 `40168e` 。这个地址的代码退出了这个函数，因此这就是退出条件。\
如果没有跳转，那我们就又回到了 `我们发现每次...` 这里的内容。现在我们知道了， `ebx` 就是循环变量。因此我们可以推出这六个数字规律：
```
num[x+1]=num[x]+x x=0..5
而且 num[0]>=0
```
那我们第一个数字取0,就可以得到答案 `0 1 3 6 10 15` 了。

# 0x4016aa phase_3
## 代码
```
00000000004016aa <phase_3>:
  4016aa:	f3 0f 1e fa          	endbr64
  4016ae:	48 83 ec 18          	sub    $0x18,%rsp
  4016b2:	64 48 8b 04 25 28 00 	mov    %fs:0x28,%rax
  4016b9:	00 00 
  4016bb:	48 89 44 24 08       	mov    %rax,0x8(%rsp)
  4016c0:	31 c0                	xor    %eax,%eax    // 清空eax
  4016c2:	48 8d 4c 24 04       	lea    0x4(%rsp),%rcx //rsp+4->eax
  4016c7:	48 89 e2             	mov    %rsp,%rdx      //rsp->rdx
  4016ca:	48 8d 35 5c 1d 00 00 	lea    0x1d5c(%rip),%rsi        # 40342d <array.0+0x28d>
  4016d1:	e8 4a fc ff ff       	call   401320 <__isoc99_sscanf@plt> format=0x40342d "%d %d"
  4016d6:	83 f8 01             	cmp    $0x1,%eax
  4016d9:	7e 1a                	jle    4016f5 <phase_3+0x4b>
  4016db:	83 3c 24 07          	cmpl   $0x7,(%rsp)
  4016df:	77 65                	ja     401746 <phase_3+0x9c>
  4016e1:	8b 04 24             	mov    (%rsp),%eax
  4016e4:	48 8d 15 95 1a 00 00 	lea    0x1a95(%rip),%rdx        # 403180 <_IO_stdin_used+0x180> 
  4016eb:	48 63 04 82          	movslq (%rdx,%rax,4),%rax
  4016ef:	48 01 d0             	add    %rdx,%rax
  4016f2:	3e ff e0             	notrack jmp *%rax // 0 -> 0x401752
  4016f5:	e8 5b 07 00 00       	call   401e55 <explode_bomb>
  4016fa:	eb df                	jmp    4016db <phase_3+0x31>
  4016fc:	b8 85 02 00 00       	mov    $0x285,%eax
  401701:	39 44 24 04          	cmp    %eax,0x4(%rsp) // *(rsp+4)!=eax!=bomb
  401705:	75 52                	jne    401759 <phase_3+0xaf>
  401707:	48 8b 44 24 08       	mov    0x8(%rsp),%rax
  40170c:	64 48 2b 04 25 28 00 	sub    %fs:0x28,%rax
  401713:	00 00 
  401715:	75 49                	jne    401760 <phase_3+0xb6>
  401717:	48 83 c4 18          	add    $0x18,%rsp
  40171b:	c3                   	ret
  40171c:	b8 69 00 00 00       	mov    $0x69,%eax
  401721:	eb de                	jmp    401701 <phase_3+0x57>
  401723:	b8 5b 02 00 00       	mov    $0x25b,%eax
  401728:	eb d7                	jmp    401701 <phase_3+0x57>
  40172a:	b8 32 00 00 00       	mov    $0x32,%eax
  40172f:	eb d0                	jmp    401701 <phase_3+0x57>
  401731:	b8 f3 01 00 00       	mov    $0x1f3,%eax
  401736:	eb c9                	jmp    401701 <phase_3+0x57>
  401738:	b8 8f 00 00 00       	mov    $0x8f,%eax
  40173d:	eb c2                	jmp    401701 <phase_3+0x57>
  40173f:	b8 0a 03 00 00       	mov    $0x30a,%eax
  401744:	eb bb                	jmp    401701 <phase_3+0x57>
  401746:	e8 0a 07 00 00       	call   401e55 <explode_bomb>
  40174b:	b8 00 00 00 00       	mov    $0x0,%eax
  401750:	eb af                	jmp    401701 <phase_3+0x57>
  401752:	b8 0f 01 00 00       	mov    $0x10f,%eax //271
  401757:	eb a8                	jmp    401701 <phase_3+0x57>
  401759:	e8 f7 06 00 00       	call   401e55 <explode_bomb>
  40175e:	eb a7                	jmp    401707 <phase_3+0x5d>
  401760:	e8 0b fb ff ff       	call   401270 <__stack_chk_fail@plt>
```
## 直接做
首先我们看要输入什么，在`4016d1`这里断点，用[老方法](#__isoc99_sscanf)知道是`%d %d`。\
接着比较`rax`，发现其范围是1至7,是保证匹配数量的，我的题目就两个我们全部匹配到。\
`4016e1: mov (%rsp),%eax`用老办法轻松发现 `rsp` 是我们输入的数字，现在`eax`就是我们输入的第一个数字了。\
然后再往下我们对 `rax` 进行了一系列运算，直到 `4016f2： notrack jmp *%rax` 我们一路向下看到这里，直接跳转到 `*rax` 了，那我们跳到那里了呢？\
很简单，我们随便输个第一个数字，例如0,然后 `(gdb) stepi` 观察跳转流程，发现到了 `0x401752` 这里，看代码把 `eax` 设为了271,然后前往了
```
  401701:	39 44 24 04          	cmp    %eax,0x4(%rsp) // *(rsp+4)!=eax!=bomb
  401705:	75 52                	jne    401759
```
`0x4(%rsp)`出现了很多次，就是下一个数字，和`eax`比较，不一样就炸，现在我们知道了，第二个数字就是271,结束。

# 0x4017a0 phase_4
## 代码
```
0000000000401765 <func4>: // x = 7;x>=0;x-- x in rdi
  401765:	f3 0f 1e fa          	endbr64
  401769:	b8 00 00 00 00       	mov    $0x0,%eax
  40176e:	85 ff                	test   %edi,%edi
  401770:	7e 2d                	jle    40179f <func4+0x3a>
  401772:	41 54                	push   %r12
  401774:	55                   	push   %rbp
  401775:	53                   	push   %rbx
  401776:	89 fb                	mov    %edi,%ebx
  401778:	89 f5                	mov    %esi,%ebp
  40177a:	89 f0                	mov    %esi,%eax
  40177c:	83 ff 01             	cmp    $0x1,%edi
  40177f:	74 19                	je     40179a <func4+0x35>
  401781:	8d 7f ff             	lea    -0x1(%rdi),%edi
  401784:	e8 dc ff ff ff       	call   401765 <func4>
  401789:	44 8d 24 28          	lea    (%rax,%rbp,1),%r12d
  40178d:	8d 7b fe             	lea    -0x2(%rbx),%edi
  401790:	89 ee                	mov    %ebp,%esi
  401792:	e8 ce ff ff ff       	call   401765 <func4>
  401797:	44 01 e0             	add    %r12d,%eax
  40179a:	5b                   	pop    %rbx
  40179b:	5d                   	pop    %rbp
  40179c:	41 5c                	pop    %r12
  40179e:	c3                   	ret
  40179f:	c3                   	ret

00000000004017a0 <phase_4>:
  4017a0:	f3 0f 1e fa          	endbr64
  4017a4:	48 83 ec 18          	sub    $0x18,%rsp
  4017a8:	64 48 8b 04 25 28 00 	mov    %fs:0x28,%rax
  4017af:	00 00 
  4017b1:	48 89 44 24 08       	mov    %rax,0x8(%rsp)
  4017b6:	31 c0                	xor    %eax,%eax
  4017b8:	48 89 e1             	mov    %rsp,%rcx
  4017bb:	48 8d 54 24 04       	lea    0x4(%rsp),%rdx
  4017c0:	48 8d 35 66 1c 00 00 	lea    0x1c66(%rip),%rsi        # 40342d <array.0+0x28d>
  4017c7:	e8 54 fb ff ff       	call   401320 <__isoc99_sscanf@plt> // %d %d
  4017cc:	83 f8 02             	cmp    $0x2,%eax
  4017cf:	75 0b                	jne    4017dc <phase_4+0x3c>
  4017d1:	8b 04 24             	mov    (%rsp),%eax  // 第二个数字 (unsigned)d2-2 <= 2 -> !bomb
  4017d4:	83 e8 02             	sub    $0x2,%eax    // 2 <= d2 <= 4
  4017d7:	83 f8 02             	cmp    $0x2,%eax
  4017da:	76 05                	jbe    4017e1 <phase_4+0x41>
  4017dc:	e8 74 06 00 00       	call   401e55 <explode_bomb>
  4017e1:	8b 34 24             	mov    (%rsp),%esi // 第二个数字
  4017e4:	bf 07 00 00 00       	mov    $0x7,%edi
  4017e9:	e8 77 ff ff ff       	call   401765 <func4>
  4017ee:	39 44 24 04          	cmp    %eax,0x4(%rsp) 
  4017f2:	75 15                	jne    401809 <phase_4+0x69>
  4017f4:	48 8b 44 24 08       	mov    0x8(%rsp),%rax
  4017f9:	64 48 2b 04 25 28 00 	sub    %fs:0x28,%rax
  401800:	00 00 
  401802:	75 0c                	jne    401810 <phase_4+0x70>
  401804:	48 83 c4 18          	add    $0x18,%rsp
  401808:	c3                   	ret
  401809:	e8 47 06 00 00       	call   401e55 <explode_bomb>
  40180e:	eb e4                	jmp    4017f4 <phase_4+0x54>
  401810:	e8 5b fa ff ff       	call   401270 <__stack_chk_fail@plt>
```
## 流程
`4017d1`之前的逻辑和上题一样，我懒得写了，反正就是要输入两个数字。
```  
  4017d1:	8b 04 24             	mov    (%rsp),%eax
  4017d4:	83 e8 02             	sub    $0x2,%eax 
  4017d7:	83 f8 02             	cmp    $0x2,%eax
  4017da:	76 05                	jbe    4017e1 <phase_4+0x41>
  4017dc:	e8 74 06 00 00       	call   401e55 <explode_bomb>
```
`eax`是第二个数字（不知道为什么的话可以直接输两个数字，然后观察，这里把两个数字倒过来了）。这里一通操作下来， `(unsigned)d2-2 <= 2 -> !bomb` 因此我们第二个数字的要求是 `2 <= d2 <= 4`，我们取3。\
然后我们进入了`func4`，太长，里面也没有可怕的 `explode_bomb`，说明这里只是做了点运算，我们跳过。\
接着我们看到除了`func4`后有
```
  4017ee:	39 44 24 04          	cmp    %eax,0x4(%rsp) 
  4017f2:	75 15                	jne    401809 <phase_4+0x69>
```
那我们可以直接下断点看`eax`是多少然后抄就好了。
## 速通
```
(gdb) break *0x4017ee
Breakpoint 2 at 0x4017ee
(gdb) c
Breakpoint 2, 0x00000000004017ee in phase_4 ()
(gdb) p/d $eax
$1 = 99
```
第一个数字99,结束。\
如果很不幸您的结果和fun4运行了多少次有关的话，请参见[fun7](#0x401a19-fun7)，一样的思路，一样的 `*2` 和 `*2+1`

# 0x401815 phase_5
## 代码
```
0000000000401815 <phase_5>:
  401815:	f3 0f 1e fa          	endbr64
  401819:	48 83 ec 18          	sub    $0x18,%rsp
  40181d:	64 48 8b 04 25 28 00 	mov    %fs:0x28,%rax
  401824:	00 00 
  401826:	48 89 44 24 08       	mov    %rax,0x8(%rsp)
  40182b:	31 c0                	xor    %eax,%eax
  40182d:	48 8d 4c 24 04       	lea    0x4(%rsp),%rcx
  401832:	48 89 e2             	mov    %rsp,%rdx
  401835:	48 8d 35 f1 1b 00 00 	lea    0x1bf1(%rip),%rsi        # 40342d <array.0+0x28d>
  40183c:	e8 df fa ff ff       	call   401320 <__isoc99_sscanf@plt> // %d %d
  401841:	83 f8 01             	cmp    $0x1,%eax
  401844:	7e 5a                	jle    4018a0 <phase_5+0x8b>
  401846:	8b 04 24             	mov    (%rsp),%eax  //第一个输入的数字
  401849:	83 e0 0f             	and    $0xf,%eax    
  40184c:	89 04 24             	mov    %eax,(%rsp)
  40184f:	83 f8 0f             	cmp    $0xf,%eax    //eax&0xF-0xF==0 ->bomb ->eax!=15
  401852:	74 32                	je     401886 <phase_5+0x71>
  401854:	b9 00 00 00 00       	mov    $0x0,%ecx
  401859:	ba 00 00 00 00       	mov    $0x0,%edx
  40185e:	48 8d 35 3b 19 00 00 	lea    0x193b(%rip),%rsi        # 4031a0 <array.0> 
  ----------------------------
  401865:	83 c2 01             	add    $0x1,%edx
  401868:	48 98                	cltq
  40186a:	8b 04 86             	mov    (%rsi,%rax,4),%eax // eax=4*rax+0x4031a0 所以第一个数字小于等于15 第一次是第一个数字，找14次到15
  40186d:	01 c1                	add    %eax,%ecx // ecx+=eax
  40186f:	83 f8 0f             	cmp    $0xf,%eax 
  401872:	75 f1                	jne    401865 <phase_5+0x50> // eax==15 继续 
  401874:	c7 04 24 0f 00 00 00 	movl   $0xf,(%rsp)
  40187b:	83 fa 0f             	cmp    $0xf,%edx
  40187e:	75 06                	jne    401886 <phase_5+0x71> //必须循环15次
  401880:	39 4c 24 04          	cmp    %ecx,0x4(%rsp) //ecx==第二个数字
  401884:	74 05                	je     40188b <phase_5+0x76>
  401886:	e8 ca 05 00 00       	call   401e55 <explode_bomb>
  40188b:	48 8b 44 24 08       	mov    0x8(%rsp),%rax
  401890:	64 48 2b 04 25 28 00 	sub    %fs:0x28,%rax
  401897:	00 00 
  401899:	75 0c                	jne    4018a7 <phase_5+0x92>
  40189b:	48 83 c4 18          	add    $0x18,%rsp
  40189f:	c3                   	ret
  4018a0:	e8 b0 05 00 00       	call   401e55 <explode_bomb>
  4018a5:	eb 9f                	jmp    401846 <phase_5+0x31>
  4018a7:	e8 c4 f9 ff ff       	call   401270 <__stack_chk_fail@plt>
```
## 提示
`array.0`长这样
```
0x4031a0 <array.0>:	    10  2	14	7
0x4031b0 <array.0+16>:	8  12	15 11
0x4031c0 <array.0+32>:	0   4	 1 13
0x4031d0 <array.0+48>:	3   9	 6	5
```
循环结构在
```
  401865:	83 c2 01             	add    $0x1,%edx
  401868:	48 98                	cltq
  40186a:	8b 04 86             	mov    (%rsi,%rax,4),%eax // eax=4*rax+0x4031a0 所以第一个数字小于等于15 第一次是第一个数字，找14次到15
  40186d:	01 c1                	add    %eax,%ecx // ecx+=eax
  40186f:	83 f8 0f             	cmp    $0xf,%eax 
  401872:	75 f1                	jne    401865 <phase_5+0x50> // eax==15 继续 
```
在*结束*时 `eax` 是上面array中下标为*进入循环时的* `eax` 的数字，为15的时后退出循环。然后 `ecx` 是除了第一次进入时以外的 `eax` 之和（可以后面设断点直接看是多少）， `edx`是标记进入了多少次循环的。\
简单来说就是
```C
int array[15] = {...}; // rsi
int i = array[input[0]]; // rax
int counter = 0; // edx
do{
    counter++;
    i = array[i];
}while(i!=15)
```
退出循环后
```
  401874:	c7 04 24 0f 00 00 00 	movl   $0xf,(%rsp)
  40187b:	83 fa 0f             	cmp    $0xf,%edx
  40187e:	75 06                	jne    401886 <phase_5+0x71> //必须循环15次
  401880:	39 4c 24 04          	cmp    %ecx,0x4(%rsp) //ecx==第二个数字
  401884:	74 05                	je     40188b <phase_5+0x76>
```
上面说过，`edx`是标记进入了多少次循环，说明要第15次退出，此时正好是15，向前推14次得到的数字就是第一个数字，第二个数字就是 `120-第一个数字`。

# 0x4018ac phase_6
## 代码
```
00000000004018ac <phase_6>:
  4018ac:	f3 0f 1e fa          	endbr64
  4018b0:	41 57                	push   %r15
  4018b2:	41 56                	push   %r14
  4018b4:	41 55                	push   %r13
  4018b6:	41 54                	push   %r12
  4018b8:	55                   	push   %rbp
  4018b9:	53                   	push   %rbx
  4018ba:	48 83 ec 78          	sub    $0x78,%rsp
  4018be:	64 48 8b 04 25 28 00 	mov    %fs:0x28,%rax
  4018c5:	00 00 
  4018c7:	48 89 44 24 68       	mov    %rax,0x68(%rsp)
  4018cc:	31 c0                	xor    %eax,%eax
  4018ce:	4c 8d 74 24 10       	lea    0x10(%rsp),%r14
  4018d3:	4c 89 74 24 08       	mov    %r14,0x8(%rsp)
  4018d8:	4c 89 f6             	mov    %r14,%rsi
  4018db:	e8 b7 05 00 00       	call   401e97 <read_six_numbers>
  4018e0:	4d 89 f4             	mov    %r14,%r12
  4018e3:	41 bf 01 00 00 00    	mov    $0x1,%r15d
  4018e9:	4d 89 f5             	mov    %r14,%r13
  4018ec:	e9 c6 00 00 00       	jmp    4019b7 <phase_6+0x10b> 
  4018f1:	e8 5f 05 00 00       	call   401e55 <explode_bomb>
  4018f6:	e9 ce 00 00 00       	jmp    4019c9 <phase_6+0x11d>
  >>>>>>>>>>>>>>>>>>>>>
  4018fb:	48 83 c3 01          	add    $0x1,%rbx 
  4018ff:	83 fb 05             	cmp    $0x5,%ebx
  401902:	0f 8f a7 00 00 00    	jg     4019af <phase_6+0x103> rbx>5 
  -------------------------
  401908:	41 8b 44 9d 00       	mov    0x0(%r13,%rbx,4),%eax  // rbx 循环变量， eax为第rbx个数字
  40190d:	39 45 00             	cmp    %eax,0x0(%rbp)
  401910:	75 e9                	jne    4018fb <phase_6+0x4f> // 不能连续两个数字一样
  401912:	e8 3e 05 00 00       	call   401e55 <explode_bomb>
  401917:	eb e2                	jmp    4018fb <phase_6+0x4f>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~  //这里开始
  401919:	48 8b 54 24 08       	mov    0x8(%rsp),%rdx 
  40191e:	48 83 c2 18          	add    $0x18,%rdx // rdx:数组末尾
  401922:	b9 07 00 00 00       	mov    $0x7,%ecx
  =====
  401927:	89 c8                	mov    %ecx,%eax
  401929:	41 2b 04 24          	sub    (%r12),%eax
  40192d:	41 89 04 24          	mov    %eax,(%r12)
  401931:	49 83 c4 04          	add    $0x4,%r12
  401935:	4c 39 e2             	cmp    %r12,%rdx
  401938:	75 ed                	jne    401927 <phase_6+0x7b>
  ====== // 每个数变成7-x_i
  40193a:	be 00 00 00 00       	mov    $0x0,%esi
  40193f:	8b 4c b4 10          	mov    0x10(%rsp,%rsi,4),%ecx // ecx是第rsi个数字
  401943:	b8 01 00 00 00       	mov    $0x1,%eax
  401948:	48 8d 15 e1 39 00 00 	lea    0x39e1(%rip),%rdx        # 405330 <node1> 
  40194f:	83 f9 01             	cmp    $0x1,%ecx
  401952:	7e 0b                	jle    40195f <phase_6+0xb3>
  401954:	48 8b 52 08          	mov    0x8(%rdx),%rdx // 进入下一个node
  401958:	83 c0 01             	add    $0x1,%eax
  40195b:	39 c8                	cmp    %ecx,%eax
  40195d:	75 f5                	jne    401954 <phase_6+0xa8>
  40195f:	48 89 54 f4 30       	mov    %rdx,0x30(%rsp,%rsi,8) // 结束时候的node
  401964:	48 83 c6 01          	add    $0x1,%rsi
  401968:	48 83 fe 06          	cmp    $0x6,%rsi
  40196c:	75 d1                	jne    40193f <phase_6+0x93>
  40196e:	48 8b 5c 24 30       	mov    0x30(%rsp),%rbx // rsp 是 node[7-x_i]
  401973:	48 8b 44 24 38       	mov    0x38(%rsp),%rax
  401978:	48 89 43 08          	mov    %rax,0x8(%rbx)
  40197c:	48 8b 54 24 40       	mov    0x40(%rsp),%rdx
  401981:	48 89 50 08          	mov    %rdx,0x8(%rax)
  401985:	48 8b 44 24 48       	mov    0x48(%rsp),%rax
  40198a:	48 89 42 08          	mov    %rax,0x8(%rdx)
  40198e:	48 8b 54 24 50       	mov    0x50(%rsp),%rdx
  401993:	48 89 50 08          	mov    %rdx,0x8(%rax)
  401997:	48 8b 44 24 58       	mov    0x58(%rsp),%rax
  40199c:	48 89 42 08          	mov    %rax,0x8(%rdx)
  4019a0:	48 c7 40 08 00 00 00 	movq   $0x0,0x8(%rax)
  4019a7:	00 
  4019a8:	bd 05 00 00 00       	mov    $0x5,%ebp
  4019ad:	eb 35                	jmp    4019e4 <phase_6+0x138>
  >>>>>>>>>>>>>>>>>>>>
  4019af:	49 83 c7 01          	add    $0x1,%r15
  4019b3:	49 83 c6 04          	add    $0x4,%r14
  4019b7:	4c 89 f5             	mov    %r14,%rbp
  4019ba:	41 8b 06             	mov    (%r14),%eax 
  4019bd:	83 e8 01             	sub    $0x1,%eax // 第x个数字 -1 > 5 -> bomb| 1 <= x1 <= 6
  4019c0:	83 f8 05             	cmp    $0x5,%eax
  4019c3:	0f 87 28 ff ff ff    	ja     4018f1 <phase_6+0x45>
  4019c9:	41 83 ff 05          	cmp    $0x5,%r15d // r15 > 5
  4019cd:	0f 8f 46 ff ff ff    	jg     401919 <phase_6+0x6d>
  4019d3:	4c 89 fb             	mov    %r15,%rbx
  4019d6:	e9 2d ff ff ff       	jmp    401908 <phase_6+0x5c>
  ------------------------
  4019db:	48 8b 5b 08          	mov    0x8(%rbx),%rbx
  4019df:	83 ed 01             	sub    $0x1,%ebp
  4019e2:	74 11                	je     4019f5 <phase_6+0x149>
  4019e4:	48 8b 43 08          	mov    0x8(%rbx),%rax
  4019e8:	8b 00                	mov    (%rax),%eax // eax 是下一个 node 
  4019ea:	39 03                	cmp    %eax,(%rbx) // node[x_i] >= node[x_i+1]
  4019ec:	7d ed                	jge    4019db <phase_6+0x12f> // 每一个node要比下一个大
  4019ee:	e8 62 04 00 00       	call   401e55 <explode_bomb>
  4019f3:	eb e6                	jmp    4019db <phase_6+0x12f>
  4019f5:	48 8b 44 24 68       	mov    0x68(%rsp),%rax
  4019fa:	64 48 2b 04 25 28 00 	sub    %fs:0x28,%rax
  401a01:	00 00 
  401a03:	75 0f                	jne    401a14 <phase_6+0x168>
  401a05:	48 83 c4 78          	add    $0x78,%rsp
  401a09:	5b                   	pop    %rbx
  401a0a:	5d                   	pop    %rbp
  401a0b:	41 5c                	pop    %r12
  401a0d:	41 5d                	pop    %r13
  401a0f:	41 5e                	pop    %r14
  401a11:	41 5f                	pop    %r15
  401a13:	c3                   	ret
  401a14:	e8 57 f8 ff ff       	call   401270 <__stack_chk_fail@plt>
```
## 解析
首先`node`长这样
```
0x405330 <node1>:	821	0	1	0	21312	64	0	0
0x405340 <node2>:	620	0	2	0	21328	64	0	0
0x405350 <node3>:	348	0	3	0	21344	64	0	0
0x405360 <node4>:	797	0	4	0	21360	64	0	0
0x405370 <node5>:	456	0	5	0	21008	64	0	0
0x405210 <node6>:	398	0	6	0	21344	64	0	0
```
第一步：`4018db:call 401e97 <read_six_numbers>` 说白了就是读了6个数字
第二步：检查是否有连续一样的数字，并把每一个数字 `x` 变成 `7-x` （详见代码里面的注释）
第三步：
```
  4019db:	48 8b 5b 08          	mov    0x8(%rbx),%rbx
  4019df:	83 ed 01             	sub    $0x1,%ebp // ebp初始值为5，强制您循环5次，一直不爆炸就过
  4019e2:	74 11                	je     4019f5 <phase_6+0x149>
  4019e4:	48 8b 43 08          	mov    0x8(%rbx),%rax
  4019e8:	8b 00                	mov    (%rax),%eax // eax 是下一个 node 
  4019ea:	39 03                	cmp    %eax,(%rbx) // node[x_i] >= node[x_i+1]
  4019ec:	7d ed                	jge    4019db <phase_6+0x12f> // 每一个node要比下一个大
  4019ee:	e8 62 04 00 00       	call   401e55 <explode_bomb>
```
看完注释，只要第二步后 `node[new_num]>=node[new_num+1]` 就可以了。也就是说我们把`node`的值从大到小排序(`1 4 2 5 6 3`)，然后用7减去每一个序号就是答案`6 3 5 2 1 4`。

# 0x401a5a secret_phase
## 进入
整个代码里在其自己外，只有
```
0000000000402014 <phase_defused>:
  402014:	f3 0f 1e fa          	endbr64
  402018:	48 83 ec 78          	sub    $0x78,%rsp
  40201c:	64 48 8b 04 25 28 00 	mov    %fs:0x28,%rax
  402023:	00 00 
  402025:	48 89 44 24 68       	mov    %rax,0x68(%rsp)
  40202a:	31 c0                	xor    %eax,%eax
  40202c:	bf 01 00 00 00       	mov    $0x1,%edi
  402031:	e8 2d fd ff ff       	call   401d63 <send_msg>
  402036:	83 3d d3 37 00 00 06 	cmpl   $0x6,0x37d3(%rip)        # 405810 <num_input_strings> // 解决phase数
  40203d:	74 19                	je     402058 <phase_defused+0x44>
  40203f:	48 8b 44 24 68       	mov    0x68(%rsp),%rax
  402044:	64 48 2b 04 25 28 00 	sub    %fs:0x28,%rax
  40204b:	00 00 
  40204d:	0f 85 84 00 00 00    	jne    4020d7 <phase_defused+0xc3>
  402053:	48 83 c4 78          	add    $0x78,%rsp
  402057:	c3                   	ret
  402058:	48 8d 4c 24 0c       	lea    0xc(%rsp),%rcx
  40205d:	48 8d 54 24 08       	lea    0x8(%rsp),%rdx
  402062:	4c 8d 44 24 10       	lea    0x10(%rsp),%r8
  402067:	48 8d 35 09 14 00 00 	lea    0x1409(%rip),%rsi        # 403477 <array.0+0x2d7>
  40206e:	48 8d 3d 9b 38 00 00 	lea    0x389b(%rip),%rdi        # 405910 <input_strings+0xf0>
  402075:	b8 00 00 00 00       	mov    $0x0,%eax
  40207a:	e8 a1 f2 ff ff       	call   401320 <__isoc99_sscanf@plt> s=0x405910 <input_strings+240> "99 3"(第四个), format=0x403477 "%d %d %s"
  40207f:	83 f8 03             	cmp    $0x3,%eax 
  402082:	74 1a                	je     40209e <phase_defused+0x8a> // DrEvil
  402084:	48 8d 3d ad 12 00 00 	lea    0x12ad(%rip),%rdi        # 403338 <array.0+0x198>
  40208b:	e8 b0 f1 ff ff       	call   401240 <puts@plt>
  402090:	48 8d 3d d1 12 00 00 	lea    0x12d1(%rip),%rdi        # 403368 <array.0+0x1c8>
  402097:	e8 a4 f1 ff ff       	call   401240 <puts@plt>
  40209c:	eb a1                	jmp    40203f <phase_defused+0x2b>
  40209e:	48 8d 7c 24 10       	lea    0x10(%rsp),%rdi
  4020a3:	48 8d 35 d6 13 00 00 	lea    0x13d6(%rip),%rsi        # 403480 <array.0+0x2e0>
  4020aa:	e8 b7 fa ff ff       	call   401b66 <strings_not_equal>
  4020af:	85 c0                	test   %eax,%eax
  4020b1:	75 d1                	jne    402084 <phase_defused+0x70>
  4020b3:	48 8d 3d 1e 12 00 00 	lea    0x121e(%rip),%rdi        # 4032d8 <array.0+0x138>
  4020ba:	e8 81 f1 ff ff       	call   401240 <puts@plt>
  4020bf:	48 8d 3d 3a 12 00 00 	lea    0x123a(%rip),%rdi        # 403300 <array.0+0x160>
  4020c6:	e8 75 f1 ff ff       	call   401240 <puts@plt>
  4020cb:	b8 00 00 00 00       	mov    $0x0,%eax
  4020d0:	e8 85 f9 ff ff       	call   401a5a <secret_phase>
  4020d5:	eb ad                	jmp    402084 <phase_defused+0x70>
  4020d7:	e8 94 f1 ff ff       	call   401270 <__stack_chk_fail@plt>
```
可以进入secret_phase，在 `402082: je 40209e` 我们找到了能到secret_phase的地方，进入条件来自 `__isoc99_sscanf` 输入的字符串，然后 `4020aa: call 401b66 <strings_not_equal>` 进行比较。但是我们一直没有输入字符串，因此[故技](#__isoc99_sscanf)重施，发现 `input_strings` 和我们第四关输入的字符串不能说是一模一样，只能说是就是一个东西（其实地址是一样的），只是后面多匹配一个 `%s`。那我们就多输个东西，然后到 `strings_not_equal`， 再次使用[phase_1的方法](#0x401b66-strings_not_equal)，得到字符串 `DrEvil`（你的不一定是） ，进入第七关。

## 代码
```
0000000000401a5a <secret_phase>:
  401a5a:	f3 0f 1e fa          	endbr64
  401a5e:	53                   	push   %rbx
  401a5f:	e8 78 04 00 00       	call   401edc <read_line>
  401a64:	48 89 c7             	mov    %rax,%rdi
  401a67:	ba 0a 00 00 00       	mov    $0xa,%edx
  401a6c:	be 00 00 00 00       	mov    $0x0,%esi
  401a71:	e8 8a f8 ff ff       	call   401300 <strtol@plt>
  401a76:	89 c3                	mov    %eax,%ebx
  401a78:	83 e8 01             	sub    $0x1,%eax
  401a7b:	3d e8 03 00 00       	cmp    $0x3e8,%eax // eax - 1 > 1000 -> bomb
  401a80:	77 26                	ja     401aa8 <secret_phase+0x4e>
  401a82:	89 de                	mov    %ebx,%esi
  401a84:	48 8d 3d c5 37 00 00 	lea    0x37c5(%rip),%rdi        # 405250 <n1>
  401a8b:	e8 89 ff ff ff       	call   401a19 <fun7>
  401a90:	83 f8 05             	cmp    $0x5,%eax
  401a93:	75 1a                	jne    401aaf <secret_phase+0x55>
  401a95:	48 8d 3d 44 17 00 00 	lea    0x1744(%rip),%rdi        # 4031e0 <array.0+0x40>
  401a9c:	e8 9f f7 ff ff       	call   401240 <puts@plt>
  401aa1:	e8 6e 05 00 00       	call   402014 <phase_defused>
  401aa6:	5b                   	pop    %rbx
  401aa7:	c3                   	ret
  401aa8:	e8 a8 03 00 00       	call   401e55 <explode_bomb>
  401aad:	eb d3                	jmp    401a82 <secret_phase+0x28>
  401aaf:	e8 a1 03 00 00       	call   401e55 <explode_bomb>
  401ab4:	eb df                	jmp    401a95 <secret_phase+0x3b>
```
其中`n1`长这样的,42开头好像地址啊，难道不是吗（如果用`wh`打印肯定一眼看出来是地址了）
```
0x405250 <n1>:	36	0	4215408	0
0x405260 <n1+16>:	4215440	0	0	0
0x405270 <n21>:	8	0	4215536	0
0x405280 <n21+16>:	4215472	0	0	0
0x405290 <n22>:	50	0	4215504	0
0x4052a0 <n22+16>:	4215568	0	0	0
0x4052b0 <n32>:	22	0	4215216	0
0x4052c0 <n32+16>:	4215152	0	0	0
0x4052d0 <n33>:	45	0	4215056	0
0x4052e0 <n33+16>:	4215248	0	0	0
0x4052f0 <n31>:	6	0	4215088	0
0x405300 <n31+16>:	4215184	0	0	0
0x405310 <n34>:	107	0	4215120	0
0x405320 <n34+16>:	4215280	0	0	0
```
`secret_phase`本身没有好看的，
```
  401a8b:	e8 89 ff ff ff       	call   401a19 <fun7>
  401a90:	83 f8 05             	cmp    $0x5,%eax
```
之后就要么炸了要么过了，因此我们看看fun7和eax之间的关系。
# 0x401a19 fun7
```
0000000000401a19 <fun7>:
  401a19:	f3 0f 1e fa          	endbr64
  401a1d:	48 85 ff             	test   %rdi,%rdi
  401a20:	74 32                	je     401a54 <fun7+0x3b>
  401a22:	48 83 ec 08          	sub    $0x8,%rsp
  401a26:	8b 17                	mov    (%rdi),%edx
  401a28:	39 f2                	cmp    %esi,%edx //esi 输入的数字 
  401a2a:	7f 0c                	jg     401a38 <fun7+0x1f> // edx > esi
  401a2c:	b8 00 00 00 00       	mov    $0x0,%eax
  401a31:	75 12                	jne    401a45 <fun7+0x2c>
  401a33:	48 83 c4 08          	add    $0x8,%rsp
  401a37:	c3                   	ret
  401a38:	48 8b 7f 08          	mov    0x8(%rdi),%rdi
  401a3c:	e8 d8 ff ff ff       	call   401a19 <fun7>
  401a41:	01 c0                	add    %eax,%eax
  401a43:	eb ee                	jmp    401a33 <fun7+0x1a>
  401a45:	48 8b 7f 10          	mov    0x10(%rdi),%rdi
  401a49:	e8 cb ff ff ff       	call   401a19 <fun7>
  401a4e:	8d 44 00 01          	lea    0x1(%rax,%rax,1),%eax // rax = rax*2+1, 目标 5
  401a52:	eb df                	jmp    401a33 <fun7+0x1a>
  401a54:	b8 ff ff ff ff       	mov    $0xffffffff,%eax
  401a59:	c3                   	ret
```
fun7里面很多call,是在递归调用。我们从头看，`401a26: mov (%rdi),%edx`这里我们可以通过目测法发现是node的值（第一个数字），`jg`跳转的话进入流程
```
  401a38:	48 8b 7f 08          	mov    0x8(%rdi),%rdi
  401a3c:	e8 d8 ff ff ff       	call   401a19 <fun7>
  401a41:	01 c0                	add    %eax,%eax // rax*=2
```
否则
```
  401a2c:	b8 00 00 00 00       	mov    $0x0,%eax
```
而且如果还不等于的话，会**接着**执行
```
  401a45:	48 8b 7f 10          	mov    0x10(%rdi),%rdi
  401a49:	e8 cb ff ff ff       	call   401a19 <fun7>
  401a4e:	8d 44 00 01          	lea    0x1(%rax,%rax,1),%eax // rax = rax*2+1, 目标 5
  401a52:	eb df                	jmp    401a33 <fun7+0x1a>
```

那么就说，我们可以知道这段代码类似
```C
typedef struct Node{
    int value;
    struct Node* l; //是+8处地址
    struct Node* r; //是+16处地址
}node;

int val = 114514; // 代表这个初值不是0

fun7(int input){
    if (node->value > input){
        node = node-> l;
        fun7(input);
        val *= 2;
    }else{
        val = 0;
        if (node->value != input){
            node = node-> r;
            fun7(input);
            val *= 2;
            val += 1;
        }
    }
}
```
自底向上的推导，我们要奇数，最后一定是`*2+1`,要偶数，那就是`*2`，因此我们推回到0,就知道是`0 1 2 5`这样的了，也就是比第一个数字大，比第二个小，比第三个大。考虑到我们要终止，所以要和第四个一样。我们推导四次就得到了结果。

# Misc
## __isoc99_sscanf
[man sscanf](https://man7.org/linux/man-pages/man3/sscanf.3.html)\
返回`str`匹配到了n个`format`(详见RETURN VALUE)\
调试时可以看到
```
(gdb) break __isoc99_sscanf
Breakpoint 2 at 0x7ffff7c62250: file ./stdio-common/isoc99_sscanf.c, line 24.
(gdb) c
Breakpoint 2, __GI___isoc99_sscanf (s=0x405870 <input_strings+80> "0 1 3 6 10 15", format=0x403421 "%d %d %d %d %d %d") at ./stdio-common/isoc99_sscanf.c:24
```
第一个`s`是输入的字符串，`format`是格式字符串。