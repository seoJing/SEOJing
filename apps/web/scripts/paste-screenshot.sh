#!/bin/bash
# 최신 스크린샷을 public/images/로 복사하고 마크다운 이미지 경로를 출력

SCREENSHOT_DIR="$HOME/.screenshots"
LATEST="$SCREENSHOT_DIR/latest.png"
TARGET_DIR="$(dirname "$0")/../public/images"

if [ ! -f "$LATEST" ]; then
  echo "ERROR: 스크린샷이 없습니다"
  exit 1
fi

FILENAME="screenshot_$(date +%Y%m%d_%H%M%S).png"
cp "$LATEST" "$TARGET_DIR/$FILENAME"

echo "![](/images/$FILENAME)"
