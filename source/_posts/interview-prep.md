---
title: 面筋
date: 2025/04/09 19:30
tags: ["生存学"]
category: 生活
---

面筋

<!-- more -->



# 面筋  
*ChatGPT 总结整理，含 Java 算法题参考*



## 一、简历 & 项目经历  
- 展示项目代码  
- 项目背景 & 技术选型（如使用 `Jetpack Compose` 的原因）  
- `BroadcastReceiver` 如何监听短信，如何处理被杀进程  
- `Service` 崩溃怎么办？有没有重启机制？  
- 团队分工、性能优化经验：如何解决 `高内存占用`  
- Compose 中 UI 刷新机制，`Lambda` 传递回调的设计考量  



## 二、Kotlin & 协程  
- `Kotlin vs Java`：语法简洁性、空安全、扩展函数等  
- `async` vs `launch`  
- 协程生命周期管理（使用 `CoroutineScope`, `Job`, `Lifecycle-aware`）  
- `Structured concurrency`，避免内存泄漏  
- `withContext()` vs `async/await` 线程调度差异  
- Kotlin 2.0 特性提及：`K2 Compiler`，`KSP break`  
- 协程并发实现机制（调度器调度，可能是时间片轮转）



## 三、Jetpack Compose  
- Compose 相比传统 XML 的优势：声明式、可组合、测试友好  
- `LazyColumn` 性能优化方式（如 `remember`, `key`）  
- 状态提升 & 状态管理：`remember`, `mutableStateOf`, `LaunchedEffect`  



## 四、算法 & 编码题（Java 实现推荐）

### 1. 最长不重复子串  
```java
public int lengthOfLongestSubstring(String s) {
    Set<Character> set = new HashSet<>();
    int left = 0, max = 0;
    for (int right = 0; right < s.length(); right++) {
        while (!set.add(s.charAt(right))) {
            set.remove(s.charAt(left++));
        }
        max = Math.max(max, right - left + 1);
    }
    return max;
}
```



### 2. 岛屿数量  
```java
public int numIslands(char[][] grid) {
    int count = 0;
    for (int i = 0; i < grid.length; i++)
        for (int j = 0; j < grid[0].length; j++)
            if (grid[i][j] == '1') {
                dfs(grid, i, j);
                count++;
            }
    return count;
}
void dfs(char[][] grid, int i, int j) {
    if (i < 0 || j < 0 || i >= grid.length || j >= grid[0].length || grid[i][j] == '0') return;
    grid[i][j] = '0';
    dfs(grid, i + 1, j); dfs(grid, i - 1, j);
    dfs(grid, i, j + 1); dfs(grid, i, j - 1);
}
```



### 3. 买卖股票（含多次、手续费）  
```java
public int maxProfit(int[] prices, int fee) {
    int cash = 0, hold = -prices[0];
    for (int i = 1; i < prices.length; i++) {
        cash = Math.max(cash, hold + prices[i] - fee);
        hold = Math.max(hold, cash - prices[i]);
    }
    return cash;
}
```



### 4. 金条分割问题、汽水瓶、乒乓球策略题  
这些题是**逻辑思维题**，通常考察贪心 + 倒推思路  
- 金条分割（用 1,2,4 金条组合） => 二进制模拟
- 汽水瓶换饮料（每3个瓶换1瓶） => 模拟 + 递归
- 乒乓球第 100 个：每轮取和为 6，先手赢（100 % (1+5) = 1，先手必胜）



### 5. 字符串组合（字符不能连续）
> 这个我说一下题目是这样的
  字符串 `source="hsellolll",target = "hello"`，这样，这个题目有点抽象（不太好理解）的，当时也没给我看懂  
  就是用的顺序可以任意  
  思路是记录字母出现的位置 + 回溯 之类

```java
public boolean canForm(String source, String target) {
    Map<Character, Integer> map = new HashMap<>();
    for (char c : source.toCharArray()) map.put(c, map.getOrDefault(c, 0) + 1);
    for (int i = 0; i < target.length(); i++) {
        char c = target.charAt(i);
        if (i > 0 && target.charAt(i) == target.charAt(i - 1)) return false;
        if (map.getOrDefault(c, 0) == 0) return false;
        map.put(c, map.get(c) - 1);
    }
    return true;
}
```



## 五、系统 & 性能优化  
- 如何检测与防止内存泄漏（`LeakCanary`, `StrictMode`）  
- Android 的 `GC 原理`、分析工具（`Android Profiler`, `MAT`）  
- 加载大图：使用 `inSampleSize`, `BitmapFactory.Options`  
- `RecyclerView` 缓存机制（四级缓存）  
- 图片加载库（`Glide`, `Coil`），如何优化内存与加载速度  



## 六、测试开发（TikTok 电商测开）  
- 常见测试方法与理论：`黑盒 / 白盒测试`，举例说明  
- 场景测试题：如微信聊天界面  
- 用户白屏如何排查：前端 vs 后端  
- `OSI 七层模型`，打开网页过程  
- SQL 并表查询（问到了）  
- Java 源码：`HashMap` 原理，红黑树转化阈值  



## 七、八股题 & 基础知识  
- Android 四大组件，Service 的默认线程  
- `Handler` 与 `MessageQueue` 工作机制  
- `RecyclerView` 与 `ListView` 区别与优化  
- 设计模式（工厂/单例/观察者）  
- 注解处理原理  
- JNI & C++（是否掌握）  



## 八、职业规划 & 软性问题  
- 项目评分标准（适配性、不卡顿、不 OOM）  
- 使用大模型辅助开发的经验  
- 对 `LLM`、`KVM on Android` 等技术的关注  
- 学习方法 & 英语（六级分数）  
- 上一段实习内容 & 未来职业规划  
