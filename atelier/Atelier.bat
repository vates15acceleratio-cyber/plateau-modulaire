@echo off
rem Lanceur Windows de l'atelier du plateau : ouvre index.html dans sa propre fenetre (Edge ou Chrome),
rem sinon dans le navigateur par defaut. Rien n'est installe, rien n'est envoye sur Internet.
rem Pour un essai sans rien ouvrir par defaut : variable ATELIER_ESSAI definie (le lanceur ecrit alors ce qu'il ferait).
setlocal
set "FICHIER=%~dp0index.html"
set "PAGE=file:///%FICHIER:\=/%"
rem Un diese ou un pourcent dans le chemin du dossier fausserait l'adresse file:// (ancre, caractere encode) :
rem dans ce cas, le fichier est ouvert tel quel par le navigateur par defaut, qui sait lire son chemin.
echo "%FICHIER%"| findstr /L /C:"#" /C:"%%" >nul && goto defaut
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
:defaut
if defined ATELIER_ESSAI (echo PAR-DEFAUT "%FICHIER%") else (start "" "%FICHIER%")
:fin
endlocal
