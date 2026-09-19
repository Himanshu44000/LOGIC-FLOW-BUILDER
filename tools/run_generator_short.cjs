const fs = require('fs')
const vm = require('vm')

const flow = JSON.parse(fs.readFileSync('flow.json', 'utf8'))
let src = fs.readFileSync('src/utils/codeGenerator.js', 'utf8')
src = src.replace(/export\s+const\s+/g, 'const ')
src = src.replace(/export\s+function\s+/g, 'function ')
src = src.replace(/export\s+default\s+/g, '')
src = src.replace(/export\s+\{[^}]+\};?/g, '')

const script = new vm.Script(src + '\n;module.exports = { generateCodeFromFlow, CODE_LANGUAGE_OPTIONS }')
const context = vm.createContext({ module: {}, console, require })
script.runInContext(context)
const mod = context.module.exports

const languages = ['javascript','typescript','python','java','cpp']
const results = {}
for (const lang of languages) {
  try {
    const out = mod.generateCodeFromFlow(flow.nodes, flow.edges, lang, flow.name)
    const lines = out.code.split('\n').slice(0, 60)
    results[lang] = { firstLines: lines, warnings: out.warnings }
  } catch (err) {
    results[lang] = { error: String(err) }
  }
}

fs.writeFileSync('generated_outputs_short.json', JSON.stringify(results, null, 2), 'utf8')
console.log('Wrote generated_outputs_short.json')
