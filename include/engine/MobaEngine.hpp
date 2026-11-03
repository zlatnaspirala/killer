// include/engine/MobaEngine.hpp
// MOBA: Forest of Hollow Blood - Official C++ Game Core matching Web Version
#pragma once

#include "Collision.hpp"
#include "DamageSystem.hpp"
#include "PlayerController.hpp"
#include <vector>
#include <string>
#include <memory>
#include <iostream>

namespace EngineCore {

enum class MobaTeam { RED_RADIANT, BLACK_DIRE };
enum class MobaLane { TOP, MID, BOT };

// 6 Official Approved Game Heroes matching Web Version
struct MobaHeroData {
    std::string name;
    std::string role;
    float maxHp;
    float hp;
    float maxMp;
    float mp;
    float attackDamage;
    float moveSpeed;
    float attackRange;
    std::string primaryAbility;
};

// Item Shop Descriptor matching Web Catalog
struct MobaItemData {
    std::string id;
    std::string name;
    int cost;
    std::string effect;
    float hpBonus = 0.0f;
    float damageBonus = 0.0f;
    float armorBonus = 0.0f;
};

// Creep Unit
class MobaCreep {
public:
    uint32_t id;
    std::string name;
    Vec3 position;
    MobaTeam team;
    MobaLane lane;
    size_t waypointIndex = 0;
    std::vector<Vec3> waypoints;
    float attackCooldown = 0.0f;
    std::shared_ptr<DamageableActor> damageable;

    MobaCreep(uint32_t id_, const std::string& name_, MobaTeam team_, MobaLane lane_, const std::vector<Vec3>& waypoints_)
        : id(id_), name(name_), position(waypoints_[0]), team(team_), lane(lane_), waypoints(waypoints_) {
        damageable = std::make_shared<DamageableActor>(id_, name_, "Creeps", 320.0f, position);
    }

    void Update(float dt, DamageSystem& damageSys, std::vector<MobaCreep>& allCreeps);
};

// Tower Unit
class MobaTower {
public:
    uint32_t id;
    std::string name;
    Vec3 position;
    MobaTeam team;
    MobaLane lane;
    float attackRange = 5.5f;
    float attackDamage = 45.0f;
    float attackCooldown = 0.0f;
    std::shared_ptr<DamageableActor> damageable;

    MobaTower(uint32_t id_, const std::string& name_, MobaTeam team_, MobaLane lane_, const Vec3& pos_)
        : id(id_), name(name_), position(pos_), team(team_), lane(lane_) {
        damageable = std::make_shared<DamageableActor>(id_, name_, "Towers", 800.0f, pos_);
    }

    void Update(float dt, DamageSystem& damageSys, std::vector<MobaCreep>& creeps);
};

// Comprehensive MOBA Game Engine Core Instance
class MobaGameEngine {
public:
    MobaGameEngine();
    ~MobaGameEngine();

    void Init();
    void Update(float dt);

    bool SelectHeroByName(const std::string& heroName);
    bool SelectHeroByIndex(int index);
    bool BuyItem(const std::string& itemId);

    int GetPlayerGold() const { return m_gold; }
    int GetPlayerKills() const { return m_kills; }
    const MobaHeroData& GetPlayerHero() const { return m_playerHero; }
    const std::vector<MobaHeroData>& GetHeroCatalog() const { return m_heroCatalog; }
    const std::vector<MobaItemData>& GetShopCatalog() const { return m_shopCatalog; }
    const std::vector<MobaCreep>& GetCreeps() const { return m_creeps; }
    const std::vector<MobaTower>& GetTowers() const { return m_towers; }

    CollisionWorld collisionWorld;
    DamageSystem damageSystem;
    PlayerController playerController;

private:
    int m_gold = 600;
    int m_kills = 0;
    MobaHeroData m_playerHero;
    std::vector<MobaHeroData> m_heroCatalog;
    std::vector<MobaItemData> m_shopCatalog;
    std::vector<MobaCreep> m_creeps;
    std::vector<MobaTower> m_towers;
    std::vector<Vec3> m_topLaneWaypoints;
    std::vector<Vec3> m_midLaneWaypoints;
    std::vector<Vec3> m_botLaneWaypoints;
};

} // namespace EngineCore
