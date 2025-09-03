#!/bin/bash
# 切换回内网配置脚本
# 使用方法：拔掉外网网线后执行 ./to-in.sh

echo "=== 切换回内网环境 ==="
echo "请确保已拔掉外网网线，准备插上内网网线"

# 等待用户确认
read -p "按回车键继续，或按Ctrl+C取消..."

# 1. 检查是否存在内网配置备份
if [ ! -f /etc/netplan/01-netcfg.yaml.backup ]; then
    echo "❌ 未找到内网配置备份，无法恢复"
    echo "💡 请先运行外网切换脚本创建备份"
    echo "💡 或者手动恢复网络配置"
    exit 1
fi

# 2. 恢复内网配置
echo "恢复内网配置..."
sudo cp /etc/netplan/01-netcfg.yaml.backup /etc/netplan/01-netcfg.yaml

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
