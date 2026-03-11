@echo off
REM ══════════════════════════════════════════════════════════════
REM  BUILD SCRIPT  —  gita_ai.exe
REM  Run this once from the same folder as gita_ai.py
REM ══════════════════════════════════════════════════════════════

echo.
echo ==========================================
echo  Gita AI  --  PyInstaller Build Script
echo ==========================================
echo.

REM Step 1: Install / upgrade dependencies
echo [1/4] Installing Python dependencies...
pip install --upgrade pyinstaller
pip install "numpy>=1.26,<2.0"
pip install sentence-transformers scikit-learn torch transformers peft accelerate tokenizers huggingface_hub

echo.
echo [2/4] Cleaning previous build artifacts...
if exist "build" rmdir /s /q build
if exist "dist"  rmdir /s /q dist
if exist "gita_ai.spec" del gita_ai.spec

echo.
echo [3/4] Building the executable with PyInstaller...

pyinstaller ^
  --onefile ^
  --name gita_ai ^
  --console ^
  --collect-all numpy ^
  --collect-all sentence_transformers ^
  --collect-all sklearn ^
  --collect-all transformers ^
  --collect-all peft ^
  --collect-all accelerate ^
  --collect-all tokenizers ^
  --collect-all huggingface_hub ^
  --hidden-import=numpy._core ^
  --hidden-import=numpy._core._multiarray_umath ^
  --hidden-import=numpy._core.multiarray ^
  --hidden-import=numpy.core._methods ^
  --hidden-import=sklearn.metrics.pairwise ^
  --hidden-import=sklearn.utils._weight_vector ^
  --hidden-import=sklearn.neighbors._partition_nodes ^
  --hidden-import=torch ^
  --hidden-import=peft ^
  --hidden-import=accelerate ^
  --hidden-import=protobuf ^
  gita_ai.py

echo.
echo [4/4] Done!

if exist "dist\gita_ai.exe" (
    echo.
    echo ==========================================
    echo  SUCCESS!  Executable created at:
    echo  dist\gita_ai.exe
    echo ==========================================
    echo.
    echo  Next steps:
    echo    1. Copy dist\gita_ai.exe next to your other files
    echo    2. Run once WITH internet to cache models into hf_cache\
    echo    3. After that works fully offline forever
    echo.
    echo  Files needed in same folder as exe:
    echo    - router_embeddings.pkl
    echo    - lora_adapters_LLM1\
    echo    - lora_adapters_LLM2\
    echo    - lora_adapters_LLM3\
    echo    - lora_adapters_LLM6\
) else (
    echo.
    echo  BUILD FAILED. Check the output above for errors.
)

pause