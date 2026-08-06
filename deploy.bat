@echo off
title Deploy Web Quan Ly Tai Lieu (GitHub Pages + Firebase)
set "PATH=%PATH%;C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd;C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs"

echo ========================================================
echo 1. Dang tao ban build san xuat moi nhat...
echo ========================================================
call node.exe .\node_modules\vite\bin\vite.js build

echo ========================================================
echo 2. Dang deploy len duong link cu (GitHub Pages)...
echo ========================================================
call node.exe .\node_modules\gh-pages\bin\gh-pages.js -d dist

echo ========================================================
echo 3. Dang deploy len duong link moi (Firebase Hosting)...
echo ========================================================
call node.exe .\node_modules\firebase-tools\lib\bin\firebase.js deploy --only hosting

echo ========================================================
echo HOAN TAT DEPLOY CA 2 DUONG LINK!
echo ========================================================
pause
