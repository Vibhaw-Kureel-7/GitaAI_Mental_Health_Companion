"""
voice_cloner.py  —  Offline CLI Voice Cloner
=============================================
Clones a voice from a ~10-second reference audio clip.

Usage:
    voice_cloner.exe --audio ref.wav --text "Hello world" --output out.wav
    voice_cloner.exe --audio ref.wav --text "Hello world" --output out.wav --language fr

Supported language codes:
    en  es  fr  de  it  pt  pl  tr  ru  nl  cs  ar  zh-cn  ja  ko  hu
"""

import sys
import os
import io

if sys.stdout is not None and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr is not None and hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

os.environ["TYPEGUARD_DISABLE"] = "1"  # Disable typeguard for faster imports (optional, but TTS is slow to import)
import argparse
from pathlib import Path


# ── Resolve the directory that sits next to the exe (or script) ──────────────
# sys.frozen is set by PyInstaller when running as a built exe.
if getattr(sys, "frozen", False):
    _BASE_DIR = Path(sys.executable).parent   # folder that contains the .exe
else:
    _BASE_DIR = Path(__file__).parent          # folder that contains the .py

MODEL_DIR = _BASE_DIR / "tts_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Tell Coqui TTS where to store (and find) its models.
os.environ["COQUI_TTS_HOME"] = str(MODEL_DIR)

MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"

# ── HuggingFace repo for XTTS-v2 (used for the size-aware progress bar) ──────
HF_REPO_ID  = "coqui/XTTS-v2"
HF_REVISION = "main"


# ─────────────────────────────────────────────────────────────────────────────
# Progress-bar download helper
# ─────────────────────────────────────────────────────────────────────────────

def _model_already_downloaded() -> bool:
    """Return True if the XTTS-v2 model weights are already on disk."""
    # Coqui stores models under:  <COQUI_TTS_HOME>/tts/<model_name_with_slashes_as_dashes>/
    slug = MODEL_NAME.replace("/", "--")
    candidate = MODEL_DIR / "tts" / slug
    # The main weights file is called "model.pth"
    return (candidate / "model.pth").exists()


def download_model_with_progress():
    """
    Download XTTS-v2 from HuggingFace Hub showing a tqdm progress bar.
    Skipped automatically if the model is already present.
    """
    if _model_already_downloaded():
        print("[✓] Model already downloaded — skipping.", flush=True)
        return

    print("[↓] Downloading XTTS-v2 model (~1.8 GB) to:", MODEL_DIR, flush=True)
    print("    This only happens once.\n", flush=True)

    try:
        from huggingface_hub import snapshot_download, list_repo_files
        from huggingface_hub.utils import HfHubHTTPError
        import requests
        from tqdm import tqdm

        # Collect all file names so we can show a per-file bar
        all_files = list(list_repo_files(HF_REPO_ID, revision=HF_REVISION))

        # Destination: same place Coqui TTS expects the model
        slug        = MODEL_NAME.replace("/", "--")
        dest_folder = MODEL_DIR / "tts" / slug
        dest_folder.mkdir(parents=True, exist_ok=True)

        total_files = len(all_files)
        for idx, filename in enumerate(all_files, 1):
            dest_file = dest_folder / filename
            dest_file.parent.mkdir(parents=True, exist_ok=True)

            if dest_file.exists():
                print(f"  [{idx}/{total_files}] Already exists, skipping: {filename}", flush=True)
                continue

            # Resolve the direct download URL
            url = (
                f"https://huggingface.co/{HF_REPO_ID}/resolve/"
                f"{HF_REVISION}/{filename}"
            )

            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()

            total_size = int(response.headers.get("content-length", 0))
            desc       = f"  [{idx}/{total_files}] {filename}"

            with tqdm(
                total=total_size,
                unit="B",
                unit_scale=True,
                unit_divisor=1024,
                desc=desc,
                ncols=90,
            ) as bar, open(dest_file, "wb") as fh:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        fh.write(chunk)
                        bar.update(len(chunk))

        print("\n[✓] Download complete.\n", flush=True)

    except ImportError:
        # Fallback: let Coqui's own downloader handle it (still shows a bar)
        print(
            "[!] huggingface_hub or tqdm not found — "
            "falling back to Coqui's built-in downloader.\n",
            flush=True,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Core voice-cloning logic
# ─────────────────────────────────────────────────────────────────────────────

def clone_voice(audio_path: str, text: str, output_path: str, language: str = "en"):
    """Load the TTS model and synthesise speech in the reference voice."""

    # Ensure model is present before importing TTS (import itself is slow)
    download_model_with_progress()

    print("[•] Loading XTTS-v2 model into memory…", flush=True)
    try:
        from TTS.api import TTS
    except ImportError:
        sys.exit(
            "[✗] Coqui TTS is not installed.\n"
            "    Run: pip install TTS"
        )

    tts = TTS(model_name=MODEL_NAME, progress_bar=False)

    print(f"[•] Synthesising speech  ({language})…", flush=True)
    print(f"    Reference : {audio_path}",  flush=True)
    print(f"    Text      : {text[:80]}{'…' if len(text) > 80 else ''}", flush=True)
    print(f"    Output    : {output_path}", flush=True)

    tts.tts_to_file(
        text=text,
        speaker_wav=audio_path,
        language=language,
        file_path=output_path,
    )

    print(f"\n[✓] Done!  Audio saved to: {output_path}", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="voice_cloner",
        description=(
            "Offline voice cloning — clone any voice from a ~10-second audio sample.\n"
            "Model is downloaded once to  tts_models/  next to this executable."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  voice_cloner --audio ref.wav --text \"Hello world\" --output out.wav\n"
            "  voice_cloner --audio ref.wav --text \"Bonjour\" --output out.wav --language fr\n\n"
            "Supported language codes:\n"
            "  en  es  fr  de  it  pt  pl  tr  ru  nl  cs  ar  zh-cn  ja  ko  hu"
        ),
    )
    parser.add_argument(
        "--audio",    required=True,
        metavar="FILE",
        help="Reference audio file (WAV / MP3 / FLAC, ~10 seconds)",
    )
    parser.add_argument(
        "--text",     required=True,
        metavar="TEXT",
        help="Text to synthesise in the cloned voice",
    )
    parser.add_argument(
        "--output",   required=True,
        metavar="FILE",
        help="Output WAV file path",
    )
    parser.add_argument(
        "--language", default="en",
        metavar="LANG",
        help="Language code (default: en)",
    )

    args = parser.parse_args()

    # ── Validate inputs ───────────────────────────────────────────────────────
    if not os.path.isfile(args.audio):
        sys.exit(f"[✗] Reference audio not found: {args.audio}")

    text = args.text.strip()
    if not text:
        sys.exit("[✗] --text must not be empty.")

    # Ensure the output directory exists
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    clone_voice(
        audio_path=args.audio,
        text=text,
        output_path=str(out_path),
        language=args.language,
    )


if __name__ == "__main__":
    main()