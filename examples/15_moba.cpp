// examples/15_moba.cpp
// MOBA: Forest of Hollow Blood - Procedural Geometry & Layout Engine Core
// Native C++ high-performance math geometry factory, classic 3-lane waypoints, and unit systems.

#include <iostream>
#include <vector>
#include <cmath>
#include <string>
#include <memory>
#include <algorithm>

namespace KillerEngine {
namespace MOBA {

struct Vec3 {
    float x, y, z;
    Vec3(float _x = 0, float _y = 0, float _z = 0) : x(_x), y(_y), z(_z) {}
    
    float distance(const Vec3& o) const {
        float dx = x - o.x;
        float dy = y - o.y;
        float dz = z - o.z;
        return std::sqrt(dx*dx + dy*dy + dz*dz);
    }
};

enum class Team { RED, BLACK };
enum class Lane { TOP, MID, BOT };

// Procedural Tree Descriptor
struct ProceduralTree {
    uint32_t id;
    Vec3 position;
    float scale;
    float rotation;
    std::string archetype; // "oak", "pine", "willow", "ancient_spire"
    float collisionRadius;
};

// Procedural Geometry Mesh Buffer Representation
struct MeshData {
    std::vector<float> positions;
    std::vector<float> normals;
    std::vector<float> uvs;
    std::vector<uint16_t> indices;
};

// Procedural Math Geometry Factory
class ProceduralGeometryFactory {
public:
    static MeshData createCylinder(float radiusTop, float radiusBottom, float height, int radialSegments) {
        MeshData mesh;
        for (int y = 0; y <= 4; ++y) {
            float v = static_cast<float>(y) / 4.0f;
            float r = radiusBottom + (radiusTop - radiusBottom) * v;
            if (v < 0.25f) r += std::pow(1.0f - (v / 0.25f), 2.2f) * 0.45f; // Root fluting
            float posY = v * height;

            for (int x = 0; x <= radialSegments; ++x) {
                float u = static_cast<float>(x) / radialSegments;
                float theta = u * 6.2831853f;
                float cosT = std::cos(theta);
                float sinT = std::sin(theta);

                mesh.positions.push_back(cosT * r);
                mesh.positions.push_back(posY);
                mesh.positions.push_back(sinT * r);

                mesh.normals.push_back(cosT);
                mesh.normals.push_back(0.0f);
                mesh.normals.push_back(sinT);

                mesh.uvs.push_back(u);
                mesh.uvs.push_back(v);
            }
        }
        return mesh;
    }

    static MeshData createConicalCanopy(float radius, float height, int radialSegments) {
        MeshData mesh;
        // Apex
        mesh.positions.insert(mesh.positions.end(), {0.0f, height, 0.0f});
        mesh.normals.insert(mesh.normals.end(), {0.0f, 1.0f, 0.0f});
        mesh.uvs.insert(mesh.uvs.end(), {0.5f, 1.0f});

        for (int i = 0; i <= radialSegments; ++i) {
            float u = static_cast<float>(i) / radialSegments;
            float theta = u * 6.2831853f;
            mesh.positions.push_back(std::cos(theta) * radius);
            mesh.positions.push_back(0.0f);
            mesh.positions.push_back(std::sin(theta) * radius);

            mesh.normals.push_back(std::cos(theta));
            mesh.normals.push_back(radius / height);
            mesh.normals.push_back(std::sin(theta));

            mesh.uvs.push_back(u);
            mesh.uvs.push_back(0.0f);
        }
        return mesh;
    }
};

// Classic MOBA Creep & Lane Navigation System
class MobaCreep {
public:
    std::string id;
    Team team;
    Lane lane;
    Vec3 position;
    std::vector<Vec3> waypoints;
    size_t currentWaypointIndex = 0;
    float hp = 300.0f;
    float maxHp = 300.0f;
    float mp = 100.0f;
    float maxMp = 100.0f;
    float speed = 3.4f;
    float damage = 22.0f;
    float attackRange = 1.8f;

    void update(float dt) {
        if (hp <= 0.0f) return;
        if (currentWaypointIndex < waypoints.size()) {
            const Vec3& target = waypoints[currentWaypointIndex];
            float dist = position.distance(target);
            if (dist < 1.0f) {
                currentWaypointIndex++;
            } else {
                float dx = target.x - position.x;
                float dz = target.z - position.z;
                float d = std::hypot(dx, dz);
                if (d > 0.01f) {
                    position.x += (dx / d) * speed * dt;
                    position.z += (dz / d) * speed * dt;
                }
            }
        }
    }
};

// Middleware Forest Layout Engine
class ForestLayoutEngine {
public:
    std::vector<ProceduralTree> trees;
    std::vector<Vec3> topLaneWaypoints;
    std::vector<Vec3> midLaneWaypoints;
    std::vector<Vec3> botLaneWaypoints;

    void init() {
        // Classic 3-lane paths
        topLaneWaypoints = {
            Vec3(-14, 0, -14), Vec3(-14, 0, -6), Vec3(-14, 0, 3.5),
            Vec3(-11.5, 0, 11.5), Vec3(-3.5, 0, 14), Vec3(6, 0, 14), Vec3(14, 0, 14)
        };
        midLaneWaypoints = {
            Vec3(-14, 0, -14), Vec3(-8.5, 0, -8.5), Vec3(-4.5, 0, -4.5),
            Vec3(0, 0, 0), Vec3(4.5, 0, 4.5), Vec3(8.5, 0, 8.5), Vec3(14, 0, 14)
        };
        botLaneWaypoints = {
            Vec3(-14, 0, -14), Vec3(-6, 0, -14), Vec3(3.5, 0, -14),
            Vec3(11.5, 0, -11.5), Vec3(14, 0, -3.5), Vec3(14, 0, 6), Vec3(14, 0, 14)
        };
        std::cout << "[ForestLayoutEngine] Initialized 3 classic Dota-style lanes with procedural jungle groves." << std::endl;
    }
};

} // namespace MOBA
} // namespace KillerEngine
