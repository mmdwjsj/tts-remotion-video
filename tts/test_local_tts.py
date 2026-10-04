from pathlib import Path
import sys

# =========================
# 1. 路径配置
# =========================

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
ONNX_DIR = MODEL_DIR / "onnx"

print("=" * 60)
print("Kokoro Thai TTS 测试")
print("=" * 60)

print(f"项目目录: {BASE_DIR}")
print(f"模型目录: {MODEL_DIR}")
print(f"ONNX目录: {ONNX_DIR}")
print()


# =========================
# 2. 检查模型文件
# =========================

required_files = [
    "curves_fp32.onnx",
    "decoder_fp32.onnx",
    "prosody_fp32.onnx",
    "onnx_manifest.json",
    "source_params.npz",
    "styles.npz",
    "voicepacks.npz",
]

print("[1/4] 检查模型文件...")

missing = []

for filename in required_files:
    path = ONNX_DIR / filename

    if path.exists():
        size_mb = path.stat().st_size / 1024 / 1024
        print(f"  ✓ {filename} ({size_mb:.1f} MB)")
    else:
        print(f"  ✗ {filename} 不存在")
        missing.append(filename)

if missing:
    print()
    print("模型文件不完整，请检查下载。")
    sys.exit(1)

print("模型文件检查通过")
print()


# =========================
# 3. 检查 Python 依赖
# =========================

print("[2/4] 检查 Python 依赖...")

try:
    import numpy as np
    print(f"  ✓ numpy {np.__version__}")
except ImportError:
    print("  ✗ numpy 未安装")
    print("    pip install numpy")
    sys.exit(1)

try:
    import soundfile as sf
    print("  ✓ soundfile")
except ImportError:
    print("  ✗ soundfile 未安装")
    print("    pip install soundfile")
    sys.exit(1)

try:
    import onnxruntime as ort
    print(f"  ✓ onnxruntime {ort.__version__}")
except ImportError:
    print("  ✗ onnxruntime 未安装")
    print("    pip install onnxruntime")
    sys.exit(1)

print()


# =========================
# 4. 检查 ONNX Runtime
# =========================

print("[3/4] 检查 ONNX Runtime...")

print("可用执行设备:")

for provider in ort.get_available_providers():
    print(f"  ✓ {provider}")

print()


# =========================
# 5. 加载三个 ONNX 模型
# =========================

print("[4/4] 加载 ONNX 模型...")

models = [
    "prosody_fp32.onnx",
    "decoder_fp32.onnx",
    "curves_fp32.onnx",
]

sessions = {}

for filename in models:

    path = ONNX_DIR / filename

    print(f"\n加载: {filename}")

    try:
        session = ort.InferenceSession(
            str(path),
            providers=["CPUExecutionProvider"]
        )

        sessions[filename] = session

        print("  ✓ 加载成功")

        print("  输入:")

        for inp in session.get_inputs():
            print(
                f"    - {inp.name}"
                f" | shape={inp.shape}"
                f" | type={inp.type}"
            )

        print("  输出:")

        for out in session.get_outputs():
            print(
                f"    - {out.name}"
                f" | shape={out.shape}"
                f" | type={out.type}"
            )

    except Exception as e:
        print("  ✗ 加载失败")
        print(f"  错误: {e}")

print()
print("=" * 60)
print("诊断完成")
print("=" * 60)

print()
print("下一步：")
print("请把这个程序的完整输出发给我。")
print("我会根据实际 ONNX 输入/输出接口，给你写真正的泰语 TTS 推理代码。")