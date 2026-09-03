from pathlib import Path
import json
import torch
from huggingface_hub import hf_hub_download

ROOT = Path(__file__).resolve().parents[1]
RECIPE = json.loads((ROOT / "config" / "voice_recipe.json").read_text(encoding="utf-8"))
MODEL_DIR = ROOT / "model"
MODEL_DIR.mkdir(exist_ok=True)

def download_voice(name: str) -> Path:
    return Path(hf_hub_download(
        repo_id=RECIPE["base_repo"],
        filename=f"voices/{name}.pt"
    ))

def load(name: str):
    return torch.load(download_voice(name), map_location="cpu", weights_only=True).float()

def mix(weights: dict):
    total = sum(float(v) for v in weights.values())
    if total <= 0:
        raise ValueError("Pesos inválidos.")
    out = None
    for name, w in weights.items():
        if not w:
            continue
        tensor = load(name)
        term = tensor * (float(w) / total)
        out = term if out is None else out + term
    return out.contiguous()

def main():
    print("Criando identidade vocal JORDAN Spark V1...")
    for emotion, weights in RECIPE["emotion_mix"].items():
        tensor = mix(weights)
        path = MODEL_DIR / f"jordan_spark_v1_{emotion}.pt"
        torch.save(tensor, path)
        print("OK:", path.name, tuple(tensor.shape))
    marker = MODEL_DIR / "VOICE_READY.txt"
    marker.write_text(
        "JORDAN Spark V1 gerada com sucesso.\n"
        "Os arquivos .pt desta pasta são embeddings de voz Kokoro e precisam "
        "do modelo base Kokoro-82M para síntese.\n",
        encoding="utf-8"
    )
    print("\nVoz pronta. Agora execute: python scripts/generate_samples.py")

if __name__ == "__main__":
    main()
