import { expect, mock, test } from 'bun:test'

// createHandle reaches for runOnJS; this file has no other reanimated dependency.
mock.module('react-native-reanimated', () => ({}))
import React from 'react'
import { compileScene } from '../compiler/compile'
import { compileRuntimeShader } from '../compiler/runtimeShader'
import { SceneWriter } from '../compiler/writer'
import { directNodes } from '../reconciler/directNodes'
import { Group } from '../components/Group'
import { Blur, RuntimeShader } from '../components/Paint'
import { Rect } from '../components/drawings'
import * as e from '../elements'
import type { Node } from '../reconciler/types'
import type { RuntimeShaderProps } from '../types'

const IDENTITY = `
uniform shader content;
half4 main(float2 p) {
  return content.eval(p);
}
`

const identity: RuntimeShaderProps = {
  source: IDENTITY,
  inputName: 'content',
}

function compiled(roots: Node[]) {
  const writer = new SceneWriter()
  const { buffer, strings } = compileScene(roots, writer)
  const words = new Float64Array(buffer)
  return { words: Array.from(words.subarray(0, words[1])), strings }
}

test('the drawing is bound as the declared shader input', () => {
  const shader = compileRuntimeShader(identity)
  expect(shader.childNames).toEqual(['content'])
  // `content.eval(p)` became the child call the engine binds the drawing to.
  expect(shader.body).toContain('TGFX_CHILD_0')
  expect(shader.body).not.toContain('content')
})

test('the source must declare exactly one shader input', () => {
  expect(() =>
    compileRuntimeShader({
      source: 'half4 main(float2 p) { return half4(1.0); }',
    })
  ).toThrow('exactly one')
  expect(() =>
    compileRuntimeShader({
      ...identity,
      source: `uniform shader other;\n${IDENTITY}`,
    })
  ).toThrow('exactly one')
  expect(() =>
    compileRuntimeShader({ ...identity, inputName: 'missing' })
  ).toThrow("inputName 'missing'")
})

test('sampleRadiusPx and tileMode are checked before they reach the wire', () => {
  for (const sampleRadiusPx of [-1, NaN, Infinity]) {
    expect(() => compileRuntimeShader({ ...identity, sampleRadiusPx })).toThrow(
      'sampleRadiusPx'
    )
  }
  expect(() =>
    compileRuntimeShader({
      ...identity,
      tileMode: 'wrap' as RuntimeShaderProps['tileMode'],
    })
  ).toThrow('tileMode')
})

test('every declared uniform must be supplied in full', () => {
  const options: RuntimeShaderProps = {
    ...identity,
    source: `uniform float2 uOffset;\n${IDENTITY}`,
    uniforms: { uOffset: [1, 2] },
  }
  expect(compileRuntimeShader(options).uniformSizes.uOffset).toBe(2)
  expect(() => compileRuntimeShader({ ...options, uniforms: {} })).toThrow(
    "'uOffset' needs 2 components"
  )
  expect(() =>
    compileRuntimeShader({ ...options, uniforms: { uOffset: [1] } })
  ).toThrow('needs 2 components')
  expect(() =>
    compileRuntimeShader({ ...options, uniforms: { uOffset: [1, Infinity] } })
  ).toThrow('finite')
  expect(() =>
    compileRuntimeShader({
      ...options,
      uniforms: { uOffset: [1, 2], uNope: 3 },
    })
  ).toThrow("'uNope' is not declared")
})

test('a uniform with no value slots is rejected rather than frozen', () => {
  for (const [type, value] of [
    ['int', 1],
    ['float2x2', [1, 0, 0, 1]],
  ] as const) {
    expect(() =>
      compileRuntimeShader({
        ...identity,
        source: `uniform ${type} uThing;\n${IDENTITY}`,
        uniforms: { uThing: value as never },
      })
    ).toThrow('float scalar or vector')
  }
})

test('an animated uniform keeps its slot instead of being read at compile time', () => {
  const uLevel = {
    _isReanimatedSharedValue: true as const,
    get value(): number {
      throw new Error('read on the wrong runtime')
    },
  }
  const w = new SceneWriter()
  w.known = new Map([[uLevel, 0.25]])
  const node = e.group({}, [
    e.runtimeShader({
      ...identity,
      source: `uniform float uLevel;\n${IDENTITY}`,
      uniforms: { uLevel },
    }),
    e.rect({ width: 8, height: 8 }),
  ])
  expect(() => compileScene([node], w)).not.toThrow()
  // It reached the value array as a slot, not as today's number.
  expect(w.values).toEqual([uLevel])
})

test('a group filter compiles byte-identically through both APIs', () => {
  const jsx = compiled(
    directNodes(
      <Group opacity={0.5}>
        <RuntimeShader {...identity} sampleRadiusPx={2} tileMode="decal" />
        <Rect width={20} height={20} color="red" />
      </Group>
    )!
  )
  const factories = compiled([
    e.group({ opacity: 0.5 }, [
      e.runtimeShader({ ...identity, sampleRadiusPx: 2, tileMode: 'decal' }),
      e.rect({ width: 20, height: 20, color: 'red' }),
    ]),
  ])
  expect(factories.words).toEqual(jsx.words)
  expect(factories.strings).toEqual(jsx.strings)
  // The transpiled body travels in the string table, so the filter is really encoded.
  expect(jsx.strings).toContain(compileRuntimeShader(identity).body)
})

test('a group takes the layer the filter needs, and one filter only', () => {
  const plain = compiled(
    directNodes(
      <Group>
        <Rect width={8} height={8} />
      </Group>
    )!
  )
  const filtered = compiled(
    directNodes(
      <Group>
        <RuntimeShader {...identity} />
        <Rect width={8} height={8} />
      </Group>
    )!
  )
  // A plain group writes no layer alpha at all; the filtered one is a layer.
  expect(filtered.words.length).toBeGreaterThan(plain.words.length)

  expect(() =>
    compiled(
      directNodes(
        <Group>
          <RuntimeShader {...identity} />
          <RuntimeShader {...identity} />
          <Rect width={8} height={8} />
        </Group>
      )!
    )
  ).toThrow('nest a <Group> per pass')
})

test('on a shape it joins the filter chain in declaration order', () => {
  const blurFirst = compiled(
    directNodes(
      <Rect width={8} height={8}>
        <Blur blur={4} />
        <RuntimeShader {...identity} />
      </Rect>
    )!
  )
  const shaderFirst = compiled(
    directNodes(
      <Rect width={8} height={8}>
        <RuntimeShader {...identity} />
        <Blur blur={4} />
      </Rect>
    )!
  )
  // Same two filters, composed the other way round: order is carried, not sorted.
  expect(blurFirst.words).not.toEqual(shaderFirst.words)
  expect(blurFirst.words.length).toBe(shaderFirst.words.length)
})
