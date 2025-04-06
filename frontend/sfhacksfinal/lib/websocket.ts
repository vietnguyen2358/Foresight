// WebSocket service for real-time communication with the backend

let socket: WebSocket | null = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

// Event listeners for WebSocket events
const eventListeners: Record<string, Function[]> = {};

// Connect to WebSocket
export const connectWebSocket = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return;
  }

  // Determine WebSocket URL based on API_BASE_URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${apiUrl.replace(/^https?:\/\//, '')}/process_stream`;

  console.log(`Connecting to WebSocket at ${wsUrl}`);

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connection established');
      isConnected = true;
      reconnectAttempts = 0;
      notifyEventListeners('connected', { status: 'connected' });
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Notify listeners based on event type
        if (data.event && eventListeners[data.event]) {
          eventListeners[data.event].forEach(listener => listener(data));
        }
        
        // Always notify 'message' listeners
        if (eventListeners['message']) {
          eventListeners['message'].forEach(listener => listener(data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
      isConnected = false;
      notifyEventListeners('disconnected', { status: 'disconnected' });
      
      // Attempt to reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectWebSocket, RECONNECT_DELAY);
      } else {
        console.log('Max reconnection attempts reached');
        notifyEventListeners('error', { message: 'Max reconnection attempts reached' });
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      notifyEventListeners('error', { message: 'WebSocket connection error' });
    };
  } catch (error) {
    console.error('Error creating WebSocket:', error);
    notifyEventListeners('error', { message: 'Failed to create WebSocket connection' });
  }
};

// Disconnect WebSocket
export const disconnectWebSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
    isConnected = false;
    console.log('WebSocket disconnected');
  }
};

// Send message through WebSocket
export const sendWebSocketMessage = (message: any) => {
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
};

// Add event listener
export const addWebSocketEventListener = (event: string, callback: Function) => {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
  
  // Return a function to remove the listener
  return () => {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    }
  };
};

// Remove event listener
export const removeWebSocketEventListener = (event: string, callback: Function) => {
  if (eventListeners[event]) {
    eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
  }
};

// Check if WebSocket is connected
export const isWebSocketConnected = () => {
  return isConnected && socket && socket.readyState === WebSocket.OPEN;
};

// Notify all listeners for an event
const notifyEventListeners = (event: string, data: any) => {
  if (eventListeners[event]) {
    eventListeners[event].forEach(listener => listener(data));
  }
}; 