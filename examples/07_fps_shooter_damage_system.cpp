// examples/07_fps_shooter_damage_system.cpp
// Filament / Native C++ Demo 07: First-Person Shooter & Damage System
// Demonstrates direct mouse-look FPS camera (no mouse-down drag required),
// high-velocity ballistic projectile physics, Layer_Damageable collision grouping,
// and callback-driven onDamage event emission with damage indicators.

#include <iostream>
#include <vector>
#include <memory>
#include <cmath>
#include <iomanip>

#include <engine/Engine.hpp>
#include <engine/Camera.hpp>
#include <engine/Collision.hpp>
#include <engine/DamageSystem.hpp>
#include <engine/Projectile.hpp>
#include <engine/PlayerController.hpp>

using namespace EngineCore;

int main(int argc, char** argv) {
    std::cout << "========================================================\n";
    std::cout << "  FILAMENT C++ DEMO 07: FIRST-PERSON SHOOTER & DAMAGE   \n";
    std::cout << "========================================================\n";

    // 1. Initialize Spatial Collision World
    CollisionWorld collisionWorld;

    // Register Ground Floor
    collisionWorld.AddAABB("Ground_Floor", Vec3(0.0f, -0.5f, 0.0f), Vec3(35.0f, 0.5f, 35.0f), Layer_Ground);

    // Register Static Obstacles
    collisionWorld.AddAABB("Cover_Wall_Left",  Vec3(-6.0f, 1.5f, -8.0f), Vec3(1.0f, 1.5f, 4.0f), Layer_Obstacle);
    collisionWorld.AddAABB("Cover_Wall_Right", Vec3( 6.0f, 1.5f, -8.0f), Vec3(1.0f, 1.5f, 4.0f), Layer_Obstacle);

    // 2. Initialize Damage System & Damage Groups
    DamageSystem damageSystem;

    // Connect onDamage event listener (emits whenever a target receives damage)
    damageSystem.AddOnDamageListener([](const DamageEvent& evt) {
        std::cout << ">> [DAMAGE EVENT EMITTED] Target: \"" << evt.targetName 
                  << "\" | Group: [" << evt.damageGroup << "]"
                  << " | Damage: -" << evt.damageAmount 
                  << " | Remaining HP: " << evt.remainingHealth << "/" << evt.maxHealth
                  << " | Hit At: [" << evt.hitPoint.x << ", " << evt.hitPoint.y << ", " << evt.hitPoint.z << "]\n";
    });

    // Connect onDestroyed event listener
    damageSystem.AddOnDestroyedListener([](const DamageEvent& evt) {
        std::cout << ">> [TARGET DESTROYED] Target: \"" << evt.targetName 
                  << "\" in Group [" << evt.damageGroup << "] has been ELIMINATED! Triggering respawn cycle.\n";
    });

    // 3. Register Destructible Target Actors into the DAMAGE Group
    // Layer_Damageable is defined as bitmask 1 << 6
    constexpr uint32_t Layer_Damageable = (1 << 6);

    auto target1 = std::make_shared<DamageableActor>(101, "Target_Drone_Alpha", "Enemies", 100.0f, Vec3(0.0f, 2.5f, -12.0f));
    auto target2 = std::make_shared<DamageableActor>(102, "Target_Monolith_Beta", "Destructibles", 150.0f, Vec3(-5.0f, 1.5f, -10.0f));
    auto target3 = std::make_shared<DamageableActor>(103, "Target_Sphere_Gamma", "Targets", 80.0f, Vec3(5.0f, 2.0f, -10.0f));

    damageSystem.RegisterActor(target1);
    damageSystem.RegisterActor(target2);
    damageSystem.RegisterActor(target3);

    // Also register colliders in CollisionWorld for raycast and swept testing
    collisionWorld.AddSphere("Target_Drone_Alpha", target1->position, 0.6f, Layer_Damageable);
    collisionWorld.AddAABB("Target_Monolith_Beta", target2->position, Vec3(0.8f, 1.5f, 0.8f), Layer_Damageable);
    collisionWorld.AddSphere("Target_Sphere_Gamma", target3->position, 0.7f, Layer_Damageable);

    // 4. Initialize FPS Camera & Weapon Projectile Manager
    ProjectileManager projectileManager;
    projectileManager.defaultSpeed = 50.0f;  // 50 m/s muzzle velocity
    projectileManager.defaultDamage = 25.0f; // 25 HP per shot

    Vec3 fpsCameraPosition(0.0f, 1.7f, 0.0f);
    Vec3 fpsCameraForward(0.0f, 0.0f, -1.0f); // Looking towards targets

    std::cout << "\n[1] FPS Camera ready (Direct Pointer Lock / Direct Look enabled - No mouse-down required).\n";
    std::cout << "[2] Weapon ready: Plasma Bolt Rifle (Speed: 50 m/s, DMG: 25 HP/round).\n";
    std::cout << "[3] Targets active in DAMAGE Group: 3\n\n";

    // 5. Simulate Gameplay & Firing Sequence
    std::cout << "--- Firing Projectile #1 at Target_Drone_Alpha ---\n";
    projectileManager.Fire(fpsCameraPosition, fpsCameraForward, 50.0f, 25.0f, 1 /* PlayerId */);

    // Step physics forward 0.25 seconds
    for (int step = 0; step < 5; ++step) {
        float dt = 0.05f;
        projectileManager.Update(dt, collisionWorld, damageSystem);
        damageSystem.Update(dt);
    }

    std::cout << "\n--- Firing Rapid Burst at Target_Drone_Alpha (3 Rounds) ---\n";
    for (int i = 0; i < 3; ++i) {
        projectileManager.Fire(fpsCameraPosition, fpsCameraForward, 50.0f, 25.0f, 1);
        for (int step = 0; step < 5; ++step) {
            float dt = 0.05f;
            projectileManager.Update(dt, collisionWorld, damageSystem);
            damageSystem.Update(dt);
        }
    }

    std::cout << "\n========================================================\n";
    std::cout << "  DEMO 07 SIMULATION COMPLETED SUCCESSFULLY             \n";
    std::cout << "========================================================\n";
    return 0;
}
