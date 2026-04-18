@echo off
REM ============================================================
REM  setup.bat — Run this ONCE to install all dependencies
REM  (Only needed on a fresh machine / clean folder)
REM ============================================================

echo ============================================================
echo  Setting up the environment...
echo ============================================================
echo [1/3] Creating virtual environment...

echo.
echo [2/3] Installing runtime dependencies...
.venv\Scripts\pip install TTS "torch==2.2.2" "torchaudio==2.2.2" "transformers==4.37.2" tqdm requests huggingface_hub

echo.
echo [3/3] Patching TTS for PyTorch 2.x compatibility...
.venv\Scripts\python -c "import pathlib; p = pathlib.Path('.venv/Lib/site-packages/TTS/utils/io.py'); t = p.read_text(); old = 'torch.load(f, map_location=map_location, **kwargs)'; new = 'torch.load(f, map_location=map_location, weights_only=False, **kwargs)'; p.write_text(t.replace(old, new)); print('Patched!')"

echo.
echo ============================================================
echo  Setup complete!
echo  Next steps:
echo    - To test without building:  run voice_cloner.py directly
echo    - To build the .exe:         run build.bat
echo ============================================================
pause