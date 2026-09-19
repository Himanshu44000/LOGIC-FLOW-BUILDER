import { useNavigate } from 'react-router-dom'
import { BookOpen, ArrowLeft } from 'lucide-react'

export default function GuidePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 px-4 py-8 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="mb-6 flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
          >
            <ArrowLeft size={16} /> Back to Home
          </button>

          <div className="flex items-center gap-3 mb-4">
            <BookOpen size={40} className="text-cyan-600" />
            <h1 className="text-4xl font-bold">Logic Flow Builder Guide</h1>
          </div>

          {/* Section: Debugging & Breakpoints */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-6 text-2xl font-bold text-cyan-600">🛠 Debugging & Breakpoints</h2>

            <p className="mb-4 text-slate-600 dark:text-slate-400">Use the built-in debugger to pause execution, inspect variables, and step through nodes.</p>

            <ol className="space-y-3">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">1</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Set a breakpoint</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Click the small dot on any node to toggle a breakpoint (red = active).</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">2</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Run or Debug Run</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Click <strong>Run</strong> to execute normally or <strong>Debug Run</strong> to pause at the first node.</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">3</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Control execution</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Use <strong>Pause</strong>, <strong>Step</strong>, and <strong>Continue</strong> from the toolbar while paused.</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">4</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Inspect variables</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Open the Variable Watch panel to view live snapshots emitted by the engine at each node boundary.</p>
                </div>
              </li>
            </ol>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700">
              <p className="text-sm text-yellow-900 dark:text-yellow-200">Note: Breakpoints are stored in-memory until you save the flow. Long-running API nodes pause only at the next node boundary.</p>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400">Learn how to build flows step by step</p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Section 1: How to Connect Nodes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-6 text-2xl font-bold text-cyan-600">📌 How to Connect 2 Nodes</h2>
            <p className="mb-6 text-slate-600 dark:text-slate-400">Follow these simple steps to connect nodes together:</p>

            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold">1</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Move your mouse to the right side of the first node</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">You'll see a colored dot there (this is the output connection point)</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold">2</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Click and hold down the mouse button on that dot</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Don't release yet! Keep holding...</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold">3</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Drag the mouse to the next node (on the left side)</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">You'll see a line following your mouse as you drag</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold">4</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Drop on the left side dot of the target node</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Release the mouse button. A solid line should now connect the two nodes!</p>
                </div>
              </li>
            </ol>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/30 dark:border-blue-700">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                💡 <strong>Tip:</strong> The dots are now bigger and easier to see! If connection fails, try again - the line must clearly connect the two dots.
              </p>
            </div>
          </div>

          {/* Section 2: What Each Node Does */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-6 text-2xl font-bold text-cyan-600">🎯 What Each Node Does</h2>
            
            <div className="space-y-4">
              <div className="border-l-4 border-teal-500 pl-4">
                <p className="font-bold text-teal-600 dark:text-teal-300">🔵 START Node</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">This is where your flow begins. Every flow must have exactly ONE Start node.</p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <p className="font-bold text-blue-600 dark:text-blue-300">📥 INPUT Node</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Creates a variable/value that you can use later. Example: Create "age = 25" that other nodes can use.</p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <p className="font-bold text-orange-600 dark:text-orange-300">🔢 MATH Node</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Does calculations. Example: Add two numbers, multiply values, etc.</p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <p className="font-bold text-purple-600 dark:text-purple-300">🔀 CONDITION Node</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Makes decisions (yes/no). Example: "Is age more than 18?" Then does different things based on TRUE or FALSE.</p>
              </div>

              <div className="border-l-4 border-red-500 pl-4">
                <p className="font-bold text-red-600 dark:text-red-300">⏱️ DELAY Node</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pauses the flow for a few seconds. Example: Wait 1 second before moving to the next node.</p>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4">
                <p className="font-bold text-indigo-600 dark:text-indigo-300">🌐 API NODE</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Calls an external website or service to fetch data. Example: Get weather data from the internet.</p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <p className="font-bold text-green-600 dark:text-green-300">📤 OUTPUT Node</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Shows the final result. This is where you see what happened in your flow.</p>
              </div>

              <div className="border-l-4 border-slate-500 pl-4">
                <p className="font-bold text-slate-600 dark:text-slate-300">⏹️ END Node</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">This is where your flow finishes. Every flow must have at least ONE End node.</p>
              </div>
            </div>
          </div>

          {/* Section 3: How to Run a Flow */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-6 text-2xl font-bold text-cyan-600">▶️ How to Run Your Flow</h2>

            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">1</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Build your flow by connecting nodes</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Use the steps above to connect Start → Other Nodes → End</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">2</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Fill in the values for each node</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Click on a node on the right panel and enter what that node should do</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">3</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Click the green "Run" button</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Your flow will start executing</p>
                </div>
              </li>

              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">4</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Watch the results</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Nodes will highlight as they execute. See results in the right panel.</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Section 4: Quick Tips */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-6 text-2xl font-bold text-cyan-600">✨ Quick Tips</h2>

            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-lg">✅</span>
                <p className="text-slate-600 dark:text-slate-400">Always start with <strong>Start</strong> node and end with <strong>End</strong> node</p>
              </li>
              <li className="flex gap-3">
                <span className="text-lg">✅</span>
                <p className="text-slate-600 dark:text-slate-400">The new bigger dots make connections much easier!</p>
              </li>
              <li className="flex gap-3">
                <span className="text-lg">✅</span>
                <p className="text-slate-600 dark:text-slate-400">If a Condition node is used, it needs TWO outputs (TRUE and FALSE paths)</p>
              </li>
              <li className="flex gap-3">
                <span className="text-lg">✅</span>
                <p className="text-slate-600 dark:text-slate-400">Use the Speed slider to slow down execution and watch your flow work step by step</p>
              </li>
              <li className="flex gap-3">
                <span className="text-lg">✅</span>
                <p className="text-slate-600 dark:text-slate-400">Use Save button to save your flow so you can edit it later</p>
              </li>
            </ul>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <button
              onClick={() => navigate('/builder/new')}
              className="inline-block bg-cyan-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-cyan-700 transition"
            >
              Create Your First Flow Now →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
