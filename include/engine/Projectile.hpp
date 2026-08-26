// include/engine/Projectile.hpp
// Real-Time High-Velocity Projectile System for FPS Gameplay
// Supports ballistic trajectories, continuous swept raycasts against CollisionWorld,
// and direct damage event triggering through DamageSystem.
#pragma once

#include "Collision.hpp"
#include "DamageSystem.hpp"
#include <vector>
#include <memory>

namespace EngineCore {

struct Projectile {
    uint32_t id = 0;
    Vec3 position;
    Vec3 velocity;
    float radius = 0.15f;
    float damage = 25.0f;
    float lifetime = 3.0f;
    float age = 0.0f;
    bool active = false;
    uint32_t attackerId = 0;
    Vec3 color = Vec3(0.06f, 0.85f, 0.95f); // Bright plasma cyan
};

class ProjectileManager {
public:
    static constexpr size_t MAX_PROJECTILES = 64;
    std::vector<Projectile> pool;
    uint32_t nextId = 1;
    float defaultSpeed = 45.0f;
    float defaultDamage = 25.0f;
    float defaultLifetime = 3.0f;

    ProjectileManager() {
        pool.resize(MAX_PROJECTILES);
        for (auto& p : pool) p.active = false;
    }

    // Spawn / Launch a projectile forward
    bool Fire(const Vec3& origin, const Vec3& direction, float speed = -1.0f, float damage = -1.0f, uint32_t attackerId = 1) {
        float spd = (speed > 0.0f) ? speed : defaultSpeed;
        float dmg = (damage > 0.0f) ? damage : defaultDamage;
        Vec3 dirNorm = direction.Normalized();

        for (auto& p : pool) {
            if (!p.active) {
                p.id = nextId++;
                p.position = origin;
                p.velocity = dirNorm * spd;
                p.radius = 0.15f;
                p.damage = dmg;
                p.lifetime = defaultLifetime;
                p.age = 0.0f;
                p.active = true;
                p.attackerId = attackerId;
                return true;
            }
        }
        return false; // Pool exhausted
    }

    // Simulate physics and resolve collisions
    void Update(float dt, CollisionWorld& colWorld, DamageSystem& damageSys) {
        for (auto& p : pool) {
            if (!p.active) continue;

            p.age += dt;
            if (p.age >= p.lifetime) {
                p.active = false;
                continue;
            }

            // Continuous swept step
            Vec3 step = p.velocity * dt;
            Vec3 nextPos = p.position + step;

            // Check collision against world
            RaycastHit hit;
            if (colWorld.Raycast(p.position, p.velocity, step.Length(), 0xFFFFFFFF, hit)) {
                // Projectile hit an obstacle or damageable actor
                damageSys.ApplyDamage(hit.colliderId, p.damage, p.attackerId, hit.point, hit.normal);
                p.active = false;
                continue;
            }

            // Direct sphere sweep
            CollisionManifold manifold;
            if (colWorld.CheckSphereCollision(nextPos, p.radius, Layer_Obstacle | Layer_Ground | (1 << 6) /* Layer_Damageable */, manifold)) {
                damageSys.ApplyDamage(manifold.colliderId, p.damage, p.attackerId, manifold.point, manifold.normal);
                p.active = false;
                continue;
            }

            p.position = nextPos;
        }
    }
};

} // namespace EngineCore
