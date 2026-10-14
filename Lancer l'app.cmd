@echo off
rem Double-clique sur ce fichier pour lancer l'aperçu de l'app (navigateur + QR code pour Expo Go).
cd /d "%~dp0"
call npx.cmd expo start --web
pause
