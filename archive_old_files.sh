#!/bin/bash
# ════════════════════════════════════════════════════════════
# INFINITY OS · GitHub归档脚本 v1.0
# ════════════════════════════════════════════════════════════
# 
# 设计:Agent · 2026.04.21
# 用途:把GitHub上30+老版本HTML和15+老zip归档到/archive/
#       让Tech Lead到岗第1天打开GitHub能立刻找到当前文件
# 
# 用法(3种方式选1):
# 
# 方式1·DS在Mac电脑上跑:
#   1. 打开Terminal
#   2. cd到INFINITY OS仓库本地路径
#   3. 复制本脚本到该路径·命名 archive_old_files.sh
#   4. chmod +x archive_old_files.sh
#   5. ./archive_old_files.sh
# 
# 方式2·DS让Tech Lead Day 1跑(推荐):
#   Day 1早上Tech Lead到岗第1件事
#   就跑这个脚本·清理GitHub
# 
# 方式3·DS用GitHub Desktop手动:
#   照着脚本里的mv命令·一个个手动操作
#   需要15分钟
# 
# ════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════"
echo "  INFINITY OS · GitHub归档脚本"
echo "  开始时间:$(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Step 1·检查当前目录 ──
if [ ! -d ".git" ]; then
  echo "❌ 错误:当前目录不是Git仓库"
  echo "   请先 cd 到 Infinity-os-SH 仓库本地路径"
  exit 1
fi

REPO_NAME=$(basename "$(pwd)")
echo "✅ 当前仓库:$REPO_NAME"
echo ""

# ── Step 2·创建archive目录 ──
mkdir -p archive/old_versions
mkdir -p archive/old_zips
mkdir -p archive/old_screenshots
echo "✅ 创建归档目录:"
echo "   archive/old_versions/  → 老HTML版本"
echo "   archive/old_zips/      → 老zip包"
echo "   archive/old_screenshots/ → 老截图"
echo ""

# ── Step 3·定义"当前版本"白名单(不归档) ──
CURRENT_FILES=(
  # === 核心入口 ===
  "index.html"
  "README.md"
  "INFINITY_OS_B_v3.html"
  
  # === R4-W1当前执行包 ===
  "interview_card_5people.html"
  "tech_lead_week1_playbook.html"
  "team_protocol_5people.html"
  "ceo_report_template.html"
  "8week_roadmap.html"
  "day1_checklist.html"
  "risk_playbook.html"
  "techlead_outreach_kit.html"
  "learning_mechanism.html"
  
  # === 数据接入 ===
  "sap_req_001.html"
  "dcloud_req_001.html"
  "hanxun_req_001.html"
  "sap_data_quality_check.html"
  "data_access_application.html"
  "mysql_5tables_complete.sql"
  "example_create_table.sql"
  
  # === Agent代码 ===
  "AValueCalibrationAgent.java"
  "ButterflyEffectAgent.java"
  "OmakaseRecommendAgent.java"
  
  # === Universal Schema ===
  "infinity_os_universal_node_schema.html"
  "infinity_os_agent_spec_01.html"
  "infinity_os_agent_spec_02.html"
  "infinity_os_agent_spec_03.html"
  
  # === WDM(另一对话产出·暂保留) ===
  # WDM文件单独处理·见下面WDM Section
)

# ── Step 4·扫描所有HTML文件·识别老版本 ──
echo "🔍 扫描HTML文件..."
HTML_COUNT=0
ARCHIVED_HTML=0

for file in *.html; do
  [ -f "$file" ] || continue
  HTML_COUNT=$((HTML_COUNT + 1))
  
  # 检查是否在白名单
  IS_CURRENT=false
  for current in "${CURRENT_FILES[@]}"; do
    if [ "$file" == "$current" ]; then
      IS_CURRENT=true
      break
    fi
  done
  
  # WDM文件保留(另一对话产出)
  if [[ "$file" == INFINITY_OS_WDM_* ]] || [[ "$file" == wdm_* ]]; then
    IS_CURRENT=true
  fi
  
  # 不在白名单 → 归档
  if [ "$IS_CURRENT" == "false" ]; then
    git mv "$file" "archive/old_versions/$file" 2>/dev/null && {
      echo "   📦 $file → archive/old_versions/"
      ARCHIVED_HTML=$((ARCHIVED_HTML + 1))
    }
  fi
done

echo "   HTML文件总计:$HTML_COUNT · 归档:$ARCHIVED_HTML · 保留当前:$((HTML_COUNT - ARCHIVED_HTML))"
echo ""

# ── Step 5·扫描所有zip文件·全部归档 ──
echo "🔍 扫描zip文件..."
ZIP_COUNT=0

for file in *.zip; do
  [ -f "$file" ] || continue
  ZIP_COUNT=$((ZIP_COUNT + 1))
  
  git mv "$file" "archive/old_zips/$file" 2>/dev/null && {
    echo "   📦 $file → archive/old_zips/"
  }
done

echo "   zip文件归档:$ZIP_COUNT"
echo ""

# ── Step 6·扫描所有截图·全部归档 ──
echo "🔍 扫描截图文件(png/jpg/jpeg)..."
IMG_COUNT=0

for ext in png jpg jpeg; do
  for file in *.$ext; do
    [ -f "$file" ] || continue
    IMG_COUNT=$((IMG_COUNT + 1))
    
    git mv "$file" "archive/old_screenshots/$file" 2>/dev/null && {
      echo "   📦 $file → archive/old_screenshots/"
    }
  done
done

echo "   截图归档:$IMG_COUNT"
echo ""

# ── Step 7·生成README说明 ──
cat > archive/README.md << 'EOF'
# INFINITY OS · 归档目录

本目录存放历史版本和老文件 · 当前版本在仓库根目录

## 目录结构

- `old_versions/` — 历史HTML版本(各种V1·V2·V3·V8·V81等)
- `old_zips/` — 历史交付包(zip)
- `old_screenshots/` — 历史截图(png/jpg)

## 归档时间

2026-04-21 · R4-W1启动前清理

## 归档目的

让Tech Lead到岗时·能立刻看清楚"当前文件" vs "历史文件"
不影响Git历史·所有文件可随时查看·只是不在根目录

## 当前文件位置

回到仓库根目录 → 看R4-W1相关文件 + 数据接入需求 + Agent代码骨架
EOF

echo "✅ 已生成 archive/README.md"
echo ""

# ── Step 8·汇总 ──
echo "═══════════════════════════════════════════════════"
echo "  归档完成!"
echo "═══════════════════════════════════════════════════"
echo "  HTML归档:$ARCHIVED_HTML 个"
echo "  zip归档:$ZIP_COUNT 个"
echo "  截图归档:$IMG_COUNT 个"
echo "  总计:$((ARCHIVED_HTML + ZIP_COUNT + IMG_COUNT)) 个文件"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Step 9·提示commit ──
echo "📋 接下来做:"
echo ""
echo "  git status              # 查看变更"
echo "  git add ."
echo "  git commit -m \"chore: archive old files to /archive/\""
echo "  git push origin main    # 推送到GitHub"
echo ""
echo "  推送后·GitHub上根目录会清爽很多"
echo "  Tech Lead Day 1打开就能立刻找到当前文件"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  完成时间:$(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"
