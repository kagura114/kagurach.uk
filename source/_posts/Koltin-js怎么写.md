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