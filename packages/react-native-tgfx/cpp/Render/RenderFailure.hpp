// A shader or pipeline failure the engine reported, raised once rendering is
// out of the engine's callback.
#pragma once

#include <stdexcept>
#include <string>
#include <utility>

#include "tgfx/gpu/RenderError.h"

namespace tgfxrn {

/**
 * Carries a backend compile or link failure out to the caller. The message is
 * what reaches JavaScript, so it leads with the driver's own diagnostic and
 * appends the head of the generated shader — enough to locate the line the
 * driver names, without pasting a whole program into an error string. The full
 * source stays on `details` for a caller that wants it; the engine also logs it.
 */
class RenderFailure final : public std::runtime_error {
 public:
  explicit RenderFailure(tgfx::RenderError error)
      : std::runtime_error(describe(error)), details(std::move(error)) {
  }

  const tgfx::RenderError details;

 private:
  static constexpr size_t kMaxSourceChars = 1500;

  static std::string describe(const tgfx::RenderError& error) {
    std::string message = "[tgfx] " + stageName(error.stage) + " failed: " + error.message;
    if (error.source.empty()) {
      return message;
    }
    message += "\nGenerated shader";
    if (error.source.size() > kMaxSourceChars) {
      message += " (first " + std::to_string(kMaxSourceChars) + " of " +
                 std::to_string(error.source.size()) + " characters)";
    }
    return message + ":\n" + error.source.substr(0, kMaxSourceChars);
  }

  static std::string stageName(tgfx::RenderErrorStage stage) {
    switch (stage) {
      case tgfx::RenderErrorStage::VertexShader:
        return "vertex shader";
      case tgfx::RenderErrorStage::FragmentShader:
        return "fragment shader";
      case tgfx::RenderErrorStage::Pipeline:
        return "pipeline";
    }
    return "render";
  }
};

}  // namespace tgfxrn
