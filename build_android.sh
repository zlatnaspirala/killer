#!/bin/bash
# ==============================================================================
# Build Procedure: Android (NDK / JNI / Vulkan / OpenGL ES)
# Compiles Filament C++ core for Android devices (ARM64 / x86_64)
# ==============================================================================

set -e

if [ -z "$ANDROID_NDK_HOME" ]; then
    echo "Warning: ANDROID_NDK_HOME is not set. Defaulting to ~/Android/Sdk/ndk/current"
    export ANDROID_NDK_HOME="$HOME/Android/Sdk/ndk/current"
fi

ABI=${1:-"arm64-v8a"} # Default to arm64-v8a (or x86_64, armeabi-v7a)
BUILD_DIR="build_android_${ABI}"

echo "=== Compiling for Android [${ABI}] using NDK ==="
mkdir -p $BUILD_DIR
cd $BUILD_DIR

cmake .. \
    -DCMAKE_TOOLCHAIN_FILE="$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI="$ABI" \
    -DANDROID_PLATFORM=android-24 \
    -DANDROID_STL=c++_shared \
    -DCMAKE_BUILD_TYPE=Release

cmake --build . --parallel

echo "=== Android shared library compiled: libengine.so for ${ABI} ==="
