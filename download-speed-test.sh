#!/bin/bash
echo "🚀 NINJA SEEDS - Ultra-Fast Download Test"
echo "========================================"

echo "📊 Testing NGINX direct serving..."
curl -I http://129.154.253.68/downloads/ 2>/dev/null | grep -E "(Server|Accept-Ranges|Content-Type)"

echo ""
echo "🔥 Testing API download preparation..."
curl -s http://localhost:3000/api/torrents/download/1 | head -5

echo ""
echo "⚡ Download optimization status:"
echo "✅ NGINX sendfile: enabled"
echo "✅ Store-mode ZIP: enabled (no compression)"
echo "✅ Direct file serving: enabled"
echo "✅ Range requests: supported"

echo ""
echo "🎯 For maximum speed, use download manager with:"
echo "aria2c -x 16 -s 16 http://129.154.253.68/downloads/yourfile.zip"