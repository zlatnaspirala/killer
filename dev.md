# killer - C++ & Google Filament 3D Engine Studio

A high-performance C++17 & WebAssembly 3D graphics and gameplay engine workbench built on **Google Filament PBR principles**, zero-allocation frame loops, kinematic player locomotion, continuous collision detection (CCD), and a modular FPS damage system.

---

## 🚀 Key Features

### 1. Rendering Architecture & PBR Pipeline
* **Filament PBR Shading Model**: Physically based metallic-roughness workflow implementing Cook-Torrance microfacet specular BRDF, GGX / Trowbridge-Reitz normal distribution, Schlick's Fresnel approximation, and Smith geometric shadowing.
* **Zero-Allocation Host Loops**: Typed buffer reuse and pre-allocated matrix transformations preventing garbage collection overhead and memory fragmentation.
* **Dynamic Material & Lighting**: Real-time control of directional irradiance, ambient hemisphere light, roughness, metallic, emissive glow, specular tint, wireframe barycentric overlay, and depth testing.

### 2. Kinematic Player Controller & Locomotion
* **Full Locomotion Dynamics**: Smooth acceleration, sprint states, friction dampening, variable gravity, jump buffering, and coyote time.
* **Multi-View Camera System**:
  * **FPS Shooter Direct Look**: Pointer Lock API with mouse-aim pitch/yaw clamping, weapon viewmodel recoil, and muzzle flare.
  * **Third-Person Spring Arm**: Orbit tracking with obstacle avoidance and look-at target damping.
  * **Free-Fly 6-DOF**: Developer flycam for unrestricted world navigation.
  * **Interactive Orbit**: Studio inspection turntable mode.
* **Virtual Touch Joystick**: On-screen multi-touch directional joystick and aimpad for mobile devices.

### 3. Physics & Continuous Collision Detection (CCD)
* **Collision Primitives**:
  * **AABB (Axis-Aligned Bounding Box)**: Static obstacles, monoliths, jump platforms, and environment geometry.
  * **Sphere Colliders**: Physical boulders, drones, and explosive targets.
  * **Swept Capsule / Cylinder**: Kinematic player bounding volume with sliding plane velocity projection.
  * **Trigger Zones**: Non-blocking collectible triggers and spatial volume overlap detection.
* **Collision Layers**: Bitmask-filtered layer politics (`Layer_Default`, `Layer_Player`, `Layer_Obstacle`, `Layer_Ground`, `Layer_Trigger`, `Layer_Collectible`, `Layer_Damageable`, `Layer_Projectile`).
* **Multi-Pass Contact Resolution**: Smooth sliding along arbitrary collision geometry, corner pinch handling, platform step-ups, and slope ground detection.

### 4. FPS Damage System & Projectile Physics
* **High-Yield Weapon Types**:
  * **Plasma Bolt**: 25.0 DMG, 50.0 m/s velocity, energy trail.
  * **Heavy Kinetic Slug**: 40.0 DMG, 75.0 m/s velocity, high impact force.
  * **Quantum Railgun Pulse**: 75.0 DMG, 120.0 m/s velocity, extreme penetration.
* **Damage Groups & Target Management**:
  * **Enemies**: Target Drones and hostile entities.
  * **Destructibles**: Monoliths, explosive crates with splash physics.
  * **Practice Targets**: High-durability combat test spheres.
* **Floating Combat Feedback**: 3D-to-2D projected floating damage numbers, hitmarkers, hit-flash shaders, health bar indicators, and automatic respawn schedulers.

---

## 📁 Repository Structure

```
├── include/
│   └── engine/
│       ├── Engine.hpp              # Native engine lifecycle & tick loop
│       ├── Camera.hpp              # Zero-allocation camera & matrix transforms
│       ├── Collision.hpp           # Spatial hashing, AABBs, Spheres, & CCD
│       ├── PlayerController.hpp    # Kinematic character controller & physics
│       ├── DamageSystem.hpp        # Health components, damage groups & callbacks
│       ├── Projectile.hpp          # Swept projectile physics & impact dispatch
│       ├── GLBLoader.hpp           # glTF 2.0 / GLB mesh & skeleton parser
│       ├── Input.hpp               # Bitmask input politics & key bindings
│       └── Renderer.hpp            # Filament PBR renderer interface
├── src/
│   └── core/
│       └── Engine.cpp              # Core engine implementation
├── examples/
│   ├── 01_pbr_material_preview.cpp
│   ├── 02_metallic_roughness_matrix.cpp
│   ├── 03_trefoil_studio.cpp
│   ├── 04_wasm_webgl_wrapper.cpp
│   ├── 05_desktop_standalone_app.cpp
│   ├── 06_glb_character_collision_player.cpp
│   └── 07_fps_shooter_damage_system.cpp
├── index.html                      # Interactive Engine Studio UI
├── main.js                         # Application runtime & WebGL2 bridge
├── CMakeLists.txt                  # Native CMake build definition
├── build_wasm.sh                   # Emscripten WebAssembly compiler script
├── build_desktop.sh                # Desktop standalone compiler script
└── build_android.sh               # Android NDK ARM64 compiler script
```

---

## 🎮 Controls

| Action | Keyboard / Mouse | Touch / Mobile |
| :--- | :--- | :--- |
| **Move Forward / Back** | `W` / `S` | Left Virtual Joystick |
| **Strafe Left / Right** | `A` / `D` | Left Virtual Joystick |
| **Sprint** | `Shift` (Hold) | `⚡ SPRINT` Action Button |
| **Jump** | `Space` | `▲ JUMP` Action Button |
| **Look / Aim** | Mouse Move (Click canvas for Pointer Lock) | Drag Touchpad / Canvas Swipe |
| **Fire Weapon** | Left Mouse Click | Tap Target / Action Button |
| **Fly Up / Down** (6-DOF Free-Fly Only) | `E` / `Q` | `▲ UP` / `▼ DOWN` |
| **Cycle Cameras** | Top Bar Camera Mode Dropdown | Top Bar Camera Selector |

---

## 🔨 Native Build & Compilation Instructions

### 1. Web Development Server (Vite)
```bash
npm install
npm run dev
```

### 2. WebAssembly Build (Emscripten)
```bash
# Ensure emsdk is activated in your environment
source /path/to/emsdk/emsdk_env.sh

# Run compilation script
chmod +x build_wasm.sh
./build_wasm.sh
```

### 3. Desktop Standalone Build (CMake / SDL2 / OpenGL ES 3.0)
```bash
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --parallel $(nproc)
./killer_app
```

### 4. Android NDK ARM64 Build
```bash
export ANDROID_NDK_ROOT=/path/to/android-ndk
chmod +x build_android.sh
./build_android.sh
```

---

## 📄 License
MIT License. Built with Google Filament PBR principles and C++17.
