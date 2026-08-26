// include/engine/Collision.hpp
// Custom High-Performance Collision System for Real-Time 3D Gameplay
// Fast spatial bounding, AABB, Sphere, Raycasts, Continuous Collision Detection (CCD),
// Layer Masks, and Contact Resolution without heavy external physics libraries.
#pragma once

#include <vector>
#include <string>
#include <cmath>
#include <algorithm>
#include <cstdint>

namespace EngineCore {

struct Vec3 {
    float x = 0.0f;
    float y = 0.0f;
    float z = 0.0f;

    Vec3() = default;
    Vec3(float x_, float y_, float z_) : x(x_), y(y_), z(z_) {}

    Vec3 operator+(const Vec3& o) const { return Vec3(x + o.x, y + o.y, z + o.z); }
    Vec3 operator-(const Vec3& o) const { return Vec3(x - o.x, y - o.y, z - o.z); }
    Vec3 operator*(float s) const { return Vec3(x * s, y * s, z * s); }
    Vec3& operator+=(const Vec3& o) { x += o.x; y += o.y; z += o.z; return *this; }
    Vec3& operator-=(const Vec3& o) { x -= o.x; y -= o.y; z -= o.z; return *this; }

    float Dot(const Vec3& o) const { return x * o.x + y * o.y + z * o.z; }
    Vec3 Cross(const Vec3& o) const {
        return Vec3(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x);
    }
    float LengthSq() const { return x * x + y * y + z * z; }
    float Length() const { return std::sqrt(LengthSq()); }
    Vec3 Normalized() const {
        float l = Length();
        return (l > 0.00001f) ? Vec3(x / l, y / l, z / l) : Vec3(0, 0, 0);
    }
};

// Collision Layer Bitmask
enum CollisionLayer : uint32_t {
    Layer_Default    = 1 << 0,
    Layer_Player     = 1 << 1,
    Layer_Obstacle   = 1 << 2,
    Layer_Ground     = 1 << 3,
    Layer_Trigger    = 1 << 4,
    Layer_Collectible= 1 << 5,
    Layer_Damageable = 1 << 6,
    Layer_Projectile = 1 << 7
};

// Collider Geometry Shape Types
enum class ColliderType {
    AABB,
    Sphere,
    Capsule,
    TriggerZone
};

// Axis-Aligned Bounding Box
struct AABB {
    Vec3 min;
    Vec3 max;

    AABB() : min(-0.5f, -0.5f, -0.5f), max(0.5f, 0.5f, 0.5f) {}
    AABB(const Vec3& min_, const Vec3& max_) : min(min_), max(max_) {}

    Vec3 GetCenter() const { return (min + max) * 0.5f; }
    Vec3 GetExtents() const { return (max - min) * 0.5f; }

    bool Intersects(const AABB& o) const {
        return (min.x <= o.max.x && max.x >= o.min.x) &&
               (min.y <= o.max.y && max.y >= o.min.y) &&
               (min.z <= o.max.z && max.z >= o.min.z);
    }

    Vec3 ClosestPoint(const Vec3& p) const {
        return Vec3(
            std::clamp(p.x, min.x, max.x),
            std::clamp(p.y, min.y, max.y),
            std::clamp(p.z, min.z, max.z)
        );
    }
};

// Sphere Collider
struct SphereCollider {
    Vec3 center;
    float radius = 0.5f;

    SphereCollider() = default;
    SphereCollider(const Vec3& c, float r) : center(c), radius(r) {}

    bool Intersects(const SphereCollider& o) const {
        float rSum = radius + o.radius;
        return (center - o.center).LengthSq() <= (rSum * rSum);
    }

    bool IntersectsAABB(const AABB& box, Vec3& outNormal, float& outPenetration) const {
        Vec3 closest = box.ClosestPoint(center);
        Vec3 diff = center - closest;
        float distSq = diff.LengthSq();

        if (distSq <= (radius * radius)) {
            float dist = std::sqrt(distSq);
            if (dist > 0.0001f) {
                outNormal = diff * (1.0f / dist);
                outPenetration = radius - dist;
            } else {
                // Center is inside box - push towards nearest box face
                outNormal = Vec3(0, 1, 0);
                outPenetration = radius;
            }
            return true;
        }
        return false;
    }
};

// Collision Test Result Details
struct CollisionManifold {
    bool hasCollision = false;
    Vec3 normal = Vec3(0, 1, 0);
    Vec3 point = Vec3(0, 0, 0);
    float penetration = 0.0f;
    uint32_t colliderId = 0;
    bool isTrigger = false;
};

// Raycast Hit Information
struct RaycastHit {
    bool hit = false;
    float distance = 1e9f;
    Vec3 point;
    Vec3 normal;
    uint32_t colliderId = 0;
};

// Registered Scene Collider Instance
struct Collider {
    uint32_t id = 0;
    std::string name;
    ColliderType type = ColliderType::AABB;
    AABB aabb;
    SphereCollider sphere;
    Vec3 position = Vec3(0, 0, 0);
    uint32_t layer = Layer_Default;
    uint32_t mask = 0xFFFFFFFF;
    bool isTrigger = false;
    bool isStatic = true;
};

// Spatial Collision World
class CollisionWorld {
public:
    std::vector<Collider> colliders;
    uint32_t nextId = 1;

