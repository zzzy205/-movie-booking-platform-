#!/bin/bash
# 切换到外网配置脚本
# 使用方法：拔掉内网网线后执行 ./to-out.sh

echo "=== 切换到外网环境 ==="
echo "请确保已拔掉内网网线，准备插上外网网线"

# 等待用户确认
read -p "按回车键继续，或按Ctrl+C取消..."

# 1. 检测网络接口
# 优先使用 enp2s0f0，如果不存在则尝试 enp2s0f1 或 eno1
if ip link show enp2s0f0 > /dev/null 2>&1; then
    INTERFACE="enp2s0f0"
elif ip link show enp2s0f1 > /dev/null 2>&1; then
    INTERFACE="enp2s0f1"
elif ip link show eno1 > /dev/null 2>&1; then
    INTERFACE="eno1"
else
    echo "❌ 未找到可用的网络接口"
    echo "可用接口："
    ip link show | grep -E "^[0-9]+:" | awk '{print $2}' | sed 's/://'
    exit 1
fi

echo "✅ 检测到网络接口: $INTERFACE"

# 2. 备份当前配置（如果存在）
if [ -f /etc/netplan/01-netcfg.yaml ]; then
    if [ ! -f /etc/netplan/01-netcfg.yaml.backup ]; then
        echo "备份当前网络配置..."
        sudo cp /etc/netplan/01-netcfg.yaml /etc/netplan/01-netcfg.yaml.backup
        echo "✅ 配置已备份到 /etc/netplan/01-netcfg.yaml.backup"
    else
        echo "⚠️  配置已存在备份，跳过备份步骤"
    fi
else
    echo "ℹ️  未找到现有配置文件，将创建新配置"
fi

# 3. 应用外网配置
echo "应用外网配置到接口: $INTERFACE"
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null << EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    $INTERFACE:
      dhcp4: no
      addresses:
        - 192.168.22.120/24
      routes:
        - to: default
          via: 192.168.22.1
      nameservers:
        addresses: [61.147.31.1, 101.226.4.6]
EOF

# 3. 应用配置
echo "应用网络配置..."
sudo netplan apply

# 4. 等待网络稳定
echo "等待网络稳定..."
sleep 5

# 5. 验证网络
echo "验证外网连接..."
if ping -c 3 8.8.8.8 > /dev/null 2>&1; then
    echo "✅ 外网连接成功！"
    echo "🌐 当前IP: $(hostname -I | awk '{print $1}')"
    echo "📡 可以开始使用PuTTY连接和更新了"
    echo ""
    echo "💡 更新完成后，请拔掉外网网线，然后运行: ./to-in.sh"
else
    echo "❌ 外网连接失败，请检查网线连接"
    echo "💡 提示：请确保已插上外网网线"
    echo "💡 如果仍有问题，可以运行: ./to-in.sh 恢复内网配置"
fi

echo "=== 外网切换完成 ==="
