# 窝瓜汤专注开关

Mac 本机专注辅助，默认关闭，可随时结束。允许 Chrome 内的窝瓜汤（localhost:8765）、ChatGPT（chatgpt.com）、PTE 学姐（ptexj.com）。不会关掉其他软件或原有标签页；选中其他标签页时切回允许的页面。

Chrome 扩展仅读取标签页地址以判断是否允许使用，不读取正文、密码、聊天或输入内容，也不上传数据。网络拦截仅作用于主页面，不拦截三个网站加载图片、音频等所需的资源。

本机 Cocoa 菜单栏组件接收 Chrome 的专注开关，观察当前应用；开启时切回 Chrome，关闭后停止切换。系统权限、密码和锁屏对话框不受拦截。若 macOS 拒绝自动切回，会自动结束专注并说明原因。这不是家长控制或不可绕过的系统锁。

## 安装

运行 `python3 install.py`，然后在 Chrome 的 `chrome://extensions` 中打开开发者模式，“加载已解压的扩展程序”，选择安装输出的 extension 文件夹。安装过程不启用专注。

先登录 ChatGPT 和 PTE 学姐，再在窝瓜汤页头开启专注。Mac 菜单栏始终提供“结束专注”和“退出专注组件”。Chrome 重启、扩展断开或组件异常会解除限制；不会自动跨重启恢复。

## 构建与验证

`python3 build.py --output /absolute/output/focus` 用系统 clang 构建 AppKit 组件。安装包可附带预先编译的同机二进制，避免重复编译。

`node ../tests/focus-policy.mjs` 检查网址边界与拦截规则；`python3 ../tests/test_focus_host.py` 检查通信帧、无效来源和断线释放。安装后需在 Chrome 实测扩展与本机组件的联动。

本功能仅使用当前用户的本机 Chrome NativeMessagingHosts 注册，不安装系统守护进程、不更改网络代理、防火墙、证书或系统安全设置。
