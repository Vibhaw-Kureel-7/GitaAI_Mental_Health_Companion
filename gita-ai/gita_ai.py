"""
╔══════════════════════════════════════════════════════════════╗
║              🕉️  GITA AI  —  CLI Interface                   ║
║         Bhagavad Gita Mental Health AI (LoRA Router)         ║
╚══════════════════════════════════════════════════════════════╝

Usage:
    gita_ai.exe "your question here"
    gita_ai.exe --interactive
    gita_ai.exe --help

Folder layout (all must be in the SAME directory as the exe):
    gita_ai.exe
    router_embeddings.pkl
    lora_adapters_LLM1/
    lora_adapters_LLM2/
    lora_adapters_LLM3/
    lora_adapters_LLM6/
"""
import sys
import io
import os

# ── Resolve base directory first (works both as .py and frozen exe) ──
if getattr(sys, "frozen", False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Fix stdout/stderr encoding (only wrap if buffer exists) ──
if sys.stdout is not None and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr is not None and hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HF_CACHE = os.path.join(BASE_DIR, "hf_cache")
HF_HUB_CACHE = os.path.join(HF_CACHE, "hub")   # ← where models actually live
os.makedirs(HF_HUB_CACHE, exist_ok=True)

os.environ["HF_HOME"] = HF_CACHE
os.environ["HF_HUB_CACHE"] = HF_HUB_CACHE       # ← tell HF where hub cache is
os.environ["SENTENCE_TRANSFORMERS_HOME"] = HF_CACHE
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"

# Go offline if models already cached
if os.path.exists(HF_HUB_CACHE) and any(os.scandir(HF_HUB_CACHE)):
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HUB_OFFLINE"] = "1"

import pickle
import argparse
import numpy as np




# ──────────────────────────────────────────────────────────────
#  CONFIG
# ──────────────────────────────────────────────────────────────
LLM_CONFIGS = {
    "LLM-1  (Chapter 1)": {
        "folder": os.path.join(BASE_DIR, "lora_adapters_LLM1"),
        "system": (
            "You are a crisis intervention AI focused on Grief, Despair (Vishada), "
            "and overwhelming anxiety. Your sole purpose is to address panic attacks, "
            "severe overwhelm, and decision paralysis by providing immediate grounding "
            "and psychological stabilization."
        ),
        "label": "LLM-1 (Chapter 1 · Vishada / Crisis)"
    },
    "LLM-2  (Chapter 2)": {
        "folder": os.path.join(BASE_DIR, "lora_adapters_LLM2"),
        "system": (
            "You are a cognitive resilience AI (Sankhya). Your core focus is cognitive "
            "restructuring, managing unmet expectations, and building unshakable emotional "
            "stability. Help users reframe negative thoughts and separate their self-worth "
            "from temporary outcomes."
        ),
        "label": "LLM-2 (Chapter 2 · Sankhya / Resilience)"
    },
    "LLM-3  (Chapter 3)": {
        "folder": os.path.join(BASE_DIR, "lora_adapters_LLM3"),
        "system": (
            "You are an action-oriented motivational AI (Karma). Your specialty is "
            "overcoming depressive lethargy, burnout, and lack of purpose. Guide users "
            "to break inertia by focusing strictly on the effort and immediate duty, "
            "while completely detaching from the final outcome."
        ),
        "label": "LLM-3 (Chapter 3 · Karma / Action)"
    },
    "LLM-6  (Chapter 6)": {
        "folder": os.path.join(BASE_DIR, "lora_adapters_LLM6"),
        "system": (
            "You are a mindfulness and grounding AI (Dhyana). Your expertise is calming "
            "a restless, racing mind. Provide immediate mindfulness exercises and grounding "
            "techniques to stop overthinking spirals and bring the user back to the present moment."
        ),
        "label": "LLM-6 (Chapter 6 · Dhyana / Mindfulness)"
    },
}

# Maps bnb-4bit model names → standard float16 equivalents
BNB_TO_STANDARD = {
    "unsloth/llama-3.2-1b-instruct-bnb-4bit":  "unsloth/Llama-3.2-1B-Instruct",
    "unsloth/llama-3.2-1B-instruct-bnb-4bit":  "unsloth/Llama-3.2-1B-Instruct",
    "unsloth/Llama-3.2-1B-Instruct-bnb-4bit":  "unsloth/Llama-3.2-1B-Instruct",
    "unsloth/llama-3.2-3b-instruct-bnb-4bit":  "unsloth/Llama-3.2-3B-Instruct",
    "unsloth/llama-3.1-8b-instruct-bnb-4bit":  "unsloth/Meta-Llama-3.1-8B-Instruct",
}

CACHE_FILE      = os.path.join(BASE_DIR, "router_embeddings.pkl")
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
TOP_K           = 5
MAX_NEW_TOKENS  = 200

BANNER = """
╔══════════════════════════════════════════════════════════╗
║          🕉️  GITA AI  —  Bhagavad Gita Mental Health     ║
║             Powered by LoRA-Finetuned Llama 3.2          ║
╚══════════════════════════════════════════════════════════╝"""


# ──────────────────────────────────────────────────────────────
#  Check bitsandbytes availability once at startup
# ──────────────────────────────────────────────────────────────
def _check_bitsandbytes() -> bool:
    try:
        import bitsandbytes  # noqa: F401
        return True
    except (ImportError, Exception):
        return False

HAS_BNB = _check_bitsandbytes()


# ──────────────────────────────────────────────────────────────
#  ROUTING
# ──────────────────────────────────────────────────────────────

def load_embeddings() -> dict:
    if not os.path.exists(CACHE_FILE):
        print(f"\n❌  ERROR: '{CACHE_FILE}' not found.")
        print("     Make sure router_embeddings.pkl is in the same folder as the exe.")
        sys.exit(1)
    with open(CACHE_FILE, "rb") as f:
        return pickle.load(f)


def route_question(question: str, embeddings: dict, embed_model) -> tuple:
    from sklearn.metrics.pairwise import cosine_similarity

    q_emb = embed_model.encode([question], convert_to_numpy=True)

    all_sims = []
    for key, emb_matrix in embeddings.items():
        sims = cosine_similarity(q_emb, emb_matrix)[0]
        for s in sims:
            all_sims.append((float(s), key))

    all_sims.sort(reverse=True, key=lambda x: x[0])
    top_neighbours = all_sims[:TOP_K]

    vote_count = {}
    for _, key in top_neighbours:
        vote_count[key] = vote_count.get(key, 0) + 1

    avg_scores = {}
    for key, emb_matrix in embeddings.items():
        sims = cosine_similarity(q_emb, emb_matrix)[0]
        avg_scores[key] = float(np.mean(np.sort(sims)[-TOP_K:]))

    best_key   = max(vote_count, key=vote_count.get)
    confidence = vote_count[best_key] / TOP_K
    return best_key, avg_scores, confidence


def print_routing_table(best_key: str, scores: dict, confidence: float):
    print("\n┌──────────────────────────────────────────────────────────────┐")
    print("│                      📊  ROUTING SCORES                      │")
    print("├──────────────────────────────────────────────────────────────┤")
    for key, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        label = LLM_CONFIGS.get(key, {}).get("label", key)
        bar   = "█" * int(score * 24)
        pct   = score * 100
        arrow = "  ◀ SELECTED" if key == best_key else ""
        print(f"│  {label:<40}  {pct:5.1f}%  {bar:<7}{arrow}")
    print("├──────────────────────────────────────────────────────────────┤")
    best_label = LLM_CONFIGS.get(best_key, {}).get("label", best_key)
    print(f"│  ✅  Routed to : {best_label}")
    print(f"│  🎯  Confidence: {confidence * 100:.0f}%  ({int(confidence * TOP_K)}/{TOP_K} votes)")
    print("└──────────────────────────────────────────────────────────────┘")


# ──────────────────────────────────────────────────────────────
#  MODEL LOADING & INFERENCE
# ──────────────────────────────────────────────────────────────

_cache = {
    "base_model":   None,
    "tokenizer":    None,
    "active_key":   None,
    "active_model": None,
}


def _read_adapter_base_name(adapter_folder: str) -> str:
    """Read base_model_name_or_path from adapter_config.json."""
    import json
    cfg_path = os.path.join(adapter_folder, "adapter_config.json")
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path) as f:
                return json.load(f).get("base_model_name_or_path", "").strip()
        except Exception:
            pass
    return ""


