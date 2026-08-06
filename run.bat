@echo off
title Quan Ly Du An Server
set "PATH=%PATH%;C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs"
echo Dang khoi dong server QuanLyDuAn...
start http://localhost:5173/QuanLyTaiLieu/
call node.exe .\node_modules\vite\bin\vite.js

