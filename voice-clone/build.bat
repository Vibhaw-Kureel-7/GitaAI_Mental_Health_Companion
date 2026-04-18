@echo off
REM ============================================================
REM  build.bat — Compiles voice_cloner.py -> voice_cloner.exe
REM
REM  Prerequisites (run setup.bat first to get the .venv):
REM    Python 3.10 or 3.11 recommended
REM    The .venv created by setup.bat must exist in this folder.
REM
REM  What this does:
REM    1. Installs extra build deps (PyInstaller, tqdm, requests,
REM       huggingface_hub) into the existing .venv
REM    2. Runs PyInstaller to produce  dist\voice_cloner.exe
REM    3. The final exe downloads the XTTS-v2 model on first run
REM       into  tts_models\  next to itself.
REM ============================================================

setlocal

set VENV=.venv\Scripts
set PY=%VENV%\python.exe
set PIP=%VENV%\pip.exe

REM ── Sanity check ────────────────────────────────────────────
if not exist "%PY%" (
    echo [ERROR] .venv not found. Run setup.bat first.
    pause
    exit /b 1
)

REM ── 1. Install build-time extras ────────────────────────────
echo.
echo [1/3] Installing build dependencies...
%PIP% install --quiet ^
    pyinstaller ^
    tqdm ^
    requests ^
    huggingface_hub

REM ── 2. Build with PyInstaller ───────────────────────────────
echo.
echo [2/3] Building exe with PyInstaller...
echo       (This can take 3-10 minutes and produce ~600 MB - normal for torch)

%PY% -m PyInstaller ^
    --onefile ^
    --console ^
    --name voice_cloner ^
    --hidden-import TTS ^
    --hidden-import TTS.api ^
    --hidden-import TTS.utils.io ^
    --hidden-import TTS.tts.configs.xtts_config ^
    --hidden-import TTS.tts.models.xtts ^
    --hidden-import transformers ^
    --hidden-import torchaudio ^
    --hidden-import huggingface_hub ^
    --hidden-import tqdm ^
    --hidden-import requests ^
    --hidden-import inflect ^
    --hidden-import anyascii ^
    --hidden-import gruut ^
    --hidden-import unidic_lite ^
    --collect-all TTS ^
    --collect-all transformers ^
    --collect-data jamo ^
    --collect-all trainer ^
    --collect-all gruut ^
    --collect-all gruut_lang_de ^
    --collect-all gruut_lang_en ^
    --collect-all gruut_lang_es ^
    --collect-all gruut_lang_fr ^
    --collect-all gruut_lang_it ^
    --collect-all gruut_lang_pt ^
    --collect-all gruut_lang_ru ^
    --collect-all gruut_lang_nl ^
    --collect-all gruut_lang_cs ^
    --collect-all gruut_lang_ar ^
    --collect-all gruut_lang_ja ^
    --collect-all gruut_lang_ko ^
    --collect-all gruut_lang_zh ^
    --collect-all inflect ^
    --collect-all anyascii ^
    --collect-all unidic_lite ^
    --collect-all encodec ^
    --collect-all coqpit ^
    voice_cloner.py

REM ── 3. Report result ────────────────────────────────────────
echo.
if exist "dist\voice_cloner.exe" (
    echo [3/3] ============================================================
    echo        Build SUCCESS!
    echo        Executable : dist\voice_cloner.exe
    echo.
    echo        Copy voice_cloner.exe anywhere you like.
    echo        First run will download the XTTS-v2 model (~1.8 GB^) into
    echo        a  tts_models\  folder next to the exe.
    echo.
    echo        Usage examples:
    echo          voice_cloner.exe --audio ref.wav --text "Hello" --output out.wav
    echo          voice_cloner.exe --audio ref.wav --text "Bonjour" --output out.wav --language fr
    echo        ============================================================
) else (
    echo [3/3] Build FAILED — check the output above for errors.
    echo.
    echo  Common fixes:
    echo    - Make sure setup.bat ran successfully first
    echo    - Try:  .venv\Scripts\pip install "pyinstaller==6.6.0"
    echo    - Check antivirus isn't blocking PyInstaller's temp folder
)

echo.
pause
endlocal