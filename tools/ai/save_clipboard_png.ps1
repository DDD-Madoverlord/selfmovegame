# Gemini "이미지 복사"로 클립보드에 들어온 그림을 PNG로 저장하고 클립보드를 비움 (다음 복사가 실패하면 "no image"로 알 수 있게)
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/ai/save_clipboard_png.ps1 <저장 경로>
param([string]$Path)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$img = [Windows.Forms.Clipboard]::GetImage()
if ($null -eq $img) { Write-Output "no image"; exit 1 }
$img.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "$($img.Width)x$($img.Height) saved"
[Windows.Forms.Clipboard]::Clear()
