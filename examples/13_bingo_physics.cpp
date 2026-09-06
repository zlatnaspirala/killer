// examples/13_bingo_physics.cpp
// Filament / Native C++ Demo 13: 3D Real-Physics Bingo Game
// Features an authoritative diamond-shaped tumbling drum, continuous rigid-body 
// ball kinematics, diamond cage collision planes, dynamic baffles, ball extraction chute,
// and complete classic 75-ball Bingo (B-I-N-G-O) game rules.

#include <iostream>
#include <vector>
#include <cmath>
#include <random>
#include <algorithm>
#include <string>
#include <sstream>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace BingoPhysics {

    enum class BallCategory {
        B = 0, // 1 - 15
        I = 1, // 16 - 30
        N = 2, // 31 - 45
        G = 3, // 46 - 60
        O = 4  // 61 - 75
    };

    struct Vector3 {
        float x = 0.0f;
        float y = 0.0f;
        float z = 0.0f;

        Vector3() = default;
        Vector3(float _x, float _y, float _z) : x(_x), y(_y), z(_z) {}

        Vector3 operator+(const Vector3& o) const { return Vector3(x + o.x, y + o.y, z + o.z); }
        Vector3 operator-(const Vector3& o) const { return Vector3(x - o.x, y - o.y, z - o.z); }
        Vector3 operator*(float s) const { return Vector3(x * s, y * s, z * s); }
        float Length() const { return std::sqrt(x * x + y * y + z * z); }
        float LengthSq() const { return x * x + y * y + z * z; }
        Vector3 Normalized() const {
            float l = Length();
            return (l > 1e-5f) ? Vector3(x / l, y / l, z / l) : Vector3(0, 0, 0);
        }
        static float Dot(const Vector3& a, const Vector3& b) {
            return a.x * b.x + a.y * b.y + a.z * b.z;
        }
        static Vector3 Cross(const Vector3& a, const Vector3& b) {
            return Vector3(
                a.y * b.z - a.z * b.y,
                a.z * b.x - a.x * b.z,
                a.x * b.y - a.y * b.x
            );
        }
    };

    struct BingoBall {
        int number = 1;
        BallCategory category = BallCategory::B;
        Vector3 position;
        Vector3 velocity;
        Vector3 angularVelocity;
        float radius = 0.075f;
        float mass = 0.025f;
        bool isDrawn = false;
        bool isExiting = false;
        float exitProgress = 0.0f;

        std::string GetCode() const {
            const char cats[] = {'B', 'I', 'N', 'G', 'O'};
            return std::string(1, cats[(int)category]) + "-" + std::to_string(number);
        }
    };

    // Classic 5x5 Bingo Card
    struct BingoCard {
        int grid[5][5] = {{0}};
        bool daubed[5][5] = {{false}};

        void Generate(std::mt19939& rng) {
            // Column 0: B (1-15)
            // Column 1: I (16-30)
            // Column 2: N (31-45) [center free]
            // Column 3: G (46-60)
            // Column 4: O (61-75)
            for (int col = 0; col < 5; ++col) {
                std::vector<int> pool;
                int start = col * 15 + 1;
                for (int n = start; n < start + 15; ++n) pool.push_back(n);
                std::shuffle(pool.begin(), pool.end(), rng);

                for (int row = 0; row < 5; ++row) {
                    if (col == 2 && row == 2) {
                        grid[row][col] = 0; // FREE space
                        daubed[row][col] = true;
                    } else {
                        grid[row][col] = pool[row];
                        daubed[row][col] = false;
                    }
                }
            }
        }

        bool DaubNumber(int num) {
            for (int r = 0; r < 5; ++r) {
                for (int c = 0; c < 5; ++c) {
                    if (grid[r][c] == num) {
                        daubed[r][c] = true;
                        return true;
                    }
                }
            }
            return false;
        }

        bool CheckWin(std::string& patternName) const {
            // Check Rows
            for (int r = 0; r < 5; ++r) {
                bool rowWin = true;
                for (int c = 0; c < 5; ++c) if (!daubed[r][c]) { rowWin = false; break; }
                if (rowWin) { patternName = "Horizontal Row " + std::to_string(r + 1); return true; }
            }
            // Check Columns
            for (int c = 0; c < 5; ++c) {
                bool colWin = true;
                for (int r = 0; r < 5; ++r) if (!daubed[r][c]) { colWin = false; break; }
                if (colWin) {
                    const char colNames[] = {'B', 'I', 'N', 'G', 'O'};
                    patternName = std::string("Vertical Column ") + colNames[c];
                    return true;
                }
            }
            // Check Diagonals
            bool diag1 = true, diag2 = true;
            for (int i = 0; i < 5; ++i) {
                if (!daubed[i][i]) diag1 = false;
                if (!daubed[i][4 - i]) diag2 = false;
            }
            if (diag1) { patternName = "Diagonal (Top-Left to Bottom-Right)"; return true; }
            if (diag2) { patternName = "Diagonal (Top-Right to Bottom-Left)"; return true; }

            // Check 4 Corners
            if (daubed[0][0] && daubed[0][4] && daubed[4][0] && daubed[4][4]) {
                patternName = "Four Corners";
                return true;
            }

            // Check Full House / Coverall
            bool blackout = true;
            for (int r = 0; r < 5; ++r) {
                for (int c = 0; c < 5; ++c) if (!daubed[r][c]) { blackout = false; break; }
            }
            if (blackout) { patternName = "Full Card Coverall (BINGO!)"; return true; }

            return false;
        }
    };

    // Diamond Drum Rigid-Body Simulation
    // A diamond-shaped prism rotates around its horizontal X-axis (z-y diamond profile: |y| + |z| <= R)
    class DiamondBingoSimulation {
    public:
        float drumAngle = 0.0f;
        float drumAngularVelocity = 2.8f; // rad/s
        float drumTargetVelocity = 2.8f;
        float drumLength = 1.30f;          // Length along X axis (-0.65 to +0.65)
        float diamondRadius = 0.95f;       // Distance from center to diamond facets
        Vector3 gravity = Vector3(0.0f, -9.81f, 0.0f);
        float restitution = 0.72f;        // Bounciness of balls
        float friction = 0.40f;           // Surface friction dragging balls during rotation

        std::vector<BingoBall> balls;
        std::vector<int> drawnOrder;
        BingoCard playerCard;
        bool isSpinning = false;
        bool autoDraw = false;
        float drawTimer = 0.0f;
        float autoDrawInterval = 3.5f;
        int lastDrawnNumber = -1;
        std::string winPattern = "";
        bool hasWon = false;

        std::mt19939 rng;

        DiamondBingoSimulation() {
            rng.seed(1337);
            ResetGame();
        }

        void ResetGame() {
            balls.clear();
            drawnOrder.clear();
            lastDrawnNumber = -1;
            hasWon = false;
            winPattern = "";
            drawTimer = 0.0f;
            drumAngle = 0.0f;
            drumAngularVelocity = 2.8f;
            drumTargetVelocity = 2.8f;
            isSpinning = true;

            // Populate all 75 classic Bingo balls
            balls.reserve(75);
            for (int i = 1; i <= 75; ++i) {
                BingoBall b;
                b.number = i;
                if (i <= 15) b.category = BallCategory::B;
                else if (i <= 30) b.category = BallCategory::I;
                else if (i <= 45) b.category = BallCategory::N;
                else if (i <= 60) b.category = BallCategory::G;
                else b.category = BallCategory::O;

                // Scatter balls inside the bottom scoop of the diamond drum
                float x = -drumLength * 0.4f + ((float)(rng() % 1000) / 1000.0f) * (drumLength * 0.8f);
                float y = -diamondRadius * 0.45f + ((float)(rng() % 500) / 1000.0f) * 0.35f;
                float z = -0.3f + ((float)(rng() % 600) / 1000.0f) * 0.6f;

                b.position = Vector3(x, y, z);
                b.velocity = Vector3(
                    ((float)(rng() % 200) - 100.0f) * 0.005f,
                    ((float)(rng() % 100)) * 0.005f,
                    ((float)(rng() % 200) - 100.0f) * 0.005f
                );
                b.radius = 0.065f;
                b.isDrawn = false;
                b.isExiting = false;
                b.exitProgress = 0.0f;
                balls.push_back(b);
            }

            // Generate fresh player card
            playerCard.Generate(rng);
        }

        // Draw next random ball from inside the drum
        int DrawNextBall() {
            std::vector<int> candidateIndices;
            for (size_t i = 0; i < balls.size(); ++i) {
                if (!balls[i].isDrawn && !balls[i].isExiting) {
                    candidateIndices.push_back((int)i);
                }
            }

            if (candidateIndices.empty()) return -1;

            int pick = candidateIndices[rng() % candidateIndices.size()];
            BingoBall& b = balls[pick];
            b.isExiting = true;
            b.exitProgress = 0.0f;
            lastDrawnNumber = b.number;
            drawnOrder.push_back(b.number);

            // Auto daub player card
            playerCard.DaubNumber(b.number);

            // Check win
            if (!hasWon && playerCard.CheckWin(winPattern)) {
                hasWon = true;
            }

            return b.number;
        }

        // Physics step: tumbling inside diamond prism
        void Update(float dt) {
            if (dt > 0.05f) dt = 0.05f;

            // 1. Drum Rotation Kinematics
            if (isSpinning) {
                drumAngularVelocity += (drumTargetVelocity - drumAngularVelocity) * 3.0f * dt;
                drumAngle += drumAngularVelocity * dt;
                drumAngle = std::fmod(drumAngle, 2.0f * (float)M_PI);
            }

            // 2. Auto-draw timer
            if (autoDraw && !hasWon) {
                drawTimer += dt;
                if (drawTimer >= autoDrawInterval) {
                    drawTimer = 0.0f;
                    DrawNextBall();
                }
            }

            // Cosine and Sine of drum orientation angle around X axis
            float cosA = std::cos(drumAngle);
            float sinA = std::sin(drumAngle);

            // Four outward normal vectors in drum local space for a diamond rhombus:
            // The 4 diamond walls: (0, 1, 1), (0, 1, -1), (0, -1, 1), (0, -1, -1) normalized
            const float invSqrt2 = 0.70710678f;
            Vector3 localNormals[4] = {
                Vector3(0.0f,  invSqrt2,  invSqrt2),
                Vector3(0.0f,  invSqrt2, -invSqrt2),
                Vector3(0.0f, -invSqrt2,  invSqrt2),
                Vector3(0.0f, -invSqrt2, -invSqrt2)
            };

            // Transform normals into world space based on drum rotation
            Vector3 worldNormals[4];
            for (int i = 0; i < 4; ++i) {
                float ny = localNormals[i].y * cosA - localNormals[i].z * sinA;
                float nz = localNormals[i].y * sinA + localNormals[i].z * cosA;
                worldNormals[i] = Vector3(0.0f, ny, nz);
            }

            float halfLen = drumLength * 0.5f;
            float diamondFacetDist = diamondRadius * invSqrt2; // Perpendicular distance to flat diamond facet

            // 3. Update Ball Kinematics and Diamond Collisions
            for (size_t i = 0; i < balls.size(); ++i) {
                BingoBall& b = balls[i];

                if (b.isExiting) {
                    // Ball rolling along presentation chute
                    b.exitProgress += dt * 1.6f;
                    if (b.exitProgress >= 1.0f) {
                        b.exitProgress = 1.0f;
                        b.isDrawn = true;
                    }
                    // Interpolate towards caller display pedestal
                    float t = b.exitProgress;
                    b.position.x = halfLen + 0.35f + t * 0.45f;
                    b.position.y = 0.85f - t * 0.40f;
                    b.position.z = 0.20f + std::sin(t * (float)M_PI) * 0.15f;
                    continue;
                }

                if (b.isDrawn) continue;

                // Apply Gravity
                b.velocity = b.velocity + gravity * dt;

                // Position update
                b.position = b.position + b.velocity * dt;

                // Collision with 4 rotating diamond facets
                for (int w = 0; w < 4; ++w) {
                    Vector3 normal = worldNormals[w];
                    // Distance of ball center along plane normal
                    float dist = Vector3::Dot(b.position, normal);

                    if (dist + b.radius > diamondFacetDist) {
                        float penetration = (dist + b.radius) - diamondFacetDist;
                        b.position = b.position - normal * penetration;

                        // Surface velocity of rotating drum at contact point:
                        // v = omega x r around X axis
                        Vector3 r(0.0f, b.position.y, b.position.z);
                        Vector3 omega(drumAngularVelocity, 0.0f, 0.0f);
                        Vector3 vWall = Vector3::Cross(omega, r);

                        // Relative velocity
                        Vector3 vRel = b.velocity - vWall;
                        float normalVel = Vector3::Dot(vRel, normal);

                        if (normalVel > 0.0f) {
                            // Bounce impulse along normal
                            Vector3 vn = normal * normalVel;
                            Vector3 vt = vRel - vn;

                            // Apply restitution and tangential wall friction
                            b.velocity = vWall - vn * restitution + vt * (1.0f - friction * dt * 30.0f);
                        }
                    }
                }

                // Collision with cylinder/prism End Caps (left & right circular/diamond plates)
                if (b.position.x - b.radius < -halfLen) {
                    b.position.x = -halfLen + b.radius;
                    if (b.velocity.x < 0.0f) b.velocity.x = -b.velocity.x * restitution;
                } else if (b.position.x + b.radius > halfLen) {
                    b.position.x = halfLen - b.radius;
                    if (b.velocity.x > 0.0f) b.velocity.x = -b.velocity.x * restitution;
                }

                // Internal scoop/baffle lifting: 2 internal diamond shelf baffles attached to drum
                // When drum turns, shelves lift balls upward, letting them cascade down dramatically
                float shelfAngle = drumAngle;
                float sy = std::sin(shelfAngle);
                float sz = std::cos(shelfAngle);
                Vector3 shelfNormal(0.0f, sz, -sy);
                float shelfDist = Vector3::Dot(b.position, shelfNormal);
                if (std::abs(shelfDist) < b.radius * 0.9f && b.position.y < 0.1f && b.position.y > -0.6f) {
                    // Scoop pushes ball up along drum rotation
                    b.velocity.y += std::abs(drumAngularVelocity) * 1.2f;
                    b.velocity.z += drumAngularVelocity * 0.8f;
                }
            }

            // 4. Ball-to-Ball Collisions
            for (size_t i = 0; i < balls.size(); ++i) {
                if (balls[i].isDrawn || balls[i].isExiting) continue;
                for (size_t j = i + 1; j < balls.size(); ++j) {
                    if (balls[j].isDrawn || balls[j].isExiting) continue;

                    Vector3 diff = balls[j].position - balls[i].position;
                    float distSq = diff.LengthSq();
                    float minDist = balls[i].radius + balls[j].radius;

                    if (distSq < minDist * minDist && distSq > 1e-6f) {
                        float dist = std::sqrt(distSq);
                        Vector3 colNormal = diff * (1.0f / dist);
                        float overlap = 0.5f * (minDist - dist);

                        balls[i].position = balls[i].position - colNormal * overlap;
                        balls[j].position = balls[j].position + colNormal * overlap;

                        Vector3 vRel = balls[j].velocity - balls[i].velocity;
                        float sepVel = Vector3::Dot(vRel, colNormal);

                        if (sepVel < 0.0f) {
                            float impulse = -(1.0f + restitution) * sepVel * 0.5f;
                            balls[i].velocity = balls[i].velocity - colNormal * impulse;
                            balls[j].velocity = balls[j].velocity + colNormal * impulse;
                        }
                    }
                }
            }
        }
    };
}
