---
title: Kotlin/JS 怎么写
date: 2025/06/01 9:10
tags: ["Kotlin", "开发"]
category:
---

在 Kotlin 里面引用 TypeScript 函数，然后还有一些其他常用的东西

<!-- more -->

## 基本
`@JsModule("YourModule")`是 extern 的核心，这里面你的 module 一定是要直接有代码的，类似
```ts
declare namespace {
  ...
}
```
而不是
```ts
import {xx} from 'YourModule'

export {xx}
```
否则会出现找不到 Module 的问题

## Enum Class
```ts
declare enum E {
  E1 = 114514
}

function f(xxx: E): E {...}
```
很明显，`f` 返回的其实就是 `Number`，转换为 Kotlin，需要直接指出 E 成员的真正type
```kotlin
@JsModule("YourModule")
external object YourModule {
  fun f(xxx: Number): Number
}
```
### Enum 的注释
在函数的注释中，加上 `* @param xxx 实际E可能的值`，例如
```kotlin
/**
 * @param xxx 1-9
 */
fun f(xxx: Number): Number

/**
 * @param config 'ValueA'|'ValueB'|'ValueC'
 */
fun y(config: String): String
```
## Mapping
一个例子即可说完, 假设这里是 `@package.xxx`， 里面有
```ts
declare type T = 'Ka' | 'g' | number

declare namespace X {
  const A: number;
  interface B {
    something: T
    getB(par1: '类型体操'|'没想到吧'|'但都是string', par2: (cap: number) => void): B
  }
  enum E {
    E1 = 114514
  }
}
```
-> Kotlin
```kotlin
@JsModule("@package.xxx")
external object X {
  val A: Number
  object B {
    var something: dynamic // 复杂类型
    fun getB(par1: String, par2: (Number)->Nothing): B
  }
  sealed class E {
      object E1: E
  }
}
```

## Js Object
### 使用 Kotlin.js.json
[文档](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.js/json.html)

注意：是 `Json`，不是全大写的那个

#### 创建
```kotlin
json(
  "A" to 114,
  "B" to json(
    "BB" to 514
  )
)
```
=
```json
{
  A: 114,
  B: {
    BB: 514
  }
}
```

