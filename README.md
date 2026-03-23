# Fund Management Extension

基金查看与管理相关的浏览器扩展工作区。

## 当前项目定位

这个仓库现在只保留基金项目本体，不再混放 WiFi 活动检测工具。

主要目录包括：

1. `src/`
2. `dist/`
3. `lib/`
4. `image/`
5. `funds-master/`

## 主要功能

从现有扩展清单和目录结构看，这个项目主要围绕以下能力：

1. 查看自选基金
2. 查看持仓收益
3. 查看估算净值
4. 查看市场行情

## 启动方式

本地启动入口：

`打开基金系统.cmd`

这个脚本会：

1. 查找本机 Microsoft Edge
2. 使用独立 Edge 用户目录
3. 加载当前仓库下的 `dist` 扩展目录
4. 自动打开扩展管理页

## 目录说明

1. `src/`
扩展源码

2. `dist/`
已构建的扩展目录

3. `docs/`
项目文档

4. `funds-master/`
历史资料或参考内容

## 备注

之前临时加入过一个 WiFi 活动检测工具，现已拆分为独立项目：

[https://github.com/blueberry661/wifi-activity-detector](https://github.com/blueberry661/wifi-activity-detector)
