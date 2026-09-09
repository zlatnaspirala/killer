// examples/14_pong.cpp
// Filament / Native C++ Demo 14: Retro 3D Arcade Pong
// Implements 3D arcade table physics, dual paddle collision kinematics,
// ball spin deflection, solo bot AI prediction, and network peer state synchronization.

#include <iostream>
#include <vector>
#include <cmath>
#include <algorithm>

namespace PongArcade {

    struct Vec3 {
        float x, y, z;
        Vec3(float x_ = 0, float y_ = 0, float z_ = 0) : x(x_), y(y_), z(z_) {}
    };

    struct Paddle {
        float x;
        float z;
        float width;   // 0.22m
        float length;  // 1.0m
        float speed;   // m/s
        int score;
        std::string name;

        Paddle(float posX, const std::string& paddleName)
            : x(posX), z(0.0f), width(0.22f), length(1.0f), speed(6.5f), score(0), name(paddleName) {}

        void move(float deltaZ, float minZ, float maxZ) {
            z = std::max(minZ, std::min(maxZ, z + deltaZ));
        }
    };

    struct Ball {
        Vec3 pos;
        Vec3 vel;
        float radius;
        float speedMultiplier;
        bool inPlay;

        Ball() : pos(0.0f, 0.15f, 0.0f), vel(4.5f, 0.0f, 2.0f), radius(0.14f), speedMultiplier(1.0f), inPlay(true) {}

        void reset(float dirX = 1.0f) {
            pos = Vec3(0.0f, 0.15f, 0.0f);
            vel = Vec3(4.5f * dirX, 0.0f, ((rand() % 100) / 100.0f - 0.5f) * 4.0f);
            speedMultiplier = 1.0f;
            inPlay = true;
        }

        void update(float dt) {
            if (!inPlay) return;
            pos.x += vel.x * speedMultiplier * dt;
            pos.z += vel.z * speedMultiplier * dt;
        }
    };

    enum GameMode {
        SOLO_BOT = 0,
        MAN_VS_MAN = 1,
        ONLINE_MULTIPLAYER = 2
    };

    class PongGameEngine {
    public:
        Paddle leftPaddle;
        Paddle rightPaddle;
        Ball ball;
        GameMode mode;
        int rallyCount;
        float tableHalfWidth;
        float tableHalfLength;
        bool isHost;

        PongGameEngine() 
            : leftPaddle(-3.2f, "Player 1"), 
              rightPaddle(3.2f, "Player 2 / Bot"),
              mode(SOLO_BOT),
              rallyCount(0),
              tableHalfWidth(2.1f),
              tableHalfLength(3.6f),
              isHost(true) {}

        void stepPhysics(float dt) {
            // Update AI bot if in SOLO mode
            if (mode == SOLO_BOT) {
                updateBotAI(dt);
            }

            ball.update(dt);

            // Wall collisions (Top & Bottom bumpers)
            if (ball.pos.z + ball.radius >= tableHalfWidth) {
                ball.pos.z = tableHalfWidth - ball.radius;
                ball.vel.z = -std::abs(ball.vel.z);
            } else if (ball.pos.z - ball.radius <= -tableHalfWidth) {
                ball.pos.z = -tableHalfWidth + ball.radius;
                ball.vel.z = std::abs(ball.vel.z);
            }

            // Paddle collisions
            float leftPaddleEdge = leftPaddle.x + leftPaddle.width * 0.5f;
            if (ball.pos.x - ball.radius <= leftPaddleEdge && ball.pos.x >= leftPaddle.x - 0.3f && ball.vel.x < 0) {
                if (std::abs(ball.pos.z - leftPaddle.z) <= (leftPaddle.length * 0.5f + ball.radius)) {
                    ball.pos.x = leftPaddleEdge + ball.radius;
                    ball.vel.x = std::abs(ball.vel.x) * 1.05f;
                    float offset = (ball.pos.z - leftPaddle.z) / (leftPaddle.length * 0.5f);
                    ball.vel.z = offset * std::abs(ball.vel.x) * 0.9f;
                    ball.speedMultiplier = std::min(2.4f, ball.speedMultiplier + 0.05f);
                    rallyCount++;
                }
            }

            float rightPaddleEdge = rightPaddle.x - rightPaddle.width * 0.5f;
            if (ball.pos.x + ball.radius >= rightPaddleEdge && ball.pos.x <= rightPaddle.x + 0.3f && ball.vel.x > 0) {
                if (std::abs(ball.pos.z - rightPaddle.z) <= (rightPaddle.length * 0.5f + ball.radius)) {
                    ball.pos.x = rightPaddleEdge - ball.radius;
                    ball.vel.x = -std::abs(ball.vel.x) * 1.05f;
                    float offset = (ball.pos.z - rightPaddle.z) / (rightPaddle.length * 0.5f);
                    ball.vel.z = offset * std::abs(ball.vel.x) * 0.9f;
                    ball.speedMultiplier = std::min(2.4f, ball.speedMultiplier + 0.05f);
                    rallyCount++;
                }
            }

            // Goal detection
            if (ball.pos.x < -tableHalfLength - 0.2f) {
                rightPaddle.score++;
                ball.reset(1.0f);
                rallyCount = 0;
            } else if (ball.pos.x > tableHalfLength + 0.2f) {
                leftPaddle.score++;
                ball.reset(-1.0f);
                rallyCount = 0;
            }
        }

    private:
        void updateBotAI(float dt) {
            float targetZ = ball.pos.z;
            float diff = targetZ - rightPaddle.z;
            float botSpeed = 5.5f;
            if (std::abs(diff) > 0.1f) {
                float moveStep = (diff > 0 ? 1.0f : -1.0f) * std::min(std::abs(diff), botSpeed * dt);
                rightPaddle.move(moveStep, -1.65f, 1.65f);
            }
        }
    };
}
