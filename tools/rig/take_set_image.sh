#!/bin/sh
# 새 캐릭터 세트 그림 받기 한 걸음 (Gemini "이미지 복사" 뒤): 클립보드 → 저장 → 자리 확인 (→ 팔 없음이면 자르기 미리보기)
#   sh tools/rig/take_set_image.sh <id> <글자> full|armless
# full: <id>_set_<글자>_gemini.png 를 기본 전신과 비교 / armless: <id>_set_<글자>_armless_gemini.png 를 세트 전신과 비교 + 자르기 미리보기
cd "$(dirname "$0")/../.." || exit 1
id=$1; v=$2; kind=$3
src=assets/sprites/parts/$id/src
if [ "$kind" = full ]; then out=$src/${id}_set_${v}_gemini.png; ref=$src/${id}_1_gemini.png
else out=$src/${id}_set_${v}_armless_gemini.png; ref=$src/${id}_set_${v}_gemini.png; fi
powershell -NoProfile -ExecutionPolicy Bypass -File tools/ai/save_clipboard_png.ps1 "$(cygpath -w "$PWD/$out" 2>/dev/null || echo "$PWD/$out")" || exit 1
PYTHONIOENCODING=utf-8 python tools/rig/check_set_align.py "$id" "$ref" "$out"
if [ "$kind" = armless ]; then PYTHONIOENCODING=utf-8 python tools/rig/cut_newchar_sets.py "$id" "$v" --preview | head -1; fi
