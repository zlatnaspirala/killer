// examples/11_plinko.cpp
// Filament / Native C++ Demo 11: 3D Plinko Cascade Simulation Engine
// High-performance real-time physics solver, elastic peg collisions,
// gravity vectors, and dynamic particle-trail integration.

#include <iostream>
#include <vector>
#include <random>
#include <cmath>
#include <memory>
#include <algorithm>

namespace PlinkoPhysics {

    struct Vec2 {
        float x = 0.0f;
        float y = 0.0f;

        Vec2() = default;
        Vec2(float x, float y) : x(x), y(y) {}

        Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
        Vec2 operator-(const Vec2& o) const { return {x - o.x, y - o.y}; }
        Vec2 operator*(float f) const { return {x * f, y * f}; }
        float Length() const { return std::sqrt(x * x + y * y); }
        Vec2 Normalized() const {
            float len = Length();
            if (len < 1e-5f) return {0, 0};
            return {x / len, y / len};
        }
        float Dot(const Vec2& o) const { return x * o.x + y * o.y; }
    };

    struct Peg {
        Vec2 pos;
        float radius = 0.015f;
        int row;
        int col;
    };

    struct Ball {
        int id;
        Vec2 pos;
        Vec2 vel;
        float radius = 0.03f;
        float bounciness = 0.55f;
        bool active = true;
        std::vector<Vec2> trail;
    };

    class PlinkoBoard {
    public:
        std::vector<Peg> pegs;
        std::vector<Ball> balls;
        int maxRows = 8;
        float gravity = -9.81f;
        float timeStep = 0.016f; // 60 FPS tick
        int credits = 1000;
        int score = 0;
        std::mt19939 rng;

        PlinkoBoard() {
            rng.seed(1337);
            GeneratePegs();
        }

        void GeneratePegs() {
            pegs.clear();
            float startY = 2.0f;
            float rowSpacing = 0.22f;
            float colSpacing = 0.24f;

            for (int r = 0; r < maxRows; ++r) {
                int cols = 3 + r; // Pyramid structure
                float startX = -((cols - 1) * colSpacing) * 0.5f;
                for (int c = 0; c < cols; ++c) {
                    Peg p;
                    p.pos = Vec2(startX + c * colSpacing, startY - r * rowSpacing);
                    p.row = r;
                    p.col = c;
                    pegs.push_back(p);
                }
            }
        }

        void DropBall() {
            if (credits <= 0) return;
            credits -= 10;

            std::uniform_real_distribution<float> dist(-0.05f, 0.05f);
            Ball b;
            b.id = balls.size() + 1;
            b.pos = Vec2(dist(rng), 2.3f);
            b.vel = Vec2(0.0f, -1.0f);
            b.bounciness = 0.58f;
            b.active = true;
            balls.push_back(b);
        }

        void Update(float dt) {
            for (auto& ball : balls) {
                if (!ball.active) continue;

                // Apply gravity
                ball.vel.y += gravity * dt;
                ball.pos = ball.pos + ball.vel * dt;

                // Push position to trail
                ball.trail.push_back(ball.pos);
                if (ball.trail.size() > 20) {
                    ball.trail.erase(ball.trail.begin());
                }

                // Check side wall deflections
                const float wallLimit = 1.15f;
                if (ball.pos.x - ball.radius < -wallLimit) {
                    ball.pos.x = -wallLimit + ball.radius;
                    ball.vel.x = -ball.vel.x * ball.bounciness;
                } else if (ball.pos.x + ball.radius > wallLimit) {
                    ball.pos.x = wallLimit - ball.radius;
                    ball.vel.x = -ball.vel.x * ball.bounciness;
                }

                // Resolve Collisions with static pegs
                for (const auto& peg : pegs) {
                    Vec2 toBall = ball.pos - peg.pos;
                    float dist = toBall.Length();
                    float minDist = ball.radius + peg.radius;

                    if (dist < minDist) {
                        // Push out of overlap (Static resolution)
                        Vec2 normal = toBall.Normalized();
                        ball.pos = peg.pos + normal * minDist;

                        // Elastic reflection
                        float velAlongNormal = ball.vel.Dot(normal);
                        if (velAlongNormal < 0) {
                            float impulse = -(1.0f + ball.bounciness) * velAlongNormal;
                            ball.vel = ball.vel + normal * impulse;
                            // Add slight lateral perturbation to break deterministic traps
                            std::uniform_real_distribution<float> pert(-0.1f, 0.1f);
                            ball.vel.x += pert(rng);
                        }
                    }
                }

                // Check if ball landed in bins (Y < 0.2f)
                if (ball.pos.y < 0.2f) {
                    ball.active = false;
                    
                    // Determine payout based on bin offset
                    float x = ball.pos.x;
                    int binIndex = std::min(8, std::max(0, (int)((x + 1.1f) / 0.244f)));
                    float multipliers[] = {10.0f, 3.0f, 1.5f, 0.5f, 0.2f, 0.5f, 1.5f, 3.0f, 10.0f};
                    float mult = multipliers[binIndex];
                    int win = (int)(10 * mult);

                    credits += win;
                    score += win;
                }
            }
        }
    };
}
