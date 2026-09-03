// examples/12_roulette.cpp
// Filament / Native C++ Demo 12: 3D Physics-Engine Roulette Wheel
// Implements angular friction, ball-spindle mechanics, gravity slope descent,
// and pocket landing collision resolution.

#include <iostream>
#include <vector>
#include <cmath>
#include <random>
#include <algorithm>

namespace RoulettePhysics {

    const int ROULETTE_NUMBERS[37] = {
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 
        24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    };

    struct BallState {
        float angle = 0.0f;
        float angularVelocity = 15.0f; // rad/s
        float radius = 1.05f;           // Current orbital distance from center
        float z = 0.10f;
        float radialVelocity = 0.0f;
        bool isSettled = false;
        int settledPocketIndex = -1;
    };

    class RouletteWheelSimulation {
    public:
        float wheelAngle = 0.0f;
        float wheelVelocity = -3.5f; // Rad/s (counter-rotating)
        float wheelFriction = 0.015f;
        float ballFriction = 0.04f;
        BallState ball;
        bool isSpinning = false;
        std::mt19939 rng;

        RouletteWheelSimulation() {
            rng.seed(999);
            Reset();
        }

        void Reset() {
            wheelAngle = 0.0f;
            wheelVelocity = -4.0f;
            ball.angle = 0.0f;
            ball.angularVelocity = 12.0f + (float)(rng() % 500) / 100.0f;
            ball.radius = 1.05f;
            ball.z = 0.10f;
            ball.radialVelocity = 0.0f;
            ball.isSettled = false;
            ball.settledPocketIndex = -1;
            isSpinning = true;
        }

        void Update(float dt) {
            if (!isSpinning) return;

            // 1. Update spinning wheel (decelerate slowly due to mechanical friction)
            wheelVelocity *= (1.0f - wheelFriction * dt);
            if (std::abs(wheelVelocity) < 0.05f) {
                wheelVelocity = 0.0f;
            }
            wheelAngle += wheelVelocity * dt;
            // Keep wheel angle normalized
            wheelAngle = std::fmod(wheelAngle, 2.0f * M_PI);

            // 2. Update ball orbital physics
            if (!ball.isSettled) {
                // Ball decelerates due to rolling friction
                ball.angularVelocity *= (1.0f - ballFriction * dt);
                ball.angle += ball.angularVelocity * dt;
                ball.angle = std::fmod(ball.angle, 2.0f * M_PI);

                // Centrifugal vs gravity balance determines when the ball starts sliding down
                float centrifugalForce = ball.radius * ball.angularVelocity * ball.angularVelocity;
                float gravityPull = 9.81f * 0.12f; // Downward gravity component along the dish slope

                if (centrifugalForce < gravityPull) {
                    // Ball begins descending towards the center wheel
                    ball.radialVelocity -= 0.8f * dt;
                    ball.radius += ball.radialVelocity * dt;

                    // Clamp to the inner pocket radius limit (~0.68m)
                    if (ball.radius <= 0.68f) {
                        ball.radius = 0.68f;
                        ball.radialVelocity = 0.0f;
                        ball.isSettled = true;
                        
                        // Look up pocket index relative to current wheel angle
                        float relativeAngle = ball.angle - wheelAngle;
                        if (relativeAngle < 0.0f) relativeAngle += 2.0f * M_PI;
                        
                        int pocket = (int)(relativeAngle * 37.0f / (2.0f * M_PI)) % 37;
                        ball.settledPocketIndex = pocket;
                    }
                }
            } else {
                // Ball rotates in complete sync with the wheel when settled
                ball.angle = wheelAngle + ball.settledPocketIndex * (2.0f * M_PI / 37.0f);
                ball.angle = std::fmod(ball.angle, 2.0f * M_PI);
                ball.radius = 0.68f;
                ball.z = 0.024f; // Sits inside the pocket cup
            }
        }

        int GetWinningNumber() const {
            if (!ball.isSettled || ball.settledPocketIndex < 0) return -1;
            return ROULETTE_NUMBERS[ball.settledPocketIndex];
        }
    };
}
