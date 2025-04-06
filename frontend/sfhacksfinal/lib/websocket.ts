// WebSocket service for real-time communication with the backend

import { API_BASE_URL } from './api';

// WebSocket connection state
let socket: WebSocket | null = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

// Event listeners
const eventListeners: Record<string, ((data: any) => void)[]> = {};

// Connect to WebSocket
export function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log('WebSocket already connected or connecting');
    return;
  }

  // Determine WebSocket protocol based on the API URL
  const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = API_BASE_URL.replace(/^http(s)?:\/\//, `${wsProtocol}://`) + '/process_stream';
  
  console.log(`Connecting to WebSocket at ${wsUrl}`);
  
  try {
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connection established');
      isConnected = true;
      reconnectAttempts = 0;
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Call all listeners for this event type
        if (data.event && eventListeners[data.event]) {
          eventListeners[data.event].forEach(listener => listener(data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      isConnected = false;
      
      // Attempt to reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectWebSocket, RECONNECT_DELAY);
      } else {
        console.error('Max reconnection attempts reached');
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  } catch (error) {
    console.error('Error creating WebSocket connection:', error);
  }
}

// Disconnect WebSocket
export function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
    isConnected = false;
  }
}

// Send message through WebSocket
export function sendWebSocketMessage(message: any) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket is not connected');
    return false;
  }
  
  try {
    const messageString = typeof message === 'string' ? message : JSON.stringify(message);
    socket.send(messageString);
    return true;
  } catch (error) {
    console.error('Error sending WebSocket message:', error);
    return false;
  }
}

// Add event listener
export function addWebSocketEventListener(event: string, callback: (data: any) => void) {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
  
  // Return a function to remove this listener
  return () => {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    }
  };
}

// Check if WebSocket is connected
export function isWebSocketConnected() {
  return isConnected;
} 