const { normalizeText, levenshtein, similarity } = require('../utils/similarity')

describe('similarity utils', () => {
  test('normalizeText removes punctuation and lowercases', () => {
    expect(normalizeText('Washington, D.C.')).toBe('washington dc')
    expect(normalizeText('  New\u00A0Delhi ')).toBe('new delhi')
  })

  test('levenshtein distance basic', () => {
    expect(levenshtein('cat', 'cut')).toBe(1)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', 'abc')).toBe(0)
  })

  test('similarity returns 1 for identical (case/punct insensitive)', () => {
    expect(similarity('WASHINGTON DC', 'Washington DC')).toBeCloseTo(1, 5)
  })

  test('word-level jaccard and enhanced similarity for paraphrases', () => {
    const { jaccardSimilarity, enhancedSimilarity } = require('../utils/similarity')
    const a = 'A printer is an output device that produces text or images on paper from a computer.'
    const b = 'A printer is a device that takes information from a computer and creates a physical copy of text or pictures on paper.'
    const jw = jaccardSimilarity(a, b)
    expect(jw).toBeGreaterThan(0.2)
    const enh = enhancedSimilarity(a, b)
    expect(enh).toBeGreaterThanOrEqual(0.7)
  })

  test('similarity between different strings is between 0 and 1', () => {
    const s = similarity('New Delhi', 'Delhi')
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(1)
  })
})
