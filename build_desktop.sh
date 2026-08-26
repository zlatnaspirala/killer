#!/bin/bash
# ==============================================================================
# Build Procedure: Native Desktop (Linux, macOS, Windows)
# Builds standalone C++ application with native OpenGL/Vulkan/Metal backends
# ==============================================================================

set -e

echo "=== Compiling Native Desktop C++ Standalone Engine ==="

BUILD_DIR="build_desktop"
mkdir -p $BUILD_DIR
cd $BUILD_DIR

# 1. Configure CMake with native compiler
cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DFILAMENT_BACKEND=OPENGL

# 2. Compile with all available CPU cores
cmake --build . --config Release --parallel $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "=== Native Desktop Build Complete ==="