def _resolve_model_name(adapter_folder: str) -> tuple:
    """
    Returns (model_name_to_load, use_4bit).

    - If adapter was trained on a bnb-4bit model AND bitsandbytes is available
      → load that 4-bit model directly.
    - If adapter was trained on a bnb-4bit model AND bitsandbytes is NOT available
      → map to the standard float16 equivalent and warn the user.
    - Otherwise → load the model name as-is in float16.
    """
    raw = _read_adapter_base_name(adapter_folder)
    is_bnb = "bnb-4bit" in raw.lower()

    if is_bnb:
        if HAS_BNB:
            return raw, True
        else:
            # Case-insensitive lookup in our mapping table
            standard = None
            for k, v in BNB_TO_STANDARD.items():
                if k.lower() == raw.lower():
                    standard = v
                    break
            if not standard:
                # Generic fallback: strip the bnb suffix
                standard = raw.replace("-bnb-4bit", "").replace("_bnb_4bit", "")
            print(f"\n  ⚠️   bitsandbytes not available — switching to float16 fallback:")
            print(f"        Original : {raw}")
            print(f"        Fallback : {standard}")
            print("        Tip: run  pip install bitsandbytes  then rebuild for 4-bit speed.\n")
            return standard, False
    else:
        return raw or "unsloth/Llama-3.2-1B-Instruct", False


