import { useEffect, type MutableRefObject } from 'react';
import { Client } from '@stomp/stompjs';
import { tokenStorage } from '../../auth/utils/TokenStorage';
import { env } from '../../../utils/env';
import { attachBoardStompSubscriptions } from '../board-sync/stompBoardHandlers';

export function useBoardStomp(
  boardId: string,
  userId: string | undefined,
  stompClientRef: MutableRefObject<Client | null>,
) {
  useEffect(() => {
    const client = new Client({
      brokerURL: env.VITE_BROKER_URL,
      reconnectDelay: 3000,
      connectHeaders: {
        Authorization: `Bearer ${tokenStorage.get()}`,
      },

      onConnect: () => {
        console.log('connected');
        attachBoardStompSubscriptions(client, boardId, userId);
      },

      onWebSocketError: (error) => console.error('WebSocket error', error),
      onDisconnect: () => console.log('disconnected'),
      onStompError: (frame) => {
        console.error('STOMP error', frame);
        console.log('error code', frame.headers['message-type']);
        console.log('error body', frame.body);
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [boardId, userId]);
}
