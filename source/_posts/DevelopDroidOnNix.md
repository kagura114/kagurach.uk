---
title: 用 Nix 管理安卓打包环境
date: 2025/03/12 12:35
tags: ["Linux","开发","Nix"]
category: 开发
---

nix flake 的 devShell 完全可以配置安卓打包环境，就是资料不是很多

<!-- more -->

# 基本配置
```nix
{
  description = "Nix Building Environment for Android APP";

  inputs = {
    flake-utils = {
      url = "github:numtide/flake-utils";
    };
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem ( system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk = {
              accept_license = true;
            };
          };
        };
        buildToolsVersion = "35.0.0";
        ndkVersion = "27.0.12077973";
        androidComposition = pkgs.androidenv.composeAndroidPackages {
          buildToolsVersions = [ buildToolsVersion "34.0.0" ]; # 可以放多个版本
          platformVersions = [ "35" "34" ];
          abiVersions = [ "x86_64" "arm64-v8a" ];
          includeNDK = true;
          useGoogleAPIs = false;
          useGoogleTVAddOns = false;
          includeEmulator = false;
          includeSystemImages = false;
          includeSources = false;
        };
        pinnedJDK = pkgs.jdk21;
        androidSdk = androidComposition.androidsdk;
      in {
        devShells = {
          default = pkgs.mkShell {
            name = "Android-Build-Shell";
            buildInputs = with pkgs; [
              # 这里你写
            ] ++ [
              androidSdk
              pinnedJDK
            ];
            JAVA_HOME = pinnedJDK;
            ANDROID_HOME = "${androidSdk}/libexec/android-sdk";
            NDK_HOME = "${androidSdk}/libexec/android-sdk/ndk/${ndkVersion}";
            GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${androidSdk}/libexec/android-sdk/build-tools/${buildToolsVersion}/aapt2";

          };
        };
      }
    );
}
```
然后使用 `nix develop` 进入开发环境

# 变量
变量要看你的 `build.gradle` 和 `flake.nix`， 一般我们让 flake 适配原来的 gradle script
```groovy
buildscript {
    ext {
        buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'               // flake buildToolsVersion
        minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
        compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
        targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '34')
        kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'

        ndkVersion = "27.0.12077973"  // flake ndkVersion
    }
  }
```
`flake.nix` 里面配置如下
```nix
buildToolsVersion = "35.0.0";
ndkVersion = "27.0.12077973";
androidComposition = pkgs.androidenv.composeAndroidPackages {
  buildToolsVersions = [ buildToolsVersion ];
  platformVersions = [ "35" ];
  abiVersions = [ "x86_64" "arm64-v8a" ];
  includeNDK = true;
  useGoogleAPIs = false;
  useGoogleTVAddOns = false;
  includeEmulator = false;
  includeSystemImages = false;
  includeSources = false;
};
pinnedJDK = pkgs.jdk21;
androidSdk = androidComposition.androidsdk;

```

# 其他可配置项目
见[compose-android-packages](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/mobile/androidenv/compose-android-packages.nix)

例如指定 cmake 版本
```nix
androidComposition = pkgs.androidenv.composeAndroidPackages {
  ...
  cmakeVersions = [ "3.22.1" ];
  ...
};
```
# React Native
添加 nodejs 和 yarn 即可

```nix
buildInputs =
 with pkgs; [
    nodejs_18
    yarn
  ] ++ [
    androidSdk
    pinnedJDK
  ];
```

# 可能遇到的问题
## Still waiting for package manifests to be fetched remotely
```
Errors during XML parse:
Additionally, the fallback loader failed to parse the XML.
Still waiting for package manifests to be fetched remotely.
```
这是因为 gradle daemon 无法复用
```bash
./gradlew --stop
```
关掉其他 daemon 即可