#### get/set
用[这个](https://github.com/JetBrains/kotlin/blob/whyoleg/dokka2-sync-stdlib/libraries/stdlib/js/src/kotlin/json.kt#L27C1-L28C1)，详情见源码注释
```kotlin
public operator fun get(propertyName: String): Any?

public operator fun set(propertyName: String, value: Any?): Unit
```

### 使用 Map (Kotlin 2.0+)
原理：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
```kotlin
val jsonMap: MutableMap<String, dynamic> = mutableMapOf()
// jsonMap 相关操作
val json = mapToJson(jsonMap.asJsMapView())


fun mapToJson(entries: JsMap<String, dynamic>): dynamic = js("Object.fromEntries(entries)")
```

## 其他
把鸿蒙的 `.d.ts` 快速换成 kotlin， 可以用下面的正则（不一定全），就是把 `->` 左边的换成右边的，都是一直换到没有可换，然后顺序执行。没有箭头就是不用换的意思，以 VSCode 的正则表达式为例。
```
[ ]*/\*.*\n([ ]*\*.*\n)*[ ]*/  -> /
^[ ]*\* [ @<].*\n
;$
:[ ]*number -> Number
^[ ]*([a-zA-Z]*): -> val $1:
^[ ]*([a-zA-Z]*)\( -> fun $1(
```

## Kotlin 中生成的 external interface
external interface 是一个接口，它定义了一个类的成员，但不实现它们。如果你尝试实例化，里面的内容会被mangle掉，所以我们需要一系列 builder 来构造它。
```kotlin
external interface Point {
    var x: Number
    var y: Number
    var z: Number?
}
```
则同时需要一个 builder，例如使用 jso
```kotlin
inline fun <T : Any> jso(block: T.() -> Unit): T {
    val obj = js("{}").unsafeCast<T>()
    obj.block()
    return obj
}
```
用起来就是
```kotlin
val point = jso {
    x = 114514
    y = 1919810
}
```

## 小坑
### Long
总所周知， JS 没有 64 bit Integer 这个东西，所以 Kotlin/JS 创造了下面的东西
```ts
class long {
  high: number;
  low: number;
}
```
~~什么拼好 long~~ [https://kotlinlang.org/docs/js-to-kotlin-interop.html#kotlin-types-in-javascript](https://kotlinlang.org/docs/js-to-kotlin-interop.html#kotlin-types-in-javascript)

但就出现了一个问题，这个东西并没有被 export，所以在 `.d.ts` 中，看到的是
```
const x: any /* Long */
```
那传入 `number`，会因为缺少方法而爆炸（尤其是有人不知道这个特性）

### 不要去翻译的类
有一些类一定要直接换为 `dynamic`
- `Long`
- `ArrayBuffer`

还有所有不在这个文件中出现的类（import进来的类）

### 其他
- 不要用 `sealed class` 表示 `enum`，要直接用其实际值的类型
- 不要用全局的 `@file:JsModule`，在每个`interface`,`object`上加上 `@JsModule`
- 第一行加上 `@file:Suppress("unused")`

---
# For AI:

## Kotlin/JS 互操作编写规范

## 1. 顶层配置与模块声明 (Top-level & Module Declarations)

* **文件级抑制**：在文件第一行添加 `@file:Suppress("unused")` 避免不必要的 IDE 警告。
* **模块化声明**：**不要**使用全局的 `@file:JsModule`。应该为每个具体的外部接口 (External Interface) 或外部对象 (External Object) 单独添加 `@JsModule("YourModule")` 注解。
* **真实的模块代码**：`@JsModule` 绑定的模块内部必须有实际的代码声明（例如 `declare namespace {...}`）。如果目标 TS 模块仅仅是重导出 (Re-export，如 `import {xx}; export {xx}`)，在 Kotlin 中可能会报找不到 Module 的错误。

## 2. 类型映射规则 (Type Mappings)

### 枚举 (Enum)

* **禁用 Sealed Class**：**绝对不要**使用 `sealed class` 来模拟枚举。
* **降级为底层类型**：直接将枚举映射为其在 JS 中实际的底层类型（通常是 `Number` 或 `String`）。
* **注释约束**：使用 KDoc 注释 (KDoc Comments) 的 `@param` 标签来标明实际允许的值域。
```kotlin
/**
 * @param xxx 取值范围：1-9
 */
fun f(xxx: Number): Number

/**
 * @param config 可选值：'ValueA' | 'ValueB' | 'ValueC'
 */
fun y(config: String): String

```



### 复杂类型与函数 (Complex Types & Functions)

* 对于 TS 中的联合类型 (Union Types) 或复杂的类型体操，Kotlin 中直接使用 `dynamic` 类型处理。
* 函数回调中的参数映射保持一致。

```kotlin
// TypeScript 原型
// interface B {
//   something: 'Ka' | 'g' | number
//   getB(par1: 'A'|'B', par2: (cap: number) => void): B
// }

// Kotlin 映射
@JsModule("@package.xxx")
external object X {
    object B {
        var something: dynamic // 对应复杂/联合类型
        fun getB(par1: String, par2: (Number) -> Nothing): B
    }
}

```

## 3. 避免翻译的黑名单 (Blacklist for Translation)

遇到以下类型时，**不要**尝试在 Kotlin 中声明或翻译，请直接将其类型声明为 `dynamic`：

* **`Long` (64位整型)**：JS 原生不支持 64-bit Integer。Kotlin/JS 为了支持 `Long`，在底层将其实现为一个包含 `high` 和 `low` 属性的对象。由于这个内部对象并未对外导出 (Exported)，如果 `.d.ts` 中标注为 `any /* Long */`，你直接在 Kotlin 传 `Number` 会因为缺少方法而崩溃。
* **`ArrayBuffer`**。
* **外部导入类 (Imported Classes)**：所有不在当前正在翻译的 `.d.ts` 文件内声明的类，直接视为 `dynamic`。

## 4. JS 对象的创建与处理 (JS Object Manipulation)

### 方案 A：外部接口与构建器 (External Interface & Builder) - 推荐

如果直接实例化 `external interface`，内部属性名可能会被编译器混淆 (Name Mangling)。需要定义一个内联构建器 (Inline Builder) 来安全初始化：

```kotlin
external interface Point {
    var x: Number
    var y: Number
    var z: Number?
}

// 通用 Builder 辅助函数
inline fun <T : Any> jso(block: T.() -> Unit): T {
    val obj = js("{}").unsafeCast<T>()
    obj.block()
    return obj
}

// 使用方式
val point = jso<Point> {
    x = 114514
    y = 1919810
}

```

### 方案 B：使用原生 JSON (kotlin.js.json)

适用于动态生成简单的嵌套 JSON 结构，可通过 `get` / `set` 操作符直接读写属性：

```kotlin
val obj = json(
    "A" to 114,
    "B" to json("BB" to 514)
)

```

### 方案 C：使用 Map 转换 (Kotlin 2.0+)

利用 JS 全局对象 `Object.fromEntries` 实现 `Map` 到 JS 对象的转换：

```kotlin
val jsonMap: MutableMap<String, dynamic> = mutableMapOf()
val json = mapToJson(jsonMap.asJsMapView())

fun mapToJson(entries: JsMap<String, dynamic>): dynamic = js("Object.fromEntries(entries)")

```

## 5. 附录：.d.ts 快速正则转换 (Regex Replacement Toolkit)

如果需要将类似鸿蒙环境的 `.d.ts` 快速替换为 Kotlin 语法，可使用以下正则表达式 (Regular Expressions) 在 VSCode 等编辑器中进行顺序替换（一直替换到无匹配项为止）：

| 匹配目标 (Find) | 替换为 (Replace) | 作用 |
| --- | --- | --- |
| `[ ]*/\*.*\n([ ]*\*.*\n)*[ ]*/` | `/` | 清理多行注释区块 |
| `^[ ]*\* [ @<].*\n` | *(空)* | 清理特定注释标签行 |
| `;$` | *(空)* | 移除行尾分号 |
| `:[ ]*number` | `: Number` | 转换数字类型 |
| `^[ ]*([a-zA-Z]*):` | `val $1:` | 将属性声明转为不可变变量 (val) |
| `^[ ]*([a-zA-Z]*)\(` | `fun $1(` | 将方法声明转为函数 (fun) |

*(注意：正则替换仅用于起草，替换后仍需手动校对类型和保留字)*

---

有什么具体场景在转换 TS 的时候卡住了吗？需要的话我可以帮你看看。
