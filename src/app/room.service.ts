import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RoomCreationResponse, JoinRoomResponse } from './models/room.model';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private apiUrl = 'http://localhost:3000/api/rooms';

  constructor(private http: HttpClient) {}

  createRoom(userName: string): Observable<RoomCreationResponse> {
    return this.http.post<RoomCreationResponse>(this.apiUrl, { name: userName });
  }

  joinRoom(code: string, userName: string): Observable<JoinRoomResponse> {
    return this.http.post<JoinRoomResponse>(`${this.apiUrl}/join`, { code, name: userName });
  }
}
