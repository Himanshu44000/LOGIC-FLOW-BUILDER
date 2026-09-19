export async function runGeneratedJavaScript(code, timeoutMs = 5000) {
  const logs = []
  const origConsoleLog = console.log
  let isTimedOut = false

  console.log = (...args) => {
    if (isTimedOut) return
    try {
      logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    } catch (e) {
      logs.push(String(args))
    }
    try {
      origConsoleLog.apply(console, args)
    } catch (e) {
      /* ignore */
    }
  }

  try {
    const runner = new Function(`return (async () => { ${code} })()`)
    const executionPromise = runner()
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        isTimedOut = true
        reject(new Error(`Execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    const result = await Promise.race([executionPromise, timeoutPromise])
    return { logs, result, timedOut: false }
  } catch (error) {
    return { logs, error: error?.message ?? String(error), timedOut: isTimedOut }
  } finally {
    console.log = origConsoleLog
  }
}
