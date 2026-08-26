// include/engine/DamageSystem.hpp
// Real-Time Damage System & Event Emission for C++ 3D Game Engine
// Provides Damage Groups, IDamageable Interfaces, Health Management,
// and Callback-Driven onDamage / onDestroyed Event Dispatching.
#pragma once

#include "Collision.hpp"
#include <functional>
#include <vector>
#include <string>
#include <memory>
#include <iostream>

namespace EngineCore {

// Damage Event Payload
struct DamageEvent {
    uint32_t attackerId = 0;
    uint32_t targetId = 0;
    std::string targetName;
    std::string damageGroup = "Default"; // "Enemies", "Destructibles", "Targets", "Players"
    float damageAmount = 25.0f;
    float remainingHealth = 100.0f;
    float maxHealth = 100.0f;
    Vec3 hitPoint = Vec3(0, 0, 0);
    Vec3 hitNormal = Vec3(0, 1, 0);
    bool isDestroyed = false;
    double timestamp = 0.0;
};

// Interface for all entities capable of receiving damage
class IDamageable {
public:
    virtual ~IDamageable() = default;
    virtual uint32_t GetEntityId() const = 0;
    virtual const std::string& GetEntityName() const = 0;
    virtual const std::string& GetDamageGroup() const = 0;
    virtual float GetHealth() const = 0;
    virtual float GetMaxHealth() const = 0;
    virtual bool IsAlive() const = 0;
    virtual void TakeDamage(const DamageEvent& evt) = 0;
    virtual void Heal(float amount) = 0;
};

// Concrete Damageable Target Object
class DamageableActor : public IDamageable {
public:
    uint32_t id = 0;
    std::string name = "Target_Actor";
    std::string damageGroup = "Damageable_Group";
    float health = 100.0f;
    float maxHealth = 100.0f;
    bool alive = true;
    Vec3 position = Vec3(0, 0, 0);
    float respawnTimer = 0.0f;
    float respawnDelay = 3.0f;

    DamageableActor(uint32_t id_, const std::string& name_, const std::string& group_, float maxHp_, const Vec3& pos_)
        : id(id_), name(name_), damageGroup(group_), health(maxHp_), maxHealth(maxHp_), alive(true), position(pos_) {}

    uint32_t GetEntityId() const override { return id; }
    const std::string& GetEntityName() const override { return name; }
    const std::string& GetDamageGroup() const override { return damageGroup; }
    float GetHealth() const override { return health; }
    float GetMaxHealth() const override { return maxHealth; }
    bool IsAlive() const override { return alive; }

    void TakeDamage(const DamageEvent& evt) override {
        if (!alive) return;
        health = std::max(0.0f, health - evt.damageAmount);
        if (health <= 0.0f) {
            alive = false;
            respawnTimer = respawnDelay;
        }
    }

    void Heal(float amount) override {
        health = std::min(maxHealth, health + amount);
        if (health > 0.0f) alive = true;
    }

    void Update(float dt) {
        if (!alive) {
            respawnTimer -= dt;
            if (respawnTimer <= 0.0f) {
                alive = true;
                health = maxHealth;
            }
        }
    }
};

// Event Dispatcher for Damage Signals
class DamageSystem {
public:
    using OnDamageCallback = std::function<void(const DamageEvent&)>;
    using OnDestroyedCallback = std::function<void(const DamageEvent&)>;

    std::vector<OnDamageCallback> damageListeners;
    std::vector<OnDestroyedCallback> destroyListeners;
    std::vector<std::shared_ptr<DamageableActor>> registeredActors;

    // Register event callbacks
    void AddOnDamageListener(OnDamageCallback cb) {
        damageListeners.push_back(cb);
    }

    void AddOnDestroyedListener(OnDestroyedCallback cb) {
        destroyListeners.push_back(cb);
    }

    // Register a damageable actor into the damage group
    void RegisterActor(std::shared_ptr<DamageableActor> actor) {
        registeredActors.push_back(actor);
    }

    // Apply direct point damage
    bool ApplyDamage(uint32_t targetId, float damage, uint32_t attackerId, const Vec3& hitPos, const Vec3& hitNorm) {
        for (auto& actor : registeredActors) {
            if (actor->id == targetId && actor->IsAlive()) {
                DamageEvent evt;
                evt.attackerId = attackerId;
                evt.targetId = targetId;
                evt.targetName = actor->name;
                evt.damageGroup = actor->damageGroup;
                evt.damageAmount = damage;
                evt.hitPoint = hitPos;
                evt.hitNormal = hitNorm;
                
                actor->TakeDamage(evt);

                evt.remainingHealth = actor->health;
                evt.maxHealth = actor->maxHealth;
                evt.isDestroyed = !actor->alive;

                // Emit onDamage event to all listeners
                for (auto& cb : damageListeners) {
                    if (cb) cb(evt);
                }

                // If destroyed, emit onDestroyed event
                if (evt.isDestroyed) {
                    for (auto& cb : destroyListeners) {
                        if (cb) cb(evt);
                    }
                }
                return true;
            }
        }
        return false;
    }

    void Update(float dt) {
        for (auto& actor : registeredActors) {
            actor->Update(dt);
        }
    }
};

} // namespace EngineCore
