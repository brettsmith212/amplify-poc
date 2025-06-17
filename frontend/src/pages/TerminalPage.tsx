import { useParams, useNavigate } from 'react-router-dom';
import Terminal from '../components/Terminal';

const TerminalPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const handleViewDiff = () => {
    if (sessionId) {
      navigate(`/diff/${sessionId}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
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
            {sessionId && (
              <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                Session: {sessionId}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-xs text-gray-500">amplify@container:/workspace</div>
            <button
              onClick={handleViewDiff}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-600/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Diff
            </button>
          </div>
        </div>
        
        {/* Terminal Content */}
        <div className="h-full bg-gray-900">
          <Terminal 
            className="h-full w-full"
            {...(sessionId && { sessionId })}
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
    </div>
  );
};

export default TerminalPage;
