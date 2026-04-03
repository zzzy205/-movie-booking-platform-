#!/bin/bash
# 切换回内网配置脚本
# 使用方法：拔掉外网网线后执行 ./to-in.sh

echo "=== 切换回内网环境 ==="
echo "请确保已拔掉外网网线，准备插上内网网线"

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

# 2. 检查是否存在内网配置备份
if [ -f /etc/netplan/01-netcfg.yaml.backup ]; then
    echo "恢复内网配置备份..."
    sudo cp /etc/netplan/01-netcfg.yaml.backup /etc/netplan/01-netcfg.yaml
    
    # 检查备份文件中的接口名是否匹配当前接口
    BACKUP_INTERFACE=$(grep -E "^\s+[a-z0-9]+:" /etc/netplan/01-netcfg.yaml | head -1 | sed 's/://' | xargs)
    if [ "$BACKUP_INTERFACE" != "$INTERFACE" ] && [ -n "$BACKUP_INTERFACE" ]; then
        echo "⚠️  备份配置中的接口 ($BACKUP_INTERFACE) 与当前接口 ($INTERFACE) 不匹配"
        echo "更新接口名..."
        sudo sed -i "s/$BACKUP_INTERFACE:/$INTERFACE:/g" /etc/netplan/01-netcfg.yaml
    fi
else
    echo "⚠️  未找到内网配置备份，将创建新的内网配置"
    echo "创建内网配置（接口: $INTERFACE）..."
    sudo tee /etc/netplan/01-netcfg.yaml > /dev/null << EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    $INTERFACE:
      dhcp4: no
      addresses:
        - 50.130.210.168/26
      routes:
        - to: default
          via: 50.130.210.254
      nameservers:
        addresses: [50.128.0.10, 50.38.128.10]
EOF
fi

# 3. 应用配置
echo "应用网络配置..."
sudo netplan apply

# 4. 等待网络稳定
echo "等待网络稳定..."
sleep 5

# 5. 验证内网连接
echo "验证内网连接..."
if ping -c 3 50.130.210.254 > /dev/null 2>&1; then
    echo "✅ 内网连接成功！"
    echo "🌐 当前IP: $(hostname -I | awk '{print $1}')"
    echo "🏠 已恢复到内网环境"
    echo ""
    echo "💡 内网服务已恢复，可以正常使用了"
else
    echo "❌ 内网连接失败，请检查网线连接"
    echo "💡 提示：请确保已插上内网网线"
fi

echo "=== 内网切换完成 ==="
