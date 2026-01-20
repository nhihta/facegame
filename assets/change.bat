@echo off
title Tool doi JPG sang PNG sieu toc
color 0A
cd /d "%~dp0"

echo =================================================
echo   DANG CHUYEN DOI JPG/JPEG SANG PNG...
echo =================================================

:: Gọi PowerShell để xử lý ảnh (sử dụng thư viện System.Drawing có sẵn của Windows)
powershell -Command "Add-Type -AssemblyName System.Drawing; $files = Get-ChildItem -Include *.jpg,*.jpeg -Name; if ($files.Count -eq 0) { Write-Host 'Khong tim thay file JPG nao!' -ForegroundColor Red } else { foreach ($f in $files) { try { $img = [System.Drawing.Image]::FromFile($f); $newName = [System.IO.Path]::ChangeExtension($f, '.png'); $img.Save($newName, [System.Drawing.Imaging.ImageFormat]::Png); $img.Dispose(); Write-Host ('[OK] ' + $f + ' -> ' + $newName) } catch { Write-Host ('[LOI] ' + $f) -ForegroundColor Red } } }"

echo.
echo =================================================
echo   DA XONG! Kiem tra lai thu muc nhe.
echo =================================================
pause