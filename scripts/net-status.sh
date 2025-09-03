#!/bin/bash
# 查看当前网络状态脚本
# 使用方法：./net-status.sh

echo "=== 当前网络状态 ==="

# 显示当前网络配置
echo "📋 当前网络配置:"
echo "----------------------------------------"
cat /etc/netplan/01-netcfg.yaml
echo "----------------------------------------"

# 显示当前IP地址
echo ""
echo "🌐 当前IP地址:"
hostname -I

# 显示网络接口状态
echo ""
echo "🔌 网络接口状态:"
ip addr show | grep -E "^[0-9]+:|inet " | grep -v "127.0.0.1"

# 测试网络连接
echo ""
echo "📡 网络连接测试:"
echo "内网网关 (50.130.210.254):"
if ping -c 2 50.130.210.254 > /dev/null 2>&1; then
    echo "  ✅ 内网连接正常"
else
    echo "  ❌ 内网连接失败"
fi

echo "外网测试 (8.8.8.8):"
if ping -c 2 8.8.8.8 > /dev/null 2>&1; then
    echo "  ✅ 外网连接正常"
else
    echo "  ❌ 外网连接失败"
fi

echo ""
echo "=== 网络状态检查完成 ==="
