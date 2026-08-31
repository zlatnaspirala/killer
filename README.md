# killer — C++17 & Google Filament 3D Engine Studio

**High-performance C++17 / WebAssembly 3D graphics & gameplay workbench**  
Built on **Google Filament** physically-based rendering, zero-allocation frame loops, kinematic player locomotion, continuous collision detection (CCD), and a modular FPS damage system.

> One source. Three targets.  
> Desktop · Web (WASM) · Android — from a single C++17 codebase.

---

## Why this engine exists

Most engines force you to choose:  
- beautiful PBR materials **or** tiny binary size  
- native performance **or** browser deployment  
- full kinematic character controller **or** easy multi-platform builds

**killer** refuses that trade-off.

It is a lean, modern C++17 workbench that ships the same source to:

| Target          | Graphics Backend          | Window / Input          | Build System      |
|-----------------|---------------------------|-------------------------|-------------------|
| Desktop         | Filament (OpenGL / Vulkan)| **SDL2**                | CMake             |
| Web             | Filament (WebGL 2.0)      | Emscripten + SDL2       | Emscripten        |
| Android         | Filament (OpenGL ES 3)    | Android NDK + SDL2      | NDK + CMake       |

---

## Multi-platform from a single source

The entire engine (rendering, physics, player controller, damage system, input) is written once in modern C++17.

- **No platform-specific `#ifdef` hell** in gameplay code  
- **SDL2** provides a unified window, input, and audio abstraction across all targets  
- **Google Filament** delivers the same PBR shading model on every platform  
- **Emscripten** turns the exact same C++ into high-performance WebAssembly  
- **Android NDK** builds produce native ARM64 binaries with the same codebase

This is the classic “write once, run everywhere” promise — actually delivered for a serious real-time 3D engine.

### Why SDL2 is excellent for this architecture

SDL2 (Simple DirectMedia Layer) is one of the most battle-tested cross-platform libraries in the industry:

- **True abstraction layer** — your code talks to SDL, SDL talks to Windows, macOS, Linux, Android, iOS, and the browser (via Emscripten).  
- **Zlib license** — free for commercial use, static or dynamic linking, no royalties.  
- **Tiny & stable** — extremely low overhead, rock-solid ABI compatibility.  
- **Used by real games** — Factorio, Celeste, Hollow Knight (Linux), Source engine titles on non-Windows platforms, and countless indie projects.  
- **Perfect Emscripten partner** — SDL2 is first-class in the Emscripten toolchain, giving you the same input and windowing API in the browser.  
- **Future-proof** — actively maintained, supports Wayland, Metal, Vulkan, and modern mobile.

In short: SDL2 removes 90 % of the pain of multi-platform support so you can focus on the actual engine.

---

## Key Features

### 1. Rendering Architecture & PBR Pipeline
- **Filament PBR** — Cook-Torrance microfacet BRDF, GGX / Trowbridge-Reitz NDF, Schlick Fresnel, Smith geometric shadowing, metallic-roughness workflow.
- **Zero-allocation host loops** — typed buffer reuse, pre-allocated matrices, no GC pressure.
- **Dynamic materials & lighting** — real-time directional irradiance, ambient hemisphere, roughness, metallic, emissive, specular tint, wireframe barycentric overlay, depth testing.

### 2. Kinematic Player Controller & Locomotion
- Smooth acceleration, sprint states, friction dampening, variable gravity, jump buffering, coyote time.
- **Multi-view camera system**
  - FPS Shooter Direct Look (Pointer Lock + recoil + muzzle flare)
  - Third-Person Spring Arm (obstacle avoidance + look-at damping)
  - Free-Fly 6-DOF developer flycam
  - Interactive Orbit / Studio turntable
- Virtual touch joystick + aimpad for mobile.

### 3. Physics & Continuous Collision Detection (CCD)
- Collision primitives: AABB, Sphere, Swept Capsule / Cylinder
- Trigger zones & collectible volumes
- Bitmask collision layers (`Layer_Player`, `Layer_Obstacle`, `Layer_Ground`, `Layer_Trigger`, `Layer_Damageable`, `Layer_Projectile` …)
- Multi-pass contact resolution, sliding, corner handling, step-ups, slope detection.

