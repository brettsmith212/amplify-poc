import Terminal from './components/Terminal';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
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
      <main className="flex-1 flex flex-col p-6">
        <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden relative">
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
