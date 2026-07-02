import { Injectable } from '@nestjs/common';

/**
 * Rejestr obecności w pamięci: userId → zbiór aktywnych socketów (multi-device).
 * „Online" = ≥1 socket. Broadcast/persist lastSeenAt robi gateway; tu jest sam stan.
 *
 * OGRANICZENIE: pamięć procesu = pojedyncza instancja. Skalowanie poziome wymaga
 * adaptera Redis (socket.io) + współdzielonego stanu presence. // FUTURE: Redis adapter.
 */
@Injectable()
export class PresenceService {
  private readonly sockets = new Map<string, Set<string>>();

  /** Rejestruje socket; zwraca true, jeśli użytkownik właśnie stał się online (pierwszy socket). */
  connect(userId: string, socketId: string): boolean {
    let set = this.sockets.get(userId);
    const wasOffline = !set || set.size === 0;
    if (!set) {
      set = new Set();
      this.sockets.set(userId, set);
    }
    set.add(socketId);
    return wasOffline;
  }

  /** Wyrejestrowuje socket; zwraca true, jeśli użytkownik właśnie zszedł offline (ostatni socket). */
  disconnect(userId: string, socketId: string): boolean {
    const set = this.sockets.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.sockets.delete(userId);
      return true;
    }
    return false;
  }

  isOnline(userId: string): boolean {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }

  /** Zbiór online spośród podanych userId (do budowy DTO listy rozmów/kontaktów). */
  onlineAmong(userIds: Iterable<string>): Set<string> {
    const out = new Set<string>();
    for (const id of userIds) if (this.isOnline(id)) out.add(id);
    return out;
  }
}
