import React, { createContext, useContext, useState, ReactNode } from 'react';

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: string | null;
  sendMessage: (message: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  url: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [isConnected] = useState(false);
  const [lastMessage] = useState<string | null>(null);

  const sendMessage = (message: string) => {
    console.warn('WebSocket disabled. Message not sent:', message);
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};