def load_base_model(adapter_folder: str):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    if _cache["base_model"] is not None:
        return

    model_name, use_4bit = _resolve_model_name(adapter_folder)
    
    # HuggingFace stores models in hf_cache/hub/ not hf_cache/ directly
    HF_HUB_CACHE = os.path.join(HF_CACHE, "hub")
    os.makedirs(HF_HUB_CACHE, exist_ok=True)

    mode_str = "4-bit quantized (bitsandbytes)" if use_4bit else "float16"
    print(f"\n⚙️   Loading base model  →  {model_name}")
    print(f"     Mode : {mode_str}")
    print("     (First run downloads the model; subsequent runs use the local cache)\n")

    _cache["tokenizer"] = AutoTokenizer.from_pretrained(
        model_name, cache_dir=HF_HUB_CACHE
    )

    _cache["base_model"] = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16,
        cache_dir=HF_HUB_CACHE,
        device_map="auto",
    )

    print("  ✅  Base model ready.\n")


def get_model(key: str):
    from peft import PeftModel

    adapter_folder = LLM_CONFIGS[key]["folder"]

    if not os.path.isdir(adapter_folder):
        raise FileNotFoundError(
            f"\n❌  Adapter folder not found: '{adapter_folder}'\n"
            "     Make sure the lora_adapters_LLM* folders are next to the exe."
        )

    load_base_model(adapter_folder)

    if _cache["active_key"] == key:
        return _cache["active_model"]

    label = LLM_CONFIGS[key].get("label", key)
    print(f"⚙️   Attaching LoRA adapter  →  {label} …")
    _cache["active_model"] = PeftModel.from_pretrained(
        _cache["base_model"],
        adapter_folder,
    )
    _cache["active_key"] = key
    print("  ✅  Adapter ready.\n")
    return _cache["active_model"]


def generate_response(question: str, key: str) -> str:
    import torch

    model = get_model(key)
    tok   = _cache["tokenizer"]

    messages = [
        {"role": "system", "content": LLM_CONFIGS[key]["system"]},
        {"role": "user",   "content": question},
    ]

    inputs = tok.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            max_length=None,
            use_cache=True,
            temperature=0.3,
            do_sample=True,
        )

    input_length = inputs["input_ids"].shape[1]
    return tok.decode(outputs[0][input_length:], skip_special_tokens=True).strip()


# ──────────────────────────────────────────────────────────────
#  CORE HANDLER
# ──────────────────────────────────────────────────────────────