### 4. FPS Damage System & Projectile Physics
| Weapon                | Damage | Velocity | Notes                  |
|-----------------------|--------|----------|------------------------|
| Plasma Bolt           | 25.0   | 50 m/s   | Energy trail           |
| Heavy Kinetic Slug    | 40.0   | 75 m/s   | High impact force      |
| Quantum Railgun Pulse | 75.0   | 120 m/s  | Extreme penetration    |

- Enemies, destructibles, practice targets
- Floating combat feedback, hitmarkers, hit-flash, health bars, auto-respawn

---

## Repository Structure
<pre>
├── include/engine/
│   ├── Engine.hpp
│   ├── Camera.hpp
│   ├── Collision.hpp
│   ├── PlayerController.hpp
│   ├── DamageSystem.hpp
│   ├── Projectile.hpp
│   ├── GLBLoader.hpp
│   ├── Input.hpp
│   └── Renderer.hpp
├── src/core/
│   └── Engine.cpp
├── examples/
│   ├── 01_pbr_material_preview.cpp
│   ├── 02_metallic_roughness_matrix.cpp
│   ├── 03_trefoil_studio.cpp
│   ├── 04_wasm_webgl_wrapper.cpp
│   ├── 05_desktop_standalone_app.cpp
│   ├── 06_glb_character_collision_player.cpp
│   └── 07_fps_shooter_damage_system.cpp
├── index.html
├── main.js
├── CMakeLists.txt
├── build_wasm.sh
├── build_desktop.sh
└── build_android.sh
</pre>

## Controls
<pre>
| Action                        | Keyboard / Mouse                          | Touch / Mobile              |
|-------------------------------|-------------------------------------------|-----------------------------|
| Move Forward / Back           | `W` / `S`                                 | Left Virtual Joystick       |
| Strafe Left / Right           | `A` / `D`                                 | Left Virtual Joystick       |
| Sprint                        | `Shift` (hold)                            | ⚡ SPRINT button             |
| Jump                          | `Space`                                   | ▲ JUMP button               |
| Look / Aim                    | Mouse (Pointer Lock)                      | Touchpad / canvas swipe     |
| Fire Weapon                   | Left Mouse                                | Tap / Action button         |
| Fly Up / Down (6-DOF only)    | `E` / `Q`                                 | ▲ UP / ▼ DOWN               |
| Cycle Cameras                 | Top-bar dropdown                          | Top-bar selector            |
</pre>
---

## Build Instructions

### 1. Web Development Server (Vite)
```bash
npm install
npm run dev
```
2. WebAssembly (Emscripten)
```Bash
source /path/to/emsdk/emsdk_env.sh
chmod +x build_wasm.sh
./build_wasm.sh
```
3. Desktop Standalone (CMake + SDL2 + Filament)
```Bash
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --parallel $(nproc)
./killer_app
```
4. Android NDK ARM64
```Bash
export ANDROID_NDK_ROOT=/path/to/android-ndk
chmod +x build_android.sh
```

Technology Stack & Attribution
Core technologies

Google Filament — real-time physically based rendering engine
SDL2 — cross-platform windowing, input & audio
Emscripten — C++ → WebAssembly toolchain
C++17, OpenGL ES 3.0 / WebGL 2.0, CMake, Android NDK

Legal note / Trademark notice
Google Filament, SDL, Emscripten, WebAssembly, OpenGL, WebGL and related logos are trademarks or registered trademarks of their respective owners (Google LLC, the SDL project / zlib license, the Emscripten project, the Khronos Group, etc.).

These names and any logos used in this repository are for identification and attribution purposes only.

This project is not affiliated with, endorsed by, or sponsored by Google, the SDL project, the Khronos Group, or any of the above organizations.

License
MIT License.

Built with Google Filament PBR principles and modern C++17.
