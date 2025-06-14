import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SocketService } from './socket.service';

export interface WorkingState {
  isWorking: boolean;
  workingMessage: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkingStateService {
  private workingStateSubject = new BehaviorSubject<WorkingState>({
    isWorking: false,
    workingMessage: ''
  });

  public workingState$ = this.workingStateSubject.asObservable();

  constructor(private socketService: SocketService) {
    this.setupSocketListeners();
  }  private setupSocketListeners(): void {
    // Listen for room working state changes
    this.socketService.onRoomWorkingStateChanged().subscribe((data) => {
      this.updateWorkingState(data.isWorking, data.workingMessage);
    });
  }

  updateWorkingState(isWorking: boolean, workingMessage: string): void {
    this.workingStateSubject.next({
      isWorking,
      workingMessage
    });
  }

  getCurrentWorkingState(): WorkingState {
    return this.workingStateSubject.value;
  }

  setLocalWorking(isWorking: boolean, message: string = ''): void {
    this.updateWorkingState(isWorking, message);
  }
}
