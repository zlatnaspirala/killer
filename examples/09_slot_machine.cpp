// examples/09_slot_machine.cpp
// Filament / Native C++ Demo 09: 3D Casino Slot Machine & Particle Coins Showcase
// Demonstrates spinning cylinder/torus reels, animated levers with damped sine physics,
// instanced 3D coin particle solvers, and multi-symbol PBR material rendering.

#include <iostream>
#include <vector>
#include <random>
#include <cmath>
#include <memory>
#include <string>

// Simulating Filament framework and standard game loops
namespace CasinoDemo {

    struct Vec3 {
        float x = 0.0f, y = 0.0f, z = 0.0f;
        Vec3() = default;
        Vec3(float x, float y, float z) : x(x), y(y), z(z) {}
    };

    enum SymbolType {
        Symbol_Cherry = 0,    // Red Sphere
        Symbol_Donut,         // Orange Torus
        Symbol_Gem,           // Cyan Icosahedron
        Symbol_GoldCube,      // Yellow Cube
        Symbol_WildTrefoil,   // Purple Trefoil Knot
        Symbol_COUNT
    };

    const std::string SymbolNames[Symbol_COUNT] = {
        "Cherry (Sphere)",
        "Donut (Torus)",
        "Gem (Icosahedron)",
        "Lucky Gold (Cube)",
        "Wild Trefoil (Knot)"
    };

    const float SymbolMultipliers[Symbol_COUNT] = {
        8.0f,   // Cherry
        15.0f,  // Donut
        30.0f,  // Gem
        50.0f,  // Gold Cube
        100.0f  // Wild Trefoil (Knot)
    };

    struct Reel {
        float angle = 0.0f;
        float speed = 0.0f;
        bool spinning = false;
        SymbolType currentSymbol = Symbol_Cherry;
        float stopTimer = 0.0f;
    };

    struct CoinParticle {
        Vec3 position;
        Vec3 velocity;
        float lifetime = 0.0f;
        float maxLifetime = 3.0f;
        bool active = false;
    };

    class SlotMachine {
    public:
        int credits = 1000;
        int bet = 10;
        Reel reels[3];
        float leverAngle = 0.0f;
        float leverVelocity = 0.0f;
        bool leverPulled = false;

        std::vector<CoinParticle> coins;
        std::mt19939 rng;

        SlotMachine() {
            rng.seed(1337); // Seed RNG for predictable debug results
            // Initialize reels
            for(int i = 0; i < 3; ++i) {
                reels[i].currentSymbol = static_cast<SymbolType>(i % Symbol_COUNT);
                reels[i].angle = reels[i].currentSymbol * (360.0f / Symbol_COUNT);
            }
            // Pre-allocate coin particle pool (instanced meshes in Filament)
            coins.resize(100);
        }

        void Spin(int playerBet) {
            if (playerBet > credits) {
                std::cout << ">> [SLOT SYSTEM] Insufficient credits! Please add more buy-in.\n";
                return;
            }
            if (reels[0].spinning || reels[1].spinning || reels[2].spinning) {
                std::cout << ">> [SLOT SYSTEM] Reels are already spinning!\n";
                return;
            }

            credits -= playerBet;
            bet = playerBet;

            std::cout << ">> [SLOT SYSTEM] Lever Pulled! Bet: " << bet << " Credits | Remaining: " << credits << "\n";
            
            // Trigger lever animation
            leverPulled = true;
            leverVelocity = 15.0f; // Rapid downforce velocity

            // Set up random destination symbol states
            std::uniform_int_distribution<int> dist(0, Symbol_COUNT - 1);
            for(int i = 0; i < 3; ++i) {
                reels[i].spinning = true;
                reels[i].speed = 40.0f + i * 15.0f; // Varied high initial roll speeds
                reels[i].stopTimer = 1.0f + i * 0.75f; // Reels stop sequentially
                reels[i].currentSymbol = static_cast<SymbolType>(dist(rng));
            }
        }

