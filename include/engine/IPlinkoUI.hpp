#pragma once
#include <string>
#include <vector>
#include <functional>

namespace EngineCore {

/**
 * Platform-agnostic game state for 3D Plinko Cascade.
 * Completely decoupled from any rendering backend or DOM/UI framework.
 */
struct PlinkoGameState {
    int credits = 1000;
    int highScore = 1000;
    int rows = 8;
    float gravity = -4.0f;
    float bounciness = 0.55f;
    float roughness = 0.05f;
    int materialType = 0;
    int visualEffect = 0; // 0: Pulse Ring, 1: Chromatic, 2: Electro, 3: Halo
    int trailMode = 1;    // 0: Off, 1: Pulse, 2: Rainbow
    bool autoDrop = false;
    bool isUiVisible = true;
    bool isMobileMode = false;
    int activeBallsCount = 0;
};

/**
 * Abstract UI Interface.
 * Allows the exact same Plinko game loop to drive:
 *  - Web DOM UI (Browser build)
 *  - RmlUi / Native HTML-CSS (Desktop, Android, iOS, Console builds)
 */
class IPlinkoUI {
public:
    virtual ~IPlinkoUI() = default;

    virtual bool Initialize(const char* templatePath) = 0;
    virtual void Shutdown() = 0;

    // View synchronizers
    virtual void UpdateState(const PlinkoGameState& state) = 0;
    virtual void SetVisible(bool visible) = 0;
    virtual bool IsVisible() const = 0;
    virtual void TriggerAutoRestoreTimer(float delaySeconds = 3.0f) = 0;

    // Event notifications from game logic
    virtual void OnBallLanded(int binIndex, float multiplier, int payout) = 0;
    virtual void OnBallDropped(int remainingCredits) = 0;

    // Input & Frame rendering callbacks (for in-engine renderers like RmlUi)
    virtual void ProcessInputEvent(int eventType, int param1, int param2) = 0;
    virtual void Render() = 0;

    // Action listener callback binding
    using ActionCallback = std::function<void(const std::string& actionName, float value)>;
    void SetActionCallback(ActionCallback cb) { m_actionCallback = cb; }

protected:
    ActionCallback m_actionCallback;
};

} // namespace EngineCore
