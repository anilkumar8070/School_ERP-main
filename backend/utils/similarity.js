const synonymGroups = [
  ['produce', 'produc', 'creat', 'make', 'generat', 'output'],
  ['image', 'imag', 'pictur', 'photo', 'graphic', 'draw'],
  ['copy', 'print', 'duplicat', 'reproduct'],
  ['device', 'devic', 'tool', 'machin', 'instrument'],
  ['information', 'informat', 'data', 'content', 'text'],
]

const synonymMap = {}
for (const group of synonymGroups) {
  const root = group[0]
  for (const val of group) {
    synonymMap[val] = root
  }
}

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\u00A0|\s+/g, ' ').replace(/[^a-z0-9 ]+/g, '').trim()
}

function levenshtein(a, b) {
  a = String(a || '')
  b = String(b || '')
  const al = a.length, bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al
  const row = Array(bl + 1).fill(0)
  for (let j = 0; j <= bl; j++) row[j] = j
  for (let i = 1; i <= al; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= bl; j++) {
      const tmp = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = tmp
    }
  }
  return row[bl]
}

function similarity(a, b) {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  const dist = levenshtein(na, nb)
  const maxL = Math.max(na.length, nb.length) || 1
  const sim = Math.max(0, 1 - dist / maxL)
  return sim
}

// simple tokenizer and stemmer for approximate semantic match
function tokenizeAndStem(s) {
  const stopwords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'and', 'or', 'in', 'on', 'that', 'from', 'by', 'for', 'with', 'as', 'it', 'this', 'these', 'those', 'which'])
  const toks = String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).map(t => t.trim()).filter(Boolean)
  const stem = t => {
    if (t.length <= 3) return t
    // crude stemming
    const stemmed = t.replace(/(ing|ed|ly|es|s)$/, '')
    return synonymMap[stemmed] || synonymMap[t] || stemmed
  }
  return toks.map(t => stem(t)).filter(t => !stopwords.has(t))
}

function jaccardSimilarity(a, b) {
  const ta = new Set(tokenizeAndStem(a))
  const tb = new Set(tokenizeAndStem(b))
  if (!ta.size && !tb.size) return 1
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const x of ta) if (tb.has(x)) inter++
  const uni = new Set([...ta, ...tb]).size
  return uni === 0 ? 0 : inter / uni
}

// enhanced similarity: combine character-based and word-based similarity
function enhancedSimilarity(a, b) {
  const charSim = similarity(a, b)
  const wordSim = jaccardSimilarity(a, b)
  // prefer wordSim for semantic equivalence but keep charSim as fallback
  return Math.max(charSim, Math.max(wordSim, 0.6 * charSim + 0.4 * wordSim))
}

module.exports = { normalizeText, levenshtein, similarity, jaccardSimilarity, enhancedSimilarity }
