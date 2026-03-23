# Fund Management System Workspace

这是一个个人工作区仓库，目前已经额外加入了一个可直接运行的 `WiFi` 家庭活动粗略检测工具。

当前最推荐直接使用的功能不是基金模块，而是下面这两个本地工具：

1. `wifi-activity-dashboard.cmd`
2. `wifi-activity-detector.cmd`

## 当前可直接使用的功能

### 1. 中文小界面版

启动文件：

`wifi-activity-dashboard.cmd`

作用：

1. 显示当前 WiFi 网络信息
2. 实时显示活动评分
3. 自动绘制活动曲线图
4. 给出中文状态判断，例如：
   `采样中`
   `当前较平稳`
   `轻微波动`
   `可能有人活动`
   `大概率有人活动`

适合场景：

1. 把笔记本放在客厅或房间固定位置
2. 观察家里是否有人走动
3. 做一个粗粒度的 WiFi 活动检测实验

### 2. 命令行版

启动文件：

`wifi-activity-detector.cmd`

作用：

1. 在终端持续输出 WiFi 波动
2. 自动记录日志
3. 适合快速测试或后台观察

## 使用方法

### 中文小界面版

直接双击：

`wifi-activity-dashboard.cmd`

建议使用方式：

1. 保持笔记本连接家里的 WiFi
2. 把笔记本放在固定位置，不要边测边移动
3. 先静止 20 到 30 秒，让程序建立基线
4. 再让人在房间里走动
5. 观察曲线和状态变化

### 命令行版

直接双击：

`wifi-activity-detector.cmd`

按 `Ctrl + C` 停止。

## 日志位置

程序运行日志会自动写到：

`data/wifi-activity-detector/`

## 能做到什么

基于当前硬件：

`Windows 笔记本 + 家用路由器`

目前能做到的是：

1. 粗略判断环境是否有活动
2. 根据 WiFi 信号和收发速率波动做活动评分
3. 用中文界面可视化展示活动趋势

## 做不到什么

当前这套硬件做不到：

1. 真实人体姿态骨架显示
2. CSI 级别的高精度人体识别
3. 摄像头式的人体关键点检测

如果以后想做真实人体姿态或更高精度的 WiFi 感知，需要额外硬件，例如：

1. `ESP32-S3`
2. 特定 Linux 无线网卡
3. 支持 CSI 的采集链路

## 主要文件

1. `scripts/wifi_activity_core.py`
   公共采样与评分逻辑

2. `scripts/wifi_activity_dashboard.py`
   中文图形界面

3. `scripts/wifi_activity_detector.py`
   命令行版本

4. `wifi-activity-dashboard.cmd`
   小界面启动入口

5. `wifi-activity-detector.cmd`
   命令行启动入口

## 备注

这个仓库本身还保留了原来的基金相关工作区内容，所以你会看到 `src/`、`dist/` 等旧目录。  
如果后面需要，我可以继续把仓库整理成一个更干净、明确的 WiFi 活动检测项目结构。
