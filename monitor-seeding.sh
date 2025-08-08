#!/bin/bash
echo "🥷 Ninja Seeds - Ultra Seeding Monitor"
echo "======================================"

echo "📊 System Resources:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)% used"
echo "RAM: $(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
echo "Disk: $(df -h /mnt/ninjaseeds | awk 'NR==2{print $5}')"

echo ""
echo "🌐 Network Activity:"
echo "$(ss -tuln | grep :51413 && echo "✅ Port 51413 open" || echo "❌ Port 51413 closed")"

echo ""
echo "⚡ Transmission Status:"
transmission-remote localhost:9091 -l 2>/dev/null || echo "❌ Transmission not responding"

echo ""
echo "🔥 Current Torrents:"
curl -s http://localhost:3000/api/torrents | jq -r '.torrents[] | "📁 \(.name) - \(.status) - ↓\(.downloadSpeed/1024|floor)KB/s ↑\(.uploadSpeed/1024|floor)KB/s"' 2>/dev/null || echo "❌ API not responding"

echo ""
echo "📈 Live Stats:"
curl -s http://localhost:3000/api/stats | jq -r '"Total: \(.totalTorrents) | Active: \(.activeDownloads) | Seeding: \(.seedingTorrents) | Disk: \(.diskUsage)%"' 2>/dev/null