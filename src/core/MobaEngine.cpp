// src/core/MobaEngine.cpp
// Official C++ MOBA Game Logic Implementation
#include "engine/MobaEngine.hpp"
#include <cmath>
#include <iostream>
#include <algorithm>

namespace EngineCore {

void MobaCreep::Update(float dt, DamageSystem& damageSys, std::vector<MobaCreep>& allCreeps) {
    if (!damageable || !damageable->IsAlive()) return;

    if (waypointIndex < waypoints.size()) {
        const Vec3& target = waypoints[waypointIndex];
        float d = (position - target).Length();
        if (d < 0.8f) {
            waypointIndex++;
        } else {
            float dx = target.x - position.x;
            float dz = target.z - position.z;
            float len = std::hypot(dx, dz);
            if (len > 0.001f) {
                position.x += (dx / len) * 3.6f * dt;
                position.z += (dz / len) * 3.6f * dt;
                damageable->position = position;
            }
        }
    } else {
        waypointIndex = 0;
        position = waypoints[0];
        damageable->position = position;
    }

    attackCooldown -= dt;
    if (attackCooldown <= 0.0f) {
        for (auto& other : allCreeps) {
            if (other.id != id && other.damageable && other.damageable->IsAlive() && other.team != team) {
                if ((position - other.position).Length() <= 2.2f) {
                    damageSys.ApplyDamage(other.id, 25.0f, id, other.position, Vec3(0, 1, 0));
                    attackCooldown = 1.2f;
                    break;
                }
            }
        }
    }
}

void MobaTower::Update(float dt, DamageSystem& damageSys, std::vector<MobaCreep>& creeps) {
    if (!damageable || !damageable->IsAlive()) return;

    attackCooldown -= dt;
    if (attackCooldown <= 0.0f) {
        for (auto& creep : creeps) {
            if (creep.damageable && creep.damageable->IsAlive() && creep.team != team) {
                if ((position - creep.position).Length() <= attackRange) {
                    damageSys.ApplyDamage(creep.id, attackDamage, id, creep.position, Vec3(0, 1, 0));
                    attackCooldown = 1.0f;
                    break;
                }
            }
        }
    }
}

MobaGameEngine::MobaGameEngine() = default;
MobaGameEngine::~MobaGameEngine() = default;

void MobaGameEngine::Init() {
    std::cout << "[MobaGameEngine] Initializing Official C++ MOBA Engine matching Web Version...\n";

    // 1. Setup Official 6 Hero Roster (Arissa, Bot, Erika, Monster, Skeletonz, Woman Mobile)
    m_heroCatalog = {
        { "Arissa", "Agility / Assassin", 680.0f, 680.0f, 320.0f, 320.0f, 78.0f, 4.6f, 2.2f, "Shadow Strike" },
        { "Bot", "Mecha / Fighter", 820.0f, 820.0f, 250.0f, 250.0f, 65.0f, 4.0f, 1.8f, "Overcharge Cannon" },
        { "Erika", "Intelligence / Mage", 550.0f, 550.0f, 480.0f, 480.0f, 52.0f, 3.9f, 6.0f, "Elemental Nova" },
        { "Monster", "Strength / Brawler", 950.0f, 950.0f, 180.0f, 180.0f, 85.0f, 3.8f, 1.5f, "Ground Slam" },
        { "Skeletonz", "Undead / Warrior", 720.0f, 720.0f, 280.0f, 280.0f, 70.0f, 4.2f, 2.0f, "Bone Cleave" },
        { "Woman Mobile", "Agility / Ranged Marksman", 610.0f, 610.0f, 350.0f, 350.0f, 80.0f, 4.5f, 7.5f, "Precision Snipe" }
    };
    m_playerHero = m_heroCatalog[0];

    // 2. Setup Official Shop Catalog
    m_shopCatalog = {
        { "health_vial", "Small Health Vial", 100, "+150 HP Restore", 150.0f, 0.0f, 0.0f },
        { "yellow_armor", "Yellow Combat Armor", 250, "+75 Armor Defense", 0.0f, 0.0f, 75.0f },
        { "quad_damage", "Quad Damage Rune", 500, "4x Damage Multiplier", 0.0f, 50.0f, 0.0f },
        { "blink_dagger", "Blink Dagger", 400, "Instant Teleportation", 0.0f, 0.0f, 0.0f }
    };

    // 3. Setup Lane Waypoints
    m_topLaneWaypoints = {
        Vec3(-14, 0, -14), Vec3(-14, 0, -6), Vec3(-14, 0, 3.5),
        Vec3(-11.5, 0, 11.5), Vec3(-3.5, 0, 14), Vec3(6, 0, 14), Vec3(14, 0, 14)
    };
    m_midLaneWaypoints = {
        Vec3(-14, 0, -14), Vec3(-7, 0, -7), Vec3(0, 0, 0), Vec3(7, 0, 7), Vec3(14, 0, 14)
    };
    m_botLaneWaypoints = {
        Vec3(-14, 0, -14), Vec3(-6, 0, -14), Vec3(3.5, 0, -14),
        Vec3(11.5, 0, -11.5), Vec3(14, 0, -3.5), Vec3(14, 0, 6), Vec3(14, 0, 14)
    };

    // 4. Collision World
    collisionWorld.AddAABB("Floor", Vec3(0, -0.5f, 0), Vec3(30.0f, 0.5f, 30.0f), Layer_Ground);
    collisionWorld.AddAABB("Radiant_Ancient", Vec3(-14.0f, 1.5f, -14.0f), Vec3(2.5f, 1.5f, 2.5f), Layer_Obstacle);
    collisionWorld.AddAABB("Dire_Ancient", Vec3(14.0f, 1.5f, 14.0f), Vec3(2.5f, 1.5f, 2.5f), Layer_Obstacle);

    // 5. Damage Callbacks
    damageSystem.AddOnDestroyedListener([this](const DamageEvent& evt) {
        m_kills++;
        m_gold += 45;
        std::cout << "[MobaGameEngine] Destroyed: " << evt.targetName << " | Gold: " << m_gold << " | Kills: " << m_kills << "\n";
    });

    // 6. Spawn Towers
    m_towers.emplace_back(101, "Radiant_Mid_Tower_1", MobaTeam::RED_RADIANT, MobaLane::MID, Vec3(-10, 0, -10));
    m_towers.emplace_back(102, "Radiant_Mid_Tower_2", MobaTeam::RED_RADIANT, MobaLane::MID, Vec3(-5, 0, -5));
    m_towers.emplace_back(201, "Dire_Mid_Tower_1", MobaTeam::BLACK_DIRE, MobaLane::MID, Vec3(10, 0, 10));
    m_towers.emplace_back(202, "Dire_Mid_Tower_2", MobaTeam::BLACK_DIRE, MobaLane::MID, Vec3(5, 0, 5));

    for (auto& tower : m_towers) {
        damageSystem.RegisterActor(tower.damageable);
    }

    // 7. Spawn Creeps
    uint32_t creepId = 1;
    for (int i = 0; i < 4; ++i) {
        MobaCreep r(creepId++, "Radiant_Creep_" + std::to_string(i + 1), MobaTeam::RED_RADIANT, MobaLane::MID, m_midLaneWaypoints);
        r.position.x += i * 1.0f;
        damageSystem.RegisterActor(r.damageable);
        m_creeps.push_back(r);

        MobaCreep b(creepId++, "Dire_Creep_" + std::to_string(i + 1), MobaTeam::BLACK_DIRE, MobaLane::MID, m_midLaneWaypoints);
        std::reverse(b.waypoints.begin(), b.waypoints.end());
        b.position = b.waypoints[0];
        b.position.x -= i * 1.0f;
        damageSystem.RegisterActor(b.damageable);
        m_creeps.push_back(b);
    }

    playerController.position = Vec3(-8.0f, 0.0f, -8.0f);
}

void MobaGameEngine::Update(float dt) {
    damageSystem.Update(dt);

    for (auto& creep : m_creeps) {
        creep.Update(dt, damageSystem, m_creeps);
    }

    for (auto& tower : m_towers) {
        tower.Update(dt, damageSystem, m_creeps);
    }
}

bool MobaGameEngine::SelectHeroByName(const std::string& heroName) {
    for (const auto& hero : m_heroCatalog) {
        if (hero.name == heroName) {
            m_playerHero = hero;
            std::cout << "[MobaGameEngine] Selected Hero: " << m_playerHero.name << " (" << m_playerHero.role << ")\n";
            return true;
        }
    }
    return false;
}

bool MobaGameEngine::SelectHeroByIndex(int index) {
    if (index >= 0 && index < static_cast<int>(m_heroCatalog.size())) {
        m_playerHero = m_heroCatalog[index];
        std::cout << "[MobaGameEngine] Selected Hero: " << m_playerHero.name << " (" << m_playerHero.role << ")\n";
        return true;
    }
    return false;
}

bool MobaGameEngine::BuyItem(const std::string& itemId) {
    for (const auto& item : m_shopCatalog) {
        if (item.id == itemId) {
            if (m_gold >= item.cost) {
                m_gold -= item.cost;
                m_playerHero.maxHp += item.hpBonus;
                m_playerHero.hp += item.hpBonus;
                m_playerHero.attackDamage += item.damageBonus;
                std::cout << "[MobaGameEngine] Purchased " << item.name << "! Remaining Gold: " << m_gold << "\n";
                return true;
            } else {
                std::cout << "[MobaGameEngine] Not enough gold for " << item.name << "\n";
                return false;
            }
        }
    }
    return false;
}

} // namespace EngineCore
