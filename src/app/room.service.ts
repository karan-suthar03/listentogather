import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {JoinRoomResponse, RoomCreationResponse} from './models/room.model';
import {ConfigService} from './config.service';

@Injectable({providedIn: 'root'})
export class RoomService {

  constructor(private http: HttpClient, private configService: ConfigService) {
  }

  createRoom(userName: string): Observable<RoomCreationResponse> {
    return this.http.post<RoomCreationResponse>(this.configService.roomsApiUrl, {name: userName});
  }

  joinRoom(code: string, userName: string): Observable<JoinRoomResponse> {
    return this.http.post<JoinRoomResponse>(`${this.configService.roomsApiUrl}/join`, {code, name: userName});
  }
}