        void Update(float dt) {
            // 1. Solve Reels Physics
            bool allStoppedThisFrame = false;
            for(int i = 0; i < 3; ++i) {
                if (reels[i].spinning) {
                    reels[i].angle += reels[i].speed * 10.0f * dt;
                    reels[i].stopTimer -= dt;

                    if (reels[i].stopTimer <= 0.0f) {
                        // Slow down and snap to destination symbol angle
                        reels[i].spinning = false;
                        reels[i].speed = 0.0f;
                        reels[i].angle = reels[i].currentSymbol * (360.0f / Symbol_COUNT);
                        std::cout << ">> [REEL #" << i + 1 << " STOPPED] Landed on: " << SymbolNames[reels[i].currentSymbol] << "\n";
                        
                        if (i == 2) {
                            allStoppedThisFrame = true;
                        }
                    }
                }
            }

            if (allStoppedThisFrame) {
                EvaluateResult();
            }

            // 2. Solve Lever Physics (Damped Harmonic Oscillator to model realistic bounce-back)
            if (leverPulled) {
                leverAngle += leverVelocity * dt;
                // Simple spring return forces
                float targetAngle = 0.0f;
                if (leverAngle > 0.8f) { // Bottom out at ~45 degrees
                    leverAngle = 0.8f;
                    leverVelocity = -12.0f; // Quick bounce back
                }
                leverVelocity += (targetAngle - leverAngle) * 45.0f * dt; // Spring stiffness
                leverVelocity *= std::exp(-8.0f * dt); // Damping

                if (std::abs(leverAngle) < 0.01f && std::abs(leverVelocity) < 0.05f) {
                    leverAngle = 0.0f;
                    leverVelocity = 0.0f;
                    leverPulled = false;
                }
            }

            // 3. Solve 3D Coin Particle Physics
            for(auto& coin : coins) {
                if (coin.active) {
                    coin.lifetime += dt;
                    if (coin.lifetime >= coin.maxLifetime) {
                        coin.active = false;
                        continue;
                    }

                    // Gravity pull
                    coin.velocity.y -= 9.81f * dt;

                    // Apply displacement
                    coin.position.x += coin.velocity.x * dt;
                    coin.position.y += coin.velocity.y * dt;
                    coin.position.z += coin.velocity.z * dt;

                    // Collision with Payout Tray at Y = -0.7
                    if (coin.position.y <= -0.7f) {
                        coin.position.y = -0.7f;
                        coin.velocity.y = -coin.velocity.y * 0.45f; // Coefficient of restitution / bounce
                        coin.velocity.x *= 0.8f; // Friction
                        coin.velocity.z *= 0.8f;
                    }
                }
            }
        }

        void EvaluateResult() {
            std::cout << "\n================= RESULTS PANEL =================\n";
            std::cout << " Reel 1: [" << SymbolNames[reels[0].currentSymbol] << "]\n";
            std::cout << " Reel 2: [" << SymbolNames[reels[1].currentSymbol] << "]\n";
            std::cout << " Reel 3: [" << SymbolNames[reels[2].currentSymbol] << "]\n";
            std::cout << "-------------------------------------------------\n";

            int multiplier = 0;
            bool win = false;

            if (reels[0].currentSymbol == reels[1].currentSymbol && reels[1].currentSymbol == reels[2].currentSymbol) {
                // Jackpot! 3 of a kind
                SymbolType winType = reels[0].currentSymbol;
                multiplier = SymbolMultipliers[winType];
                int payout = bet * multiplier;
                credits += payout;
                win = true;
                std::cout << "🎉💥 TRIPLE JACKPOT WIN!!! Payout: " << payout << " Credits (" << multiplier << "x Bet) 💥🎉\n";
                SpawnCoins(60);
            } 
            else if (reels[0].currentSymbol == reels[1].currentSymbol || 
                     reels[1].currentSymbol == reels[2].currentSymbol || 
                     reels[0].currentSymbol == reels[2].currentSymbol) {
                // Pair Win! 2 of a kind
                SymbolType winType = (reels[0].currentSymbol == reels[1].currentSymbol) ? reels[0].currentSymbol : reels[2].currentSymbol;
                multiplier = 3;
                int payout = bet * multiplier;
                credits += payout;
                win = true;
                std::cout << "💰 Double Match Win! Payout: " << payout << " Credits (3x Bet) 💰\n";
                SpawnCoins(20);
            }
            else {
                std::cout << "💀 No Matches. Better luck next spin! 💀\n";
            }
            std::cout << "Current Total Credits: " << credits << " Credits\n";
            std::cout << "=================================================\n\n";
        }

        void SpawnCoins(int count) {
            std::uniform_real_distribution<float> velDist(-3.0f, 3.0f);
            std::uniform_real_distribution<float> upDist(4.0f, 8.0f);
            int spawned = 0;

            for(auto& coin : coins) {
                if (!coin.active) {
                    coin.active = true;
                    coin.position = Vec3(0.0f, -0.2f, 0.2f); // Discharges from the center chute
                    coin.velocity = Vec3(velDist(rng), upDist(rng), velDist(rng));
                    coin.lifetime = 0.0f;
                    spawned++;
                    if (spawned >= count) break;
                }
            }
            std::cout << ">> [PARTICLE SOLVER] Discharged " << spawned << " instanced golden coins in 3D Space.\n";
        }
    };
}

int main(int argc, char** argv) {
    std::cout << "========================================================\n";
    std::cout << " FILAMENT C++ DEMO 09: 3D SLOT MACHINE CASINO & PARTICLES\n";
    std::cout << "========================================================\n";

    CasinoDemo::SlotMachine game;

    // Simulate 3 spins with different outcomes
    for(int spin = 1; spin <= 3; ++spin) {
        std::cout << "\n--- SIMULATING SPIN #" << spin << " ---\n";
        game.Spin(20);

        // Run the physics/simulation step for 4.0 seconds (dt = 0.1s per step)
        for(int step = 0; step < 40; ++step) {
            game.Update(0.1f);
        }
    }

    std::cout << "========================================================\n";
    std::cout << " DEMO 09 CASINO SIMULATION COMPLETED SUCCESSFULLY       \n";
    std::cout << "========================================================\n";
    return 0;
}
