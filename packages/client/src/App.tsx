import React, { useState, useEffect } from 'react';
import { Home } from './components/Home.js';
import { CallRoom } from './components/CallRoom.js';

export function App() {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Guest');
  const [password, setPassword] = useState<string | undefined>();
  const [keyFromUrl, setKeyFromUrl] = useState<string | undefined>();
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [requiresApproval, setRequiresApproval] = useState<boolean>(false);
  const [dataSaver, setDataSaver] = useState<boolean>(false);

  // Check URL query parameters and hash on load
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const roomParam = searchParams.get('room');

    let keyParam: string | undefined;
    if (window.location.hash.includes('key=')) {
      keyParam = window.location.hash.split('key=')[1]?.split('&')[0];
    }

    if (roomParam) {
      setActiveRoomId(roomParam);
      if (keyParam) {
        setKeyFromUrl(keyParam);
      }
    }
  }, []);

  const handleJoinRoom = (params: {
    roomId: string;
    userName: string;
    password?: string;
    keyFromUrl?: string;
    isCreating?: boolean;
    requiresApproval?: boolean;
    dataSaver?: boolean;
  }) => {
    setActiveRoomId(params.roomId);
    setUserName(params.userName);
    setPassword(params.password);
    setKeyFromUrl(params.keyFromUrl);
    setIsCreating(Boolean(params.isCreating));
    setRequiresApproval(Boolean(params.requiresApproval));
    setDataSaver(Boolean(params.dataSaver));

    // Update browser URL without reloading
    const hash = params.keyFromUrl ? `#key=${encodeURIComponent(params.keyFromUrl)}` : '';
    window.history.pushState(
      {},
      '',
      `/?room=${encodeURIComponent(params.roomId)}${hash}`
    );
  };

  const handleLeaveCall = () => {
    setActiveRoomId(null);
    window.history.pushState({}, '', '/');
  };

  if (activeRoomId) {
    return (
      <CallRoom
        roomId={activeRoomId}
        userName={userName}
        password={password}
        keyFromUrl={keyFromUrl}
        isCreating={isCreating}
        requiresApproval={requiresApproval}
        dataSaver={dataSaver}
        onLeave={handleLeaveCall}
      />
    );
  }

  return <Home onJoinRoom={handleJoinRoom} />;
}

export default App;
