'worklet'

import type { RuntimeShaderProps, UniformValue } from '../types'
import { tileCode, type TileMode } from './image'
import { transpileShader, type TranspiledShader } from './sksl'
import { isSharedValue, resolveValue } from './values'
import type { SceneWriter } from './writer'

const TILE_MODES: readonly TileMode[] = ['clamp', 'repeat', 'mirror', 'decal']

/** The uniform types whose components are floats the engine can patch per frame. */
const ANIMATABLE = ['float', 'vec2', 'vec3', 'vec4']

/**
 * Checks a `<RuntimeShader>` against the source it was given and returns the
 * transpiled shader. Every failure is a mistake the driver would otherwise
 * report as a blank draw, or not at all.
 *
 * Nothing here reads a SharedValue: a mirrored uniform is left exactly as it
 * came in, so the writer can give it a slot instead of freezing today's number.
 */
export function compileRuntimeShader(
  options: RuntimeShaderProps
): TranspiledShader {
  const source = String(resolveValue(options.source) ?? '')
  if (source.trim() === '') {
    throw new TypeError(
      '[tgfx] <RuntimeShader>: source must be a non-empty string'
    )
  }
  const radius = options.sampleRadiusPx ?? 0
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0) {
    throw new RangeError(
      `[tgfx] <RuntimeShader>: sampleRadiusPx must be a finite number of pixels, not ${String(radius)}`
    )
  }
  if (
    options.tileMode !== undefined &&
    !TILE_MODES.includes(options.tileMode)
  ) {
    throw new TypeError(
      `[tgfx] <RuntimeShader>: tileMode must be one of ${TILE_MODES.join(', ')}`
    )
  }
  const shader = transpileShader(source)
  // The drawing is bound to the one declared child, so there is nothing to
  // match a second against — and none at all means the source ignores the very
  // pixels it was asked to filter.
  if (shader.childNames.length !== 1) {
    throw new TypeError(
      `[tgfx] <RuntimeShader>: the source must declare exactly one 'uniform shader' for the drawing, but declares ${
        shader.childNames.length === 0
          ? 'none'
          : shader.childNames.length + ' (' + shader.childNames.join(', ') + ')'
      }`
    )
  }
  const inputName = options.inputName
  if (inputName !== undefined && inputName !== shader.childNames[0]) {
    throw new TypeError(
      `[tgfx] <RuntimeShader>: inputName '${inputName}' does not match the declared 'uniform shader ${shader.childNames[0]}'`
    )
  }
  const uniforms = options.uniforms
  if (
    uniforms !== undefined &&
    (typeof uniforms !== 'object' || Array.isArray(uniforms))
  ) {
    throw new TypeError(
      '[tgfx] <RuntimeShader>: uniforms must be an object keyed by uniform name'
    )
  }
  for (const name of Object.keys(uniforms ?? {})) {
    if (!shader.uniformNames.includes(name)) {
      throw new TypeError(
        `[tgfx] <RuntimeShader>: uniform '${name}' is not declared by the source`
      )
    }
  }
  for (const name of shader.uniformNames) {
    const type = shader.uniformTypes[name]
    if (type === undefined || !ANIMATABLE.includes(type)) {
      throw new TypeError(
        `[tgfx] <RuntimeShader>: uniform '${name}' must be a float scalar or vector — an int or matrix uniform has no value slots`
      )
    }
    const value = uniforms?.[name]
    const size = shader.uniformSizes[name] ?? 1
    const components = Array.isArray(value)
      ? value
      : value != null
        ? [value]
        : []
    if (components.length !== size) {
      throw new TypeError(
        `[tgfx] <RuntimeShader>: uniform '${name}' needs ${size} component${size === 1 ? '' : 's'}, got ${components.length}`
      )
    }
    for (const component of components) {
      // A SharedValue is left alone: it carries a slot, and its value now says
      // nothing about what it will be when the frame draws.
      if (
        !isSharedValue(component) &&
        (typeof component !== 'number' || !Number.isFinite(component))
      ) {
        throw new RangeError(
          `[tgfx] <RuntimeShader>: uniform '${name}' components must be finite numbers or SharedValues`
        )
      }
    }
  }
  return shader
}

/**
 * The shader source block: body, preamble, helper names, then each declared
 * uniform with its components as anim words. A runtime-shader paint and a
 * runtime image filter both start here, so one reader serves both.
 */
export function writeShaderSource(
  w: SceneWriter,
  shader: TranspiledShader,
  uniforms: Record<string, UniformValue> | undefined
): void {
  w.pushString(shader.body)
  w.pushString(shader.preamble)
  w.push(shader.functionNames.length)
  for (const name of shader.functionNames) {
    w.pushString(name)
  }
  w.push(shader.uniformNames.length)
  for (const name of shader.uniformNames) {
    const raw = uniforms?.[name]
    const values = Array.isArray(raw) ? raw : raw != null ? [raw] : []
    const size = shader.uniformSizes[name] ?? 1
    w.pushString(name)
    w.push(size)
    for (let i = 0; i < size; i++) {
      w.pushAnim(values[i] ?? 0)
    }
  }
}

/** Image filter kind 4's payload: radius, tile mode, then the shader source. */
export function writeRuntimeFilter(
  w: SceneWriter,
  options: RuntimeShaderProps
): void {
  const shader = compileRuntimeShader(options)
  w.push(options.sampleRadiusPx ?? 0)
  w.push(tileCode(options.tileMode, 'clamp'))
  writeShaderSource(w, shader, options.uniforms)
}
