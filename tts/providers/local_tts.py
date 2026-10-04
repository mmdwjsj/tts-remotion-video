from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import numpy as np

TTS_DIR = Path(__file__).resolve().parents[1]
MODEL_ROOT = TTS_DIR / "models"
sys.path.insert(0, str(MODEL_ROOT))

from kokoro_thai.onnx_infer import (
    DEFAULT_SEED,
    SAMPLE_RATE,
    load_onnx,
    load_styles,
    synth,
)


def save_wav(path: Path, audio: np.ndarray, sample_rate: int = SAMPLE_RATE):
    """Save float32 [-1, 1] audio as 16-bit PCM WAV."""
    import wave

    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    audio = np.clip(audio, -1.0, 1.0)

    pcm = (audio * 32767.0).astype(np.int16)

    path.parent.mkdir(parents=True, exist_ok=True)

    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm.tobytes())


def main():
    parser = argparse.ArgumentParser(
        description="Thai Kokoro ONNX TTS"
    )

    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--text",
        help="Thai text to synthesize",
    )
    input_group.add_argument(
        "--batch-json",
        help="JSON file containing a list of {text, output} synthesis jobs",
    )

    parser.add_argument(
        "--model",
        default=str(MODEL_ROOT / "onnx"),
        help="ONNX model directory",
    )

    parser.add_argument(
        "--speaker",
        type=int,
        default=1,
        help="Speaker ID stored in styles.npz",
    )

    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        help="Speech speed, e.g. 0.8 / 1.0 / 1.2",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help="Random seed",
    )

    parser.add_argument(
        "--output",
        default="output.wav",
        help="Output WAV file",
    )

    parser.add_argument(
        "--threads",
        type=int,
        default=1,
        help="ONNX Runtime intra-op threads",
    )

    parser.add_argument(
        "--precision",
        choices=["fp32", "fp16"],
        default="fp32",
        help="ONNX precision",
    )

    args = parser.parse_args()

    model_dir = Path(args.model)
    print("Loading ONNX model...")

    student = load_onnx(
        model_dir,
        intra_threads=args.threads,
        precision=args.precision,
    )

    print("Loading speakers...")

    styles = load_styles(model_dir)

    if args.speaker not in styles:
        available = sorted(styles.keys())
        raise ValueError(
            f"Speaker {args.speaker} not found. "
            f"Available speakers: {available}"
        )

    ref_s = styles[args.speaker]

    print(f"Speaker : {args.speaker}")
    print(f"Speed   : {args.speed}")
    print(f"Seed    : {args.seed}")

    if args.batch_json:
        raw_jobs = json.loads(Path(args.batch_json).read_text(encoding="utf-8"))
        if not isinstance(raw_jobs, list) or not raw_jobs:
            raise ValueError("Batch JSON must contain a non-empty list")
        jobs = [(str(job["text"]), Path(job["output"])) for job in raw_jobs]
    else:
        jobs = [(args.text, Path(args.output))]

    for index, (text, output_path) in enumerate(jobs, start=1):
        print(f"Synthesizing {index}/{len(jobs)}: {text}")
        audio = synth(
            student,
            text,
            ref_s,
            speed=args.speed,
            seed=args.seed,
        )
        if audio.size == 0:
            raise RuntimeError(f"No valid phonemes were generated for job {index}")
        save_wav(output_path, audio, SAMPLE_RATE)
        duration = len(audio) / SAMPLE_RATE
        print(f"Output   : {output_path.resolve()}")
        print(f"Duration : {duration:.2f}s")

    print(f"Done: generated {len(jobs)} file(s) with one model load")


if __name__ == "__main__":
    main()
