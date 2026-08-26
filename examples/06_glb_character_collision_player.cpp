// examples/06_glb_character_collision_player.cpp
// Demo 06: GLB Character, Collision & Player Controller
// Real-time animated character locomotion, custom spatial collision world,
// ground detection, and zero-allocation gameplay loop.

#include <engine/Engine.hpp>
#include <engine/Camera.hpp>
#include <engine/GLBLoader.hpp>
#include <engine/Collision.hpp>
#include <engine/PlayerController.hpp>
#include <iostream>
#include <vector>

using namespace EngineCore;

struct GameSceneContext {
    CollisionWorld collisionWorld;
    PlayerController player;
    Skeleton characterSkeleton;
    Camera camera;
    
    // Scene entities
    std::vector<uint32_t> obstacleIds;
    std::vector<uint32_t> triggerIds;
    int collectedCoins = 0;
};

void InitGameScene(GameSceneContext& ctx) {
    std::cout << "[Demo 06] Initializing Collision World & Player Controller...\n";

    // 1. Build Collision World Boundaries & Obstacles
    // Floor
    ctx.collisionWorld.AddAABB("Ground_Floor", Vec3(0, -0.5f, 0), Vec3(25.0f, 0.5f, 25.0f), Layer_Ground);

    // Obstacle Pillars & Boxes
    ctx.collisionWorld.AddAABB("Pillar_North", Vec3(0, 2.0f, -8.0f), Vec3(1.0f, 2.0f, 1.0f), Layer_Obstacle);
    ctx.collisionWorld.AddAABB("Pillar_West", Vec3(-6.0f, 1.5f, 0.0f), Vec3(1.2f, 1.5f, 1.2f), Layer_Obstacle);
    ctx.collisionWorld.AddAABB("Pillar_East", Vec3(6.0f, 1.5f, 0.0f), Vec3(1.2f, 1.5f, 1.2f), Layer_Obstacle);
    ctx.collisionWorld.AddAABB("Platform_High", Vec3(0, 1.2f, 6.0f), Vec3(3.0f, 0.4f, 3.0f), Layer_Obstacle);

    // Spherical Boulders
    ctx.collisionWorld.AddSphere("Sphere_Boulder_1", Vec3(-3.5f, 1.0f, -4.0f), 1.0f, Layer_Obstacle);
    ctx.collisionWorld.AddSphere("Sphere_Boulder_2", Vec3(3.5f, 1.0f, -4.0f), 1.0f, Layer_Obstacle);

    // Trigger Collectibles (Gems)
    ctx.triggerIds.push_back(
        ctx.collisionWorld.AddAABB("Gem_Trigger_North", Vec3(0, 1.2f, -8.0f), Vec3(0.5f, 0.5f, 0.5f), Layer_Trigger, true)
    );
    ctx.triggerIds.push_back(
        ctx.collisionWorld.AddAABB("Gem_Trigger_Platform", Vec3(0, 2.0f, 6.0f), Vec3(0.5f, 0.5f, 0.5f), Layer_Trigger, true)
    );

    // 2. Setup Player Controller Spawn Pose
    ctx.player.SetPosition(Vec3(0.0f, 0.0f, 2.0f));
    ctx.player.walkSpeed = 5.5f;
    ctx.player.sprintSpeed = 11.0f;
    ctx.player.jumpForce = 8.5f;

    // 3. Setup Skeleton & Animation Channels
    ctx.characterSkeleton.AddJoint("Root_Hips", -1);
    ctx.characterSkeleton.AddJoint("Spine_Torso", 0);
    ctx.characterSkeleton.AddJoint("Head", 1);
    ctx.characterSkeleton.AddJoint("Arm_Left", 1);
    ctx.characterSkeleton.AddJoint("Arm_Right", 1);
    ctx.characterSkeleton.AddJoint("Leg_Left", 0);
    ctx.characterSkeleton.AddJoint("Leg_Right", 0);

    // Add Walk Animation Clip
    AnimationClip walkClip;
    walkClip.name = "Walk";
    walkClip.duration = 1.0f;
    ctx.characterSkeleton.animations.push_back(walkClip);

    AnimationClip runClip;
    runClip.name = "Run";
    runClip.duration = 0.6f;
    ctx.characterSkeleton.animations.push_back(runClip);

    AnimationClip jumpClip;
    jumpClip.name = "Jump";
    jumpClip.duration = 0.8f;
    ctx.characterSkeleton.animations.push_back(jumpClip);

    ctx.characterSkeleton.PlayAnimation("Walk");
    std::cout << "[Demo 06] Scene Ready: 8 Colliders registered, Player Controller active.\n";
}

void UpdateAndRenderDemo(GameSceneContext& ctx, float dt, const PlayerInput& input) {
    // 1. Update Kinematic Player Locomotion against Collision World
    ctx.player.Update(dt, input, ctx.collisionWorld);

    // 2. Select Character Skeletal Animation based on locomotion state
    switch (ctx.player.currentState) {
        case PlayerState::Sprinting:
            ctx.characterSkeleton.PlayAnimation("Run");
            ctx.characterSkeleton.playbackSpeed = 1.2f;
            break;
        case PlayerState::Walking:
            ctx.characterSkeleton.PlayAnimation("Walk");
            ctx.characterSkeleton.playbackSpeed = 1.0f;
            break;
        case PlayerState::Jumping:
        case PlayerState::Falling:
            ctx.characterSkeleton.PlayAnimation("Jump");
            break;
        default:
            ctx.characterSkeleton.playbackSpeed = 0.0f; // Idle
            break;
    }

    // 3. Update Bone Matrices
    ctx.characterSkeleton.Update(dt);

    // 4. Update Camera (Third-Person Spring Arm tracking player)
    Vec3 targetLook = ctx.player.GetEyePosition();
    float camDist = 5.0f;
    Vec3 camOffset = Vec3(
        std::sin(ctx.player.yaw) * camDist * std::cos(ctx.player.pitch + 0.2f),
        std::sin(ctx.player.pitch + 0.2f) * camDist + 1.2f,
        -std::cos(ctx.player.yaw) * camDist * std::cos(ctx.player.pitch + 0.2f)
    );
    Vec3 desiredCamPos = targetLook - camOffset;

    // Raycast camera to prevent clipping inside obstacle walls
    RaycastHit camHit;
    if (ctx.collisionWorld.Raycast(targetLook, (desiredCamPos - targetLook), camDist, Layer_Obstacle, camHit)) {
        desiredCamPos = targetLook + (desiredCamPos - targetLook).Normalized() * (camHit.distance - 0.2f);
    }

    ctx.camera.SetPosition(desiredCamPos.x, desiredCamPos.y, desiredCamPos.z);
    ctx.camera.SetTarget(targetLook.x, targetLook.y, targetLook.z);
}

int main() {
    GameSceneContext ctx;
    InitGameScene(ctx);

    PlayerInput simulatedInput;
    simulatedInput.moveForward = 1.0f; // Walk forward
    simulatedInput.sprint = true;

    // Simulate 60 physics frames
    for (int frame = 0; frame < 60; ++frame) {
        UpdateAndRenderDemo(ctx, 1.0f / 60.0f, simulatedInput);
    }

    std::cout << "[Demo 06] Simulation Complete. Final Player Pos: ("
              << ctx.player.position.x << ", "
              << ctx.player.position.y << ", "
              << ctx.player.position.z << ")\n";
    return 0;
}
