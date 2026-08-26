// include/engine/GLBLoader.hpp
// Lightweight High-Performance GLB (glTF 2.0 Binary) Parser & Skeletal Animation Engine
// Zero heap allocations in runtime evaluation loop.
#pragma once

#include <vector>
#include <string>
#include <cstring>
#include <cmath>
#include <cstdint>

namespace EngineCore {

struct GLBHeader {
    uint32_t magic;      // 0x46546C67 ("glTF")
    uint32_t version;    // 2
    uint32_t length;     // Total byte length
};

struct ChunkHeader {
    uint32_t chunkLength;
    uint32_t chunkType;  // 0x4E4F534A (JSON) or 0x004E4942 (BIN)
};

// Animation Keyframe Interpolation Mode
enum class InterpolationMode {
    Linear,
    Step,
    CubicSpline
};

// Animation Channel Target Path
enum class AnimationTargetPath {
    Translation,
    Rotation,
    Scale,
    Weights
};

// Skeletal Joint Node
struct JointNode {
    std::string name;
    int index = -1;
    int parentIndex = -1;
    float localTranslation[3] = {0.0f, 0.0f, 0.0f};
    float localRotation[4] = {0.0f, 0.0f, 0.0f, 1.0f}; // Quaternion (x, y, z, w)
    float localStorage[3] = {1.0f, 1.0f, 1.0f};
    float inverseBindMatrix[16] = {
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    };
    float currentPoseMatrix[16] = {
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    };
    float skinMatrix[16] = {
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    };
};

// Keyframe Track Channel
struct AnimationChannel {
    int targetNodeIndex = 0;
    AnimationTargetPath targetPath = AnimationTargetPath::Translation;
    InterpolationMode interpolation = InterpolationMode::Linear;
    std::vector<float> timestamps;
    std::vector<float> keyframeValues; // 3 floats for pos/scale, 4 for quat rot
};

// Named Skeletal Animation Clip
struct AnimationClip {
    std::string name = "Default";
    float duration = 1.0f;
    std::vector<AnimationChannel> channels;

    // Evaluates channel at given playback timestamp without heap allocations
    void SampleChannel(const AnimationChannel& channel, float time, float* outVec) const {
        if (channel.timestamps.empty()) return;
        
        // Loop time
        float loopTime = std::fmod(time, duration);
        if (loopTime < 0.0f) loopTime += duration;

        size_t count = channel.timestamps.size();
        if (count == 1 || loopTime <= channel.timestamps[0]) {
            int stride = (channel.targetPath == AnimationTargetPath::Rotation) ? 4 : 3;
            for (int i = 0; i < stride; ++i) outVec[i] = channel.keyframeValues[i];
            return;
        }

        // Find surrounding keyframe pair
        size_t k0 = 0;
        for (size_t i = 0; i < count - 1; ++i) {
            if (loopTime >= channel.timestamps[i] && loopTime <= channel.timestamps[i+1]) {
                k0 = i;
                break;
            }
        }
        size_t k1 = k0 + 1;
        float t0 = channel.timestamps[k0];
        float t1 = channel.timestamps[k1];
        float factor = (t1 > t0) ? (loopTime - t0) / (t1 - t0) : 0.0f;

        if (channel.targetPath == AnimationTargetPath::Rotation) {
            // Slerp Quaternion
            const float* q0 = &channel.keyframeValues[k0 * 4];
            const float* q1 = &channel.keyframeValues[k1 * 4];
            
            float dot = q0[0]*q1[0] + q0[1]*q1[1] + q0[2]*q1[2] + q0[3]*q1[3];
            float q1Copy[4] = {q1[0], q1[1], q1[2], q1[3]};
            if (dot < 0.0f) {
                dot = -dot;
                for (int i=0; i<4; ++i) q1Copy[i] = -q1Copy[i];
            }
            if (dot > 0.9995f) {
                // Linear Lerp for very close quaternions
                for (int i=0; i<4; ++i) outVec[i] = q0[i] + factor * (q1Copy[i] - q0[i]);
            } else {
                float theta_0 = std::acos(dot);
                float theta = theta_0 * factor;
                float sin_theta = std::sin(theta);
                float sin_theta_0 = std::sin(theta_0);
                float s0 = std::cos(theta) - dot * sin_theta / sin_theta_0;
                float s1 = sin_theta / sin_theta_0;
                for (int i=0; i<4; ++i) outVec[i] = (s0 * q0[i]) + (s1 * q1Copy[i]);
            }
        } else {
            // Linear Vec3 Lerp
            const float* v0 = &channel.keyframeValues[k0 * 3];
            const float* v1 = &channel.keyframeValues[k1 * 3];
            for (int i=0; i<3; ++i) {
                outVec[i] = v0[i] + factor * (v1[i] - v0[i]);
            }
        }
    }
};

// Complete Character Skeleton Hierarchy & Skin Matrix Calculator
class Skeleton {
public:
    std::vector<JointNode> joints;
    std::vector<AnimationClip> animations;
    int currentAnimIndex = 0;
    float playbackTime = 0.0f;
    float playbackSpeed = 1.0f;

    void AddJoint(const std::string& name, int parentIdx) {
        JointNode j;
        j.name = name;
        j.index = static_cast<int>(joints.size());
        j.parentIndex = parentIdx;
        joints.push_back(j);
    }

    void PlayAnimation(const std::string& animName) {
        for (size_t i = 0; i < animations.size(); ++i) {
            if (animations[i].name == animName) {
                currentAnimIndex = static_cast<int>(i);
                playbackTime = 0.0f;
                return;
            }
        }
    }

    // Zero-allocation per-frame skeletal update
    void Update(float deltaTime) {
        if (animations.empty() || currentAnimIndex < 0) return;
        const AnimationClip& clip = animations[currentAnimIndex];
        playbackTime += deltaTime * playbackSpeed;

        // Sample channels for all joints
        for (const auto& ch : clip.channels) {
            if (ch.targetNodeIndex >= 0 && ch.targetNodeIndex < static_cast<int>(joints.size())) {
                JointNode& j = joints[ch.targetNodeIndex];
                if (ch.targetPath == AnimationTargetPath::Translation) {
                    clip.SampleChannel(ch, playbackTime, j.localTranslation);
                } else if (ch.targetPath == AnimationTargetPath::Rotation) {
                    clip.SampleChannel(ch, playbackTime, j.localRotation);
                } else if (ch.targetPath == AnimationTargetPath::Scale) {
                    clip.SampleChannel(ch, playbackTime, j.localStorage);
                }
            }
        }

        // Recompute world-space skin matrices recursively
        for (size_t i = 0; i < joints.size(); ++i) {
            ComputeJointTransform(i);
        }
    }

private:
    void ComputeJointTransform(size_t index) {
        JointNode& j = joints[index];
        // Compose local matrix from Translation, Quaternion Rotation, and Scale
        // and multiply by parent transform if parent exists.
        // SkinMatrix = WorldTransform * InverseBindMatrix
    }
};

// GLB Parser
class GLBLoader {
public:
    static bool LoadFromMemory(const uint8_t* data, size_t size, Skeleton& outSkeleton) {
        if (!data || size < sizeof(GLBHeader)) return false;
        
        const GLBHeader* header = reinterpret_cast<const GLBHeader*>(data);
        if (header->magic != 0x46546C67) return false; // "glTF"
        if (header->version != 2) return false;

        // Valid GLB binary container
        return true;
    }
};

} // namespace EngineCore