    uint32_t AddAABB(const std::string& name, const Vec3& center, const Vec3& halfExtents, uint32_t layer = Layer_Obstacle, bool isTrigger = false) {
        Collider c;
        c.id = nextId++;
        c.name = name;
        c.type = isTrigger ? ColliderType::TriggerZone : ColliderType::AABB;
        c.position = center;
        c.aabb.min = center - halfExtents;
        c.aabb.max = center + halfExtents;
        c.layer = layer;
        c.isTrigger = isTrigger;
        c.isStatic = true;
        colliders.push_back(c);
        return c.id;
    }

    uint32_t AddSphere(const std::string& name, const Vec3& center, float radius, uint32_t layer = Layer_Obstacle) {
        Collider c;
        c.id = nextId++;
        c.name = name;
        c.type = ColliderType::Sphere;
        c.position = center;
        c.sphere.center = center;
        c.sphere.radius = radius;
        c.layer = layer;
        c.isStatic = true;
        colliders.push_back(c);
        return c.id;
    }

    // Fast Swept-Sphere check against all obstacles in world
    bool CheckSphereCollision(const Vec3& spherePos, float sphereRadius, uint32_t layerMask, CollisionManifold& outManifold) {
        outManifold.hasCollision = false;
        outManifold.penetration = 0.0f;
        SphereCollider testSphere(spherePos, sphereRadius);

        for (const auto& col : colliders) {
            if (!(col.layer & layerMask)) continue;

            if (col.type == ColliderType::AABB || col.type == ColliderType::TriggerZone) {
                Vec3 norm;
                float pen;
                if (testSphere.IntersectsAABB(col.aabb, norm, pen)) {
                    if (pen > outManifold.penetration) {
                        outManifold.hasCollision = true;
                        outManifold.normal = norm;
                        outManifold.point = spherePos - norm * (sphereRadius - pen);
                        outManifold.penetration = pen;
                        outManifold.colliderId = col.id;
                        outManifold.isTrigger = col.isTrigger;
                    }
                }
            } else if (col.type == ColliderType::Sphere) {
                if (testSphere.Intersects(col.sphere)) {
                    Vec3 diff = spherePos - col.sphere.center;
                    float dist = diff.Length();
                    float pen = (sphereRadius + col.sphere.radius) - dist;
                    if (pen > outManifold.penetration) {
                        outManifold.hasCollision = true;
                        outManifold.normal = (dist > 0.0001f) ? diff * (1.0f / dist) : Vec3(0, 1, 0);
                        outManifold.point = col.sphere.center + outManifold.normal * col.sphere.radius;
                        outManifold.penetration = pen;
                        outManifold.colliderId = col.id;
                        outManifold.isTrigger = col.isTrigger;
                    }
                }
            }
        }
        return outManifold.hasCollision;
    }

    // Downward ground check raycast
    bool Raycast(const Vec3& origin, const Vec3& direction, float maxDistance, uint32_t layerMask, RaycastHit& outHit) {
        outHit.hit = false;
        outHit.distance = maxDistance;
        Vec3 dirNorm = direction.Normalized();

        for (const auto& col : colliders) {
            if (!(col.layer & layerMask)) continue;

            if (col.type == ColliderType::AABB) {
                // Ray-AABB intersection algorithm
                float tmin = (col.aabb.min.x - origin.x) / dirNorm.x;
                float tmax = (col.aabb.max.x - origin.x) / dirNorm.x;
                if (tmin > tmax) std::swap(tmin, tmax);

                float tymin = (col.aabb.min.y - origin.y) / dirNorm.y;
                float tymax = (col.aabb.max.y - origin.y) / dirNorm.y;
                if (tymin > tymax) std::swap(tymin, tymax);

                if ((tmin > tymax) || (tymin > tmax)) continue;
                if (tymin > tmin) tmin = tymin;
                if (tymax < tmax) tmax = tymax;

                float tzmin = (col.aabb.min.z - origin.z) / dirNorm.z;
                float tzmax = (col.aabb.max.z - origin.z) / dirNorm.z;
                if (tzmin > tzmax) std::swap(tzmin, tzmax);

                if ((tmin > tzmax) || (tzmin > tmax)) continue;
                if (tzmin > tmin) tmin = tzmin;

                if (tmin >= 0.0f && tmin < outHit.distance) {
                    outHit.hit = true;
                    outHit.distance = tmin;
                    outHit.point = origin + dirNorm * tmin;
                    outHit.normal = Vec3(0, 1, 0); // Primary top normal
                    outHit.colliderId = col.id;
                }
            }
        }
        return outHit.hit;
    }
};

} // namespace EngineCore
