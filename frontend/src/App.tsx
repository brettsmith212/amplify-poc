function App() {
  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-fg">
      <div className="container mx-auto p-4">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-center">
            Amplify Terminal
          </h1>
          <p className="text-center text-gray-400 mt-2">
            Docker container with amp CLI - Browser Terminal Interface
          </p>
        </header>
        
        <main className="bg-gray-900 rounded-lg p-6 min-h-96">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🚧</div>
            <h2 className="text-xl mb-2">Terminal Component Coming Soon</h2>
            <p className="text-gray-400">
              This will be implemented in Step 6 of the implementation plan
            </p>
          </div>
        </main>
        
        <footer className="mt-6 text-center text-gray-500 text-sm">
          <p>Amplify POC v0.1.0</p>
        </footer>
      </div>
    </div>
  )
}

export default App
