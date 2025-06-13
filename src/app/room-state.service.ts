import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Room, User } from './models/room.model';

@Injectable({
  providedIn: 'root'
})
export class RoomStateService {
  private currentRoom = new BehaviorSubject<Room | null>(null);
  private currentUser = new BehaviorSubject<User | null>(null);
  private isInRoom = new BehaviorSubject<boolean>(false);

  // Observables
  getCurrentRoom(): Observable<Room | null> {
    return this.currentRoom.asObservable();
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  getIsInRoom(): Observable<boolean> {
    return this.isInRoom.asObservable();
  }

  // Setters
  setRoom(room: Room | null): void {
    this.currentRoom.next(room);
  }

  setUser(user: User | null): void {
    this.currentUser.next(user);
  }

  setInRoom(inRoom: boolean): void {
    this.isInRoom.next(inRoom);
  }

  // Getters (synchronous)
  getRoomCode(): string {
    return this.currentRoom.value?.code || '';
  }

  getUser(): User | null {
    return this.currentUser.value;
  }

  isHost(): boolean {
    return this.currentUser.value?.isHost || false;
  }

  // Clear state
  clearState(): void {
    this.currentRoom.next(null);
    this.currentUser.next(null);
    this.isInRoom.next(false);
  }
}
