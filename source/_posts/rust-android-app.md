---
title: 怎么用 Rust 写一个安卓程序
date: 2025/09/28 11:45
tags: ["Android"]
category: 折腾
---

看到 example 里面的代码，现在连编译都过不了，rust mobile 的未来令人感叹

<!-- more -->

示例：[Native Drawer](https://github.com/icewithcola/NativeDrawer)

来自 [https://github.com/andraantariksa/wgpu-winit-android-example](https://github.com/andraantariksa/wgpu-winit-android-example)，改成使用了更新的 `jni`, `ndk`，还使用了 2024 edition

## 配置环境
万事开头难，这玩意的环境配置更难，随着 Rust Mobile 的发展，帮助打包、NDK Binding、各种各样的库是一种 **勃勃生机，万物竞发** 的态势。最后我还是选择了 `cargo-ndk`

[cargo-ndk](https://github.com/bbqsrc/cargo-ndk) 相比其他构架工具或者手写脚本，方便很多，nix 也有打好的包，而且不像 `cargo-apk` 那样会帮你把 apk 打包好，只生成 .so 更灵活一些

|工具|结果|
|----|----|
|cargo-ndk|能用，好用|
|cargo-apk|也不是不能用，但不好用|
|just/脚本|一写一个不吱声|

`cargo-ndk` 还贴心的为大家自动支持了 16K Page Size，[伟大，无需多盐](https://github.com/bbqsrc/cargo-ndk/blob/87b29eee5c5be6e7e6f5e002e857df0885d6b470/src/cargo.rs#L181)
```rust
    // 64-bit android requires 16kb pages now. It is the default for NDK r28+.
    // https://developer.android.com/guide/practices/page-sizes
    if is_64bit(triple) {
        if ndk_version.major <= 27 {
            ldflags.push("-Wl,-z,max-page-size=16384".to_string());
        }

        if ndk_version.major <= 22 {
            ldflags.push("-Wl,-z,common-page-size=16384".to_string());
        }
    }
```

配置环境当然还是用 nix 了，具体可以看[我的例子](https://github.com/icewithcola/NativeDrawer/blob/main/flake.nix)里怎么跑的

rust 环境通过 [rust-overlay](https://github.com/oxalica/rust-overlay) 来管理
```nix
overlays = [ 
  inputs.self.overlays.default
  inputs.rust-overlay.overlays.default
  ];
```

## Native Activity
如果我们不希望代码里出现 Java/Kotlin 的代码，那么我们就需要使用 Native Activity。
> gradle: 我呢

按照 Google 的说法，Native Activity 是[这么用的](https://developer.android.com/reference/android/app/NativeActivity)：

> Convenience for implementing an activity that will be implemented purely in native code. That is, a game (or game-like thing). There is no need to derive from this class; you can simply declare it in your manifest, and use the NDK APIs from there.

虽然在底层还是有 Java 的实现，但对我们来说，我们的代码（至少 GitHub 的语言统计里）真的可以 0% JVM Language。但这样我们就需要自己去实现 APP 的启动与绘制了，不过好在我们只是研究 Example，直接抄例子 ~~（这是个大坑）~~

## android-activity
在原来的例子里，作者使用了 [`winit`](https://github.com/rust-windowing/winit) 来管理 APP 的生命周期，在我的实现里是这样的

```rust
#[unsafe(no_mangle)]
fn android_main(app: AndroidApp) {
    use winit::platform::android::EventLoopBuilderExtAndroid;
    let event_loop: EventLoop<AndroidApp> = EventLoop::<AndroidApp>::with_user_event()
        .with_android_app(app)
        .build()
        .unwrap();
    app::run(event_loop, android_env);
}
```

而 `app::run` 实际上只做了一件事
```rust
let mut app = pollster::block_on(App::new(android_env));
```

简单来说，我们让 `winit` 管理了一个 `EventLoop`（可以类似 `Looper`），然后就一直阻塞线程（不然`android_main` 就会退出了）

