import Terminal from './components/Terminal';

function App() {
  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur border-b border-gray-700/50 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-lg"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg"></div>
            </div>
            <div className="h-6 w-px bg-gray-600"></div>
            <div>
              <h1 className="text-lg font-semibold text-white">Amplify Terminal</h1>
              <p className="text-xs text-gray-400">Docker container with amp CLI</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Connected</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Terminal Area */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        <div className="flex-1 bg-gray-900 rounded-xl border border-gray-700/50 overflow-hidden relative shadow-2xl">
          {/* Terminal Window Header */}
          <div className="bg-gray-800/60 border-b border-gray-700/50 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <span className="text-sm text-gray-400 font-medium">terminal</span>
            </div>
            <div className="text-xs text-gray-500">amplify@container:/workspace</div>
          </div>
          
          {/* Terminal Content */}
          <div className="h-full bg-gray-900">
            <Terminal 
              className="h-full w-full"
              onReady={(terminal) => {
                console.log('Terminal ready:', terminal);
              }}
              onData={(data) => {
                console.log('Terminal input:', data);
              }}
              onResize={(dimensions) => {
                console.log('Terminal resized:', dimensions);
              }}
            />
          </div>
        </div>
      </main>
      
      {/* Status Bar */}
      <footer className="bg-gray-800/60 backdrop-blur border-t border-gray-700/50 px-6 py-3 shadow-lg">
        <div className="flex items-center justify-between text-sm max-w-7xl mx-auto">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Status:</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium">Server Running</span>
              </div>
            </div>
            <div className="h-4 w-px bg-gray-600"></div>
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Docker container active</span>
            </div>
          </div>
          <div className="text-gray-500 font-mono text-xs">
            Amplify POC v0.1.0
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
