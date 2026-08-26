// include/engine/PlayerController.hpp
// Real-Time First/Third-Person Player Character Controller
// Seamless kinematic movement, gravity, ground detection, coyote time,
// and sliding collision response with CollisionWorld.
#pragma once

#include "Collision.hpp"
#include <cmath>
#include <algorithm>

namespace EngineCore {

enum class PlayerState {
    Idle,
    Walking,
    Sprinting,
    Jumping,
    Falling,
    Crouching
};

struct PlayerInput {
    float moveForward = 0.0f; // [-1.0, 1.0] (W/S)
    float moveRight = 0.0f;   // [-1.0, 1.0] (D/A)
    bool jump = false;
    bool sprint = false;
    bool crouch = false;
    float lookDeltaX = 0.0f;
    float lookDeltaY = 0.0f;
};

class PlayerController {
public:
    Vec3 position = Vec3(0.0f, 1.0f, 0.0f);
    Vec3 velocity = Vec3(0.0f, 0.0f, 0.0f);
    Vec3 moveDirection = Vec3(0.0f, 0.0f, 0.0f);
    Vec3 groundNormal = Vec3(0.0f, 1.0f, 0.0f);

    float yaw = 0.0f;
    float pitch = 0.0f;

    // Movement Tuning Parameters
    float walkSpeed = 6.0f;
    float sprintSpeed = 12.0f;
    float crouchSpeed = 3.0f;
    float acceleration = 24.0f;
    float groundFriction = 12.0f;
    float airFriction = 2.0f;
    float airControl = 0.4f;

    // Jumping & Gravity
    float jumpForce = 8.5f;
    float gravity = -22.0f;
    float terminalVelocity = -40.0f;
    float coyoteTimeMax = 0.15f;
    float coyoteTimer = 0.0f;
    float jumpBufferMax = 0.12f;
    float jumpBufferTimer = 0.0f;

    // Dimensions
    float characterHeight = 1.8f;
    float characterRadius = 0.4f;
    float eyeHeight = 1.65f;

    // State
    bool isGrounded = false;
    PlayerState currentState = PlayerState::Idle;

    void SetPosition(const Vec3& pos) {
        position = pos;
        velocity = Vec3(0, 0, 0);
    }

    Vec3 GetEyePosition() const {
        return Vec3(position.x, position.y + eyeHeight, position.z);
    }

    Vec3 GetForwardVector() const {
        return Vec3(std::sin(yaw), 0.0f, -std::cos(yaw)).Normalized();
    }

    Vec3 GetRightVector() const {
        return Vec3(-std::cos(yaw), 0.0f, -std::sin(yaw)).Normalized();
    }

    // Per-frame physics and collision update loop
    void Update(float dt, const PlayerInput& input, CollisionWorld& collisionWorld) {
        // Clamp dt to prevent tunneling during large frame spikes
        dt = std::min(dt, 0.05f);

        // 1. Look orientation
        yaw += input.lookDeltaX;
        pitch = std::clamp(pitch + input.lookDeltaY, -1.45f, 1.45f);

        Vec3 forward = GetForwardVector();
        Vec3 right = GetRightVector();

        // 2. Input movement vector
        Vec3 desiredMove = forward * input.moveForward + right * input.moveRight;
        float moveInputLen = desiredMove.Length();
        if (moveInputLen > 1.0f) {
            desiredMove = desiredMove * (1.0f / moveInputLen);
        }

        float targetSpeed = walkSpeed;
        if (input.sprint && moveInputLen > 0.1f) targetSpeed = sprintSpeed;
        if (input.crouch) targetSpeed = crouchSpeed;

        Vec3 targetVel = desiredMove * targetSpeed;

        // 3. Ground detection check (Swept-sphere slightly below player feet)
        Vec3 feetPos = Vec3(position.x, position.y + characterRadius, position.z);
        CollisionManifold groundManifold;
        bool groundHit = collisionWorld.CheckSphereCollision(
            feetPos - Vec3(0, 0.08f, 0),
            characterRadius,
            Layer_Obstacle | Layer_Ground,
            groundManifold
        );

        isGrounded = groundHit && (groundManifold.normal.y > 0.6f);
        if (isGrounded) {
            groundNormal = groundManifold.normal;
            coyoteTimer = coyoteTimeMax;
            if (velocity.y < 0.0f) velocity.y = 0.0f;
        } else {
            coyoteTimer = std::max(0.0f, coyoteTimer - dt);
            groundNormal = Vec3(0, 1, 0);
        }

        // Jump buffer handling
        if (input.jump) jumpBufferTimer = jumpBufferMax;
        else jumpBufferTimer = std::max(0.0f, jumpBufferTimer - dt);

        if (jumpBufferTimer > 0.0f && coyoteTimer > 0.0f) {
            velocity.y = jumpForce;
            coyoteTimer = 0.0f;
            jumpBufferTimer = 0.0f;
            isGrounded = false;
        }

        // 4. Horizontal acceleration / friction
        float accelRate = isGrounded ? acceleration : (acceleration * airControl);
        float friction = isGrounded ? groundFriction : airFriction;

        // Horizontal velocity
        Vec3 horizVel(velocity.x, 0.0f, velocity.z);
        Vec3 velDiff = targetVel - horizVel;
        horizVel += velDiff * std::min(1.0f, accelRate * dt);
        if (moveInputLen < 0.05f) {
            horizVel -= horizVel * std::min(1.0f, friction * dt);
        }
        velocity.x = horizVel.x;
        velocity.z = horizVel.z;

        // 5. Apply gravity
        if (!isGrounded) {
            velocity.y += gravity * dt;
            velocity.y = std::max(velocity.y, terminalVelocity);
        }

        // 6. Integrate position with sliding collision resolution
        Vec3 stepDelta = velocity * dt;

        // Multi-pass collision iteration to resolve corner pinches smoothly
        for (int pass = 0; pass < 3; ++pass) {
            Vec3 testPos = position + stepDelta;
            Vec3 sphereCenter = Vec3(testPos.x, testPos.y + characterRadius + 0.1f, testPos.z);
            CollisionManifold col;

            if (collisionWorld.CheckSphereCollision(sphereCenter, characterRadius, Layer_Obstacle | Layer_Ground, col)) {
                if (!col.isTrigger) {
                    // Push out along contact normal
                    float push = col.penetration + 0.001f;
                    stepDelta += col.normal * push;

                    // Project remaining velocity onto collision sliding plane
                    float dotVel = velocity.Dot(col.normal);
                    if (dotVel < 0.0f) {
                        velocity -= col.normal * dotVel;
                    }
                }
            } else {
                break;
            }
        }

        position += stepDelta;

        // Floor threshold safety snap
        if (position.y < 0.0f) {
            position.y = 0.0f;
            velocity.y = 0.0f;
            isGrounded = true;
        }

        // 7. Update Animation State
        float horizSpeed = std::hypot(velocity.x, velocity.z);
        if (!isGrounded) {
            currentState = (velocity.y > 0.5f) ? PlayerState::Jumping : PlayerState::Falling;
        } else if (input.crouch) {
            currentState = PlayerState::Crouching;
        } else if (horizSpeed > 8.0f) {
            currentState = PlayerState::Sprinting;
        } else if (horizSpeed > 0.3f) {
            currentState = PlayerState::Walking;
        } else {
            currentState = PlayerState::Idle;
        }
    }
};

} // namespace EngineCore
