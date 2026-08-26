#!/bin/bash
# ==============================================================================
# Build Procedure: Export to Web / WebAssembly via Emscripten
# Compiles C++ graphics pipeline to .wasm and .js with WebGL2 / WebGPU bindings
# ==============================================================================

set -e

echo "=== Compiling Engine to WebAssembly (Emscripten) ==="

# 1. Check if emcc / emcmake is active
if ! command -v emcmake &> /dev/null; then
    echo "Error: emcmake / Emscripten SDK is not found in PATH."
    echo "Please activate emsdk:"
    echo "  source /path/to/emsdk/emsdk_env.sh"
    exit 1
fi

BUILD_DIR="build_wasm"
mkdir -p $BUILD_DIR
cd $BUILD_DIR

# 2. Configure with CMake using Emscripten toolchain
emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DEMSCRIPTEN=ON

# 3. Build optimized WASM binary
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "=== Build Complete: output generated in dist/ / build_wasm/ ==="
