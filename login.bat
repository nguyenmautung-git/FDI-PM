@echo off
title Dang Nhap Firebase
set "PATH=%PATH%;C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs"
echo Dang khoi dong Firebase Login...
call npx.cmd -y firebase-tools login
pause
