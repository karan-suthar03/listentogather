import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {RoomStateService} from '../room-state.service';
import {SocketService} from '../socket.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit, OnDestroy {
  roomCode = '';
  userName = '';

  leftWidth = 20;
  centerWidth = 60;
  rightWidth = 20;

  private isResizing = false;
  private currentResizer: 'left' | 'right' | null = null;
  private startX = 0;
  private startLeftWidth = 0;
  private startCenterWidth = 0;
  private startRightWidth = 0;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private roomStateService: RoomStateService,
    private socketService: SocketService
  ) {
  }

  ngOnInit() {
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));    // Get room code from route
    this.route.params.subscribe(params => {
      this.roomCode = params['roomCode'] || '';

      // Check if we have room state
      this.subscriptions.push(
        this.roomStateService.getCurrentUser().subscribe(user => {
          if (this.roomCode && !user) {
            // Check localStorage for existing user data
            const savedUserData = this.checkLocalStorageForUser(this.roomCode);            if (savedUserData) {
              // Restore user session
              this.roomStateService.setUser(savedUserData.user);
              if (savedUserData.room) {
                this.roomStateService.setRoom(savedUserData.room);
              }
              this.roomStateService.setInRoom(true);
              this.ensureSocketConnection();
            } else {
              // No user state, redirect to join page
              this.router.navigate(['/join', this.roomCode]);
            }
          } else if (user && this.roomCode) {
            // We have both room code and user, ensure socket connection
            this.ensureSocketConnection();
          }
        })
      );
    });
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);

    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  startResize(event: MouseEvent, resizer: 'left' | 'right') {
    this.isResizing = true;
    this.currentResizer = resizer;
    this.startX = event.clientX;
    this.startLeftWidth = this.leftWidth;
    this.startCenterWidth = this.centerWidth;
    this.startRightWidth = this.rightWidth;

    event.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }
  @HostListener('window:resize')
  onWindowResize() {
  }

  returnToLanding() {
    this.router.navigate(['/']);
  }

  private checkLocalStorageForUser(roomCode: string): any {
    try {
      const savedUserData = localStorage.getItem('listentogether_user');
      if (savedUserData) {
        const userData = JSON.parse(savedUserData);
        const isDataValid = userData && 
                           userData.roomCode === roomCode && 
                           userData.timestamp && 
                           (Date.now() - userData.timestamp) < 24 * 60 * 60 * 1000; // 24 hours
        
        if (isDataValid) {
          return userData;
        } else {
          localStorage.removeItem('listentogether_user');
        }
      }
    } catch (error) {
      console.error('Error reading localStorage:', error);
      localStorage.removeItem('listentogether_user');
    }
    return null;
  }

  private ensureSocketConnection(): void {
    const currentUser = this.roomStateService.getUser();
    if (currentUser && this.roomCode) {
      // Make sure socket is connected and user is joined to the room
      this.socketService.joinRoom(this.roomCode, currentUser);
      this.socketService.getParticipants(this.roomCode);
    }
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isResizing || !this.currentResizer) return;

    const containerWidth = window.innerWidth;
    const deltaX = event.clientX - this.startX;
    const deltaPercent = (deltaX / containerWidth) * 100;

    if (this.currentResizer === 'left') {
      let newLeftWidth = this.startLeftWidth + deltaPercent;
      let newCenterWidth = this.startCenterWidth - deltaPercent;

      newLeftWidth = Math.max(15, Math.min(25, newLeftWidth));
      newCenterWidth = Math.max(30, Math.min(65, newCenterWidth));

      const adjustment = (this.startLeftWidth + this.startCenterWidth) - (newLeftWidth + newCenterWidth);
      newCenterWidth += adjustment;

      this.leftWidth = newLeftWidth;
      this.centerWidth = newCenterWidth;

    } else if (this.currentResizer === 'right') {
      let newCenterWidth = this.startCenterWidth + deltaPercent;
      let newRightWidth = this.startRightWidth - deltaPercent;

      newCenterWidth = Math.max(30, Math.min(65, newCenterWidth));
      newRightWidth = Math.max(15, Math.min(25, newRightWidth));

      const adjustment = (this.startCenterWidth + this.startRightWidth) - (newCenterWidth + newRightWidth);
      newCenterWidth += adjustment;

      this.centerWidth = newCenterWidth;
      this.rightWidth = newRightWidth;
    }
  }

  private onMouseUp() {
    this.isResizing = false;
    this.currentResizer = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
}
