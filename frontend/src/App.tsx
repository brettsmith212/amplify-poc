function App() {
  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-fg flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="ml-4 text-sm font-medium">Amplify Terminal</span>
          </div>
          <div className="text-sm text-gray-400">
            Docker container with amp CLI
          </div>
        </div>
      </header>
      
      {/* Main Terminal Area */}
      <main className="flex-1 bg-terminal-bg p-6">
        <div className="bg-gray-900 rounded-lg border border-gray-700 h-full min-h-96 terminal-container">
          {/* Terminal Header */}
          <div className="bg-gray-800 px-4 py-2 rounded-t-lg border-b border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Terminal</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
              </div>
            </div>
          </div>
          
          {/* Terminal Content */}
          <div className="p-6 h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">🚧</div>
              <h2 className="text-xl mb-2 text-gray-300">Terminal Component Coming Soon</h2>
              <p className="text-gray-500 mb-4">
                This will be implemented in Step 6 of the implementation plan
              </p>
              <div className="bg-gray-800 rounded-lg p-4 text-left font-mono text-sm">
                <div className="text-green-400">$ amp --version</div>
                <div className="text-gray-400 mt-1">0.0.1749859306-g627062</div>
                <div className="text-green-400 mt-2">$ echo "Ready for WebSocket terminal!"</div>
                <div className="text-gray-400 mt-1">Ready for WebSocket terminal!</div>
                <div className="text-green-400 mt-2 flex items-center">
                  <span>$ </span>
                  <div className="w-2 h-4 bg-green-400 ml-1 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Status Bar */}
      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-gray-400">Status:</span>
            <span className="text-yellow-400">⚡ Server Running</span>
          </div>
          <div className="text-gray-500">
            Amplify POC v0.1.0
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
