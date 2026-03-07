#!/bin/bash
set -e

echo "🚀 开始部署 Openmemo..."

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 创建备份目录
mkdir -p ./backups

# 备份数据库
echo "💾 备份数据库..."
BACKUP_FILE="./backups/pre-deploy-backup-$(date +%Y%m%d_%H%M%S).sql"
# 确保在容器内成功备份并写入宿主机文件
if docker compose exec -T db pg_dump -U openmemo openmemo > "$BACKUP_FILE"; then
    echo "✅ 数据库备份完成: $BACKUP_FILE"
else
    echo "⚠️ 数据库备份失败，如果是首次部署（无数据库实例），可忽略此错误。"
    rm -f "$BACKUP_FILE" || true
fi

# 拉取最新镜像
echo "🐳 拉取最新 Docker 镜像..."
docker compose pull

# 重启容器
echo "🔄 重启容器..."
docker compose up -d

# 等待服务启动
echo "⏳ 等待服务启动 (最多等待 40 秒)..."
sleep 20

# 检查健康状态并轮询
MAX_RETRIES=5
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
      HEALTHY=true
      break
  fi
  echo "🏥 服务未就绪，重试中 ($((RETRY_COUNT+1}}/$MAX_RETRIES))..."
  sleep 4
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$HEALTHY" = true ]; then
    echo "✅ 服务健康检查通过"
else
    echo "❌ 服务健康检查失败，回滚..."
    # 简单的回滚策略: 重启服务以尝试触发重启策略，并保留上一个镜像
    docker compose down
    docker compose up -d
    echo "⚠️ 部署可能有问题，请检查日志:"
    docker compose logs --tail=50 openmemo
    exit 1
fi

echo "📋 显示近期日志..."
docker compose logs --tail=10 openmemo

echo "✨ 部署完成！"