def handle_question(question: str, embeddings: dict, embed_model, route_only: bool = False):
    print(f"\n❓  Question: {question}")

    best_key, scores, confidence = route_question(question, embeddings, embed_model)
    print_routing_table(best_key, scores, confidence)

    if route_only:
        print("\n  (Routing only — no response generated)")
        return

    label = LLM_CONFIGS[best_key].get("label", best_key)
    print(f"\n💬  Generating response from {label} …\n")
    try:
        answer = generate_response(question, best_key)
        print("─" * 64)
        print(f"🤖  AI Response:\n\n{answer}")
        print("─" * 64)
    except FileNotFoundError as e:
        print(str(e))
    except Exception as e:
        print(f"❌  Generation error: {e}")


# ──────────────────────────────────────────────────────────────
#  ENTRY POINT
# ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="gita_ai",
        description="🕉️  Gita AI — Bhagavad Gita Mental Health Assistant",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  gita_ai.exe "I feel completely overwhelmed and can't breathe"
  gita_ai.exe "I have no motivation to do anything anymore"
  gita_ai.exe --interactive
  gita_ai.exe --no-generate "I feel burnt out"
        """
    )
    parser.add_argument(
        "question",
        nargs="?",
        help="Your question (in quotes). Omit to use --interactive mode."
    )
    parser.add_argument(
        "-i", "--interactive",
        action="store_true",
        help="Start an interactive chat session."
    )
    parser.add_argument(
        "--no-generate",
        action="store_true",
        help="Only show routing scores, skip LLM generation (fast)."
    )

    args = parser.parse_args()

    if not args.question and not args.interactive:
        parser.print_help()
        sys.exit(0)

    print(BANNER)

    if not HAS_BNB:
        print("\n  ℹ️   bitsandbytes not found — will use float16 (slightly slower).")
        print("       For 4-bit speed: pip install bitsandbytes  then rebuild.\n")

    # ── Load router assets ────────────────────────────────────
    print("📦  Loading router embeddings …")
    embeddings = load_embeddings()
    for key in embeddings:
        if key not in LLM_CONFIGS:
            print(f"  ⚠️  pkl key '{key}' not in LLM_CONFIGS — skipping.")
    print("  ✅  Embeddings loaded.\n")

    print(f"🤖  Loading sentence-transformer  →  {EMBEDDING_MODEL} …")
    from sentence_transformers import SentenceTransformer
    
    # Find the actual snapshot folder inside the cached model directory
    ST_MODEL_BASE = os.path.join(HF_CACHE, "hub", "models--sentence-transformers--all-MiniLM-L6-v2", "snapshots")
    ST_MODEL_PATH = None
    if os.path.exists(ST_MODEL_BASE):
        snapshots = os.listdir(ST_MODEL_BASE)
        if snapshots:
            ST_MODEL_PATH = os.path.join(ST_MODEL_BASE, snapshots[0])
    
    if ST_MODEL_PATH and os.path.exists(ST_MODEL_PATH):
        embed_model = SentenceTransformer(ST_MODEL_PATH)
    else:
        embed_model = SentenceTransformer(EMBEDDING_MODEL, cache_folder=HF_CACHE)
    
    print("  ✅  Router ready.\n")

    # ── Single-shot mode ──────────────────────────────────────
    if args.question and not args.interactive:
        handle_question(args.question, embeddings, embed_model, route_only=args.no_generate)
        return

    # ── Interactive mode ──────────────────────────────────────
    print("✅  System ready!  Type your question below.")
    print("    Commands: 'exit'/'quit' to stop  |  prefix 'route:' to skip generation\n")

    while True:
        try:
            raw = input("❓  You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋  Goodbye!")
            break

        if not raw:
            continue
        if raw.lower() in {"exit", "quit", "q"}:
            print("👋  Goodbye!")
            break

        route_only = raw.lower().startswith("route:")
        question   = raw[len("route:"):].strip() if route_only else raw

        handle_question(question, embeddings, embed_model, route_only=route_only)
        print()


if __name__ == "__main__":
    main()