import { useParams } from 'react-router-dom';
import Terminal from '../components/Terminal';

const TerminalPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

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
          <div className="text-xs text-gray-500">amplify@container:/workspace</div>
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
