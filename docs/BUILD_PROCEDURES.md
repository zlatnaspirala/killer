# Cross-Platform Build & Export Procedures

This document contains instructions for compiling and exporting the Filament / C++ Rendering Core across WebAssembly (Emscripten), Desktop (Linux, macOS, Windows), and Android (NDK).

---

## 1. Web / WebAssembly (Emscripten) Export

### Prerequisites
- Emscripten SDK (`emsdk` 3.1+)
- CMake 3.19+

### Build Steps
```bash
# 1. Activate Emscripten environment
source /path/to/emsdk/emsdk_env.sh

# 2. Run the automated WASM build script
chmod +x build_wasm.sh
./build_wasm.sh

# Or manually configure via CMake:
mkdir -p build_wasm && cd build_wasm
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release -DEMSCRIPTEN=ON
emmake make -j$(nproc)
```

### Compiler Flags Explained:
- `-s WASM=1`: Emits WebAssembly binary.
- `-s USE_WEBGL2=1 -s FULL_ES3=1`: Enables WebGL 2.0 / OpenGL ES 3.0 support.
- `-s ALLOW_MEMORY_GROWTH=1`: Enables dynamic heap expansion.
- `-O3`: Maximum loop unrolling and optimization.
- `--bind`: Embind C++ to JavaScript zero-copy interface.

---

## 2. Desktop Standalone (Linux, macOS, Windows)

### Prerequisites
- GCC / Clang (Linux/macOS) or MSVC (Windows)
- CMake 3.15+
- SDL2 (`libsdl2-dev` on Linux, `brew install sdl2` on macOS)
- Filament precompiled binaries or source

### Build Steps
```bash
# Build native standalone binary
chmod +x build_desktop.sh
./build_desktop.sh

# Or directly with CMake:
mkdir -p build_desktop && cd build_desktop
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release --parallel
```

---

## 3. Android Export (NDK / JNI)

### Prerequisites
- Android NDK r23+ (`$ANDROID_NDK_HOME`)
- CMake 3.22+

### Build Steps
```bash
# Build for ARM64-v8a
chmod +x build_android.sh
./build_android.sh arm64-v8a

# Build for Android x86_64 Emulator
./build_android.sh x86_64
```
Output shared library: `libengine.so` ready to load in Android Kotlin/Java via `System.loadLibrary("engine")`.

---

## 4. Filament Material Compiler (`matc`)

To compile custom `.mat` files into `.filamat` binaries for the Filament runtime:
```bash
# Compile material definition into multi-platform binary
matc -p all -a all -o custom_pbr.filamat examples/03_filament_custom_material.mat
```

---

## 5. Multiplatform UI with RmlUi (Native HTML/CSS Engine)

To render popups and interactive UI (such as the 3D Plinko controls) in native non-web builds (Linux, macOS, Windows, Android, iOS, consoles):
- **Template Location**: `assets/ui/plinko.rml` (Markup) and `assets/ui/plinko.rcss` (Styles).
- **Architecture Interface**: `include/engine/IPlinkoUI.hpp`.
- **Pipeline**: RmlUi generates 2D textured vertex and index buffers that feed directly into the engine's existing VAO/VBO draw pipeline.
- **CMake Dependency**:
  ```cmake
  # In CMakeLists.txt for native builds
  find_package(RmlUi REQUIRED)
  target_link_libraries(NativeEngine PRIVATE RmlUi::Core)
  ```

