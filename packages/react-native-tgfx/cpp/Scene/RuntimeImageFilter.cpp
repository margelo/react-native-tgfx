// The runtime-shader image filter: a <RuntimeShader> in a paint's filter chain,
// or inside a <Group>, where it filters what the group composited.
#include <algorithm>
#include <cmath>
#include <stdexcept>

#include "TgfxScene.hpp"
#include "tgfx/core/ImageFilter.h"

namespace tgfxrn {

bool RuntimeImageFilterCmd::animated() const {
  return std::any_of(shader.slots.begin(), shader.slots.end(),
                     [](const AnimF& slot) { return slot.slot >= 0; });
}

std::shared_ptr<tgfx::ImageFilter> RuntimeImageFilterCmd::build(
    std::span<const double> values) const {
  // A tgfx ImageFilter is immutable, so an animated uniform rebuilds it. Only
  // when a value actually moved: a slot that reads the same every frame (a
  // paused clock, a spring at rest) keeps the filter and its compiled program.
  if (cached != nullptr && cachedValues.size() == shader.slots.size()) {
    bool unchanged = true;
    for (size_t i = 0; unchanged && i < shader.slots.size(); i++) {
      unchanged = cachedValues[i] == shader.slots[i].resolve(values);
    }
    if (unchanged) {
      return cached;
    }
  }
  auto uniforms = shader.uniforms;
  size_t at = 0;
  for (auto& uniform : uniforms) {
    for (auto& value : uniform.values) {
      value = shader.slots[at++].resolve(values);
      if (!std::isfinite(value)) {
        // A NaN would reach the driver as a uniform and paint nothing, with no
        // hint of which of them it was.
        throw std::invalid_argument("[tgfx] <RuntimeShader>: uniform '" + uniform.name +
                                    "' resolved to a value that is not finite");
      }
    }
  }
  tgfx::RuntimeShaderSource source{shader.body, std::move(uniforms), shader.preamble,
                                   shader.functionNames, {}};
  auto filter = tgfx::ImageFilter::RuntimeShader(std::move(source), sampleRadiusPx, tileMode);
  if (filter == nullptr) {
    throw std::invalid_argument("[tgfx] <RuntimeShader>: tgfx rejected this filter");
  }
  cachedValues.resize(shader.slots.size());
  for (size_t i = 0; i < shader.slots.size(); i++) {
    cachedValues[i] = shader.slots[i].resolve(values);
  }
  cached = filter;
  return filter;
}

}  // namespace tgfxrn
