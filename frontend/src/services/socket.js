import io from 'socket.io-client';

class SocketService {
  socket = null;
  connected = false;

    connect(token) {
    if (this.socket && this.connected) {
        console.log('Socket already connected');
        return this.socket;
    }

    if (this.socket) {
        this.socket.disconnect();
    }

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3600';
    
    this.socket = io(socketUrl, {
        auth: { token },
        transports: ['polling'], // Force polling only, skip WebSocket
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
        console.log('Connected to server via polling');
        this.connected = true;
    });

    this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
    });

    return this.socket;
    }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  on(event, callback) {
    if (this.socket) {
      // Remove existing listener for this event first
      this.socket.off(event);
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export default new SocketService();
