@echo off
rem Lanceur Windows de l'atelier du plateau : ouvre index.html dans sa propre fenetre (Edge ou Chrome),
rem sinon dans le navigateur par defaut. Rien n'est installe, rien n'est envoye sur Internet.
setlocal
set "FICHIER=%~dp0index.html"
set "PAGE=file:///%FICHIER:\=/%"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app="%PAGE%"
  goto fin
)
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app="%PAGE%"
  goto fin
)
start "" "%FICHIER%"
:fin
endlocal
