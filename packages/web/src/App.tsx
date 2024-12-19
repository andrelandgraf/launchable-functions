import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Form from '@rjsf/antd';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Button } from '@/components/ui/button';
import type { GetLaunchableItemsRes, WsClientPayload, WsServerPayload } from '../types';
import { ErrorCard } from '@/components/error-card';
import { Alert } from '@/components/ui/alert';

function isWsPayload(data: unknown): data is WsServerPayload {
  const isResultObject = !!data && typeof data === 'object' && 'status' in data;
  if (!isResultObject) return false;
  if (data.status === 'print') {
    return 'content' in data;
  }
  if (data.status === 'prompt') {
    return 'jsonSchema' in data;
  }
  if (data.status === 'launched') {
    return 'taskId' in data;
  }
  if (data.status === 'success') {
    return 'result' in data;
  }
  if (data.status === 'error') {
    return 'message' in data;
  }
  return false;
}

function sendWsMessage(ws: WebSocket, data: WsClientPayload) {
  ws.send(JSON.stringify(data));
}

type LaunchableItem = GetLaunchableItemsRes['launchableItems'][number];

async function fetchFunctions(): Promise<GetLaunchableItemsRes> {
  const res = await fetch('/api/functions');
  return res.json();
}

export default function Dashboard() {
  const wsRef = useRef<WebSocket | null>(null);
  const [step, setStep] = useState<'idle' | 'pending' | 'error' | 'success' | 'awaiting submission'>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [launchInfo, setLaunchInfo] = useState<string | null>(null);
  const [resultData, setResultData] = useState<unknown | null>(null);
  const [launchErrors, setLaunchErrors] = useState<string[]>([]);
  const [schema, setSchema] = useState<RJSFSchema>(null);
  const [executingFn, setExecutingFn] = useState<LaunchableItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    isPending,
    error,
    data: functionData,
  } = useQuery({
    queryKey: ['functions'],
    queryFn: fetchFunctions,
  });

  useEffect(() => {
    if (executingFn) {
      const webSocket = new WebSocket(`ws://localhost:3000/ws`);

      webSocket.onopen = () => {
        if (!executingFn.schema) {
          sendWsMessage(webSocket, { intent: 'launch', fnName: executingFn.name, promptData: null });
        }
        wsRef.current = webSocket;
      };

      webSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (isWsPayload(data)) {
          if (data.status === 'print') {
            console.log(data.content);
            setLaunchInfo(data.content);
          } else if (data.status === 'prompt') {
            console.log('Prompting for input...');
            setSchema(data.jsonSchema);
            setStep('awaiting submission');
          } else if (data.status === 'launched') {
            console.log('Function launched:', data.taskId);
            setStep('pending');
            setTaskId(data.taskId);
          } else if (data.status === 'success') {
            console.log('Function completed:', data.result);
            setResultData(JSON.stringify(data.result, undefined, 2));
            setStep('success');
          } else if (data.status === 'error') {
            console.error('Function error:', data.message);
            setLaunchErrors([data.message]);
            setStep('error');
          }
        }
      };

      webSocket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        wsRef.current = null;
        setTaskId(null);
        setStep('idle');
        setExecutingFn(null);
        setLaunchErrors([]);
        setLaunchInfo(null);
        setResultData(null);
      };
    }
  }, [executingFn]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  if (isPending || !functionData) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-gray-800 text-white w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out`}
      >
        <nav>
          {functionData.launchableItems.map((item) => {
            return (
              <button
                onClick={() => setExecutingFn(item)}
                disabled={!!executingFn}
                key={item.name}
                className="flex items-center space-x-2 px-4 py-3 hover:bg-gray-700 rounded"
              >
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <header className="bg-white shadow-sm z-10">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">Add Attendee</h1>
            <Button variant="outline" size="sm" className="md:hidden" onClick={toggleSidebar}>
              Menu
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <div className="bg-white shadow rounded-lg p-6 flex flex-col gap-4">
                Status: {step}
                {launchInfo && (
                  <Alert variant="default" title="Function Output">
                    <p>{launchInfo}</p>
                  </Alert>
                )}
                {step === 'awaiting submission' && schema && (
                  <Form
                    schema={schema}
                    validator={validator}
                    onSubmit={(data) => {
                      if (!wsRef.current) {
                        console.error('WebSocket connection not established');
                        setLaunchErrors(['WebSocket connection not established']);
                        return;
                      }
                      if (!taskId) {
                        console.error('Task ID not found');
                        setLaunchErrors(['Task ID not found']);
                        return;
                      }
                      sendWsMessage(wsRef.current, { intent: 'submit', promptData: data.formData, taskId });
                      setStep('pending');
                    }}
                    onError={(errors) => {
                      setLaunchErrors(errors.map((error) => error.message || 'Unknown error'));
                    }}
                  />
                )}
              </div>
              {!!launchErrors.length && <ErrorCard errors={launchErrors} />}
              {!!resultData && (
                <pre className="mt-6 bg-white shadow rounded-lg p-6">{JSON.stringify(resultData, undefined, 2)}</pre>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
