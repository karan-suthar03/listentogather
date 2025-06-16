import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {RoomStateService} from '../room-state.service';
import {SocketService} from '../socket.service';
import {RoomService} from '../room.service';
import {NotificationService} from '../notification.service';
import {Subscription} from 'rxjs';
import {SecureStorageService} from '../services/secure-storage.service';

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

  isLoading = true;
  loadingMessage = 'Loading room...';

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
    private socketService: SocketService,
    private roomService: RoomService,
    private notificationService: NotificationService
  ) {
  }  ngOnInit() {
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));

    setTimeout(() => {
      if (this.isLoading) {
        console.warn('Room loading timed out, redirecting to landing page');
        this.redirectToLandingWithError('Loading timed out. Please try again.');
      }
    }, 10000); 

    this.route.params.subscribe(params => {
      this.roomCode = params['roomCode'] || '';

      if (this.roomCode) {
        this.validateRoomExists(this.roomCode);
      } else {
        this.redirectToLandingWithError('Invalid room code');
      }
    });
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);

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
  }  private validateRoomExists(roomCode: string): void {
    this.isLoading = true;
    this.loadingMessage = 'Checking room...';
    
    const startTime = Date.now();
    const minLoadingTime = 500; 
    
    this.roomService.getRoomDetails(roomCode).subscribe({
      next: (response) => {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
        
        setTimeout(() => {
          if (response.success && response.data) {
            this.loadingMessage = 'Loading room...';
            this.proceedWithRoomAccess();
          } else {
            this.redirectToLandingWithError('Room not found or has ended');
          }
        }, remainingTime);
      },
      error: (error) => {
        console.error('Error checking room:', error);
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
        
        setTimeout(() => {
          if (error.status === 404) {
            this.redirectToLandingWithError('Room not found or has ended');
          } else {
            this.redirectToLandingWithError('Unable to connect to room. Please try again.');
          }
        }, remainingTime);
      }
    });
  }  private async proceedWithRoomAccess(): Promise<void> {
    this.loadingMessage = 'Checking user session...';
    console.log('🔍 Proceeding with room access for room:', this.roomCode);
    
    const currentUser = this.roomStateService.getUser();
    console.log('👤 Current user:', currentUser);
    
    if (this.roomCode && !currentUser) {
      console.log('📂 No current user, checking session...');
      const savedUserData = await this.checkLocalStorageForUser(this.roomCode);
      console.log('💾 Saved user data:', savedUserData);

      if (savedUserData) {
        console.log('✅ Restoring user session');
        this.loadingMessage = 'Restoring session...';
        this.roomStateService.setUser(savedUserData.user);
        if (savedUserData.room) {
          this.roomStateService.setRoom(savedUserData.room);
        }
        this.roomStateService.setInRoom(true);
        this.ensureSocketConnection();
        this.isLoading = false; 
        console.log('🎉 Room loaded successfully');
      } else {
        console.log('🚪 No saved data, redirecting to join page');
        this.isLoading = false; 
        this.router.navigate(['/join', this.roomCode]);
      }
    } else if (currentUser && this.roomCode) {
      console.log('🔌 User exists, connecting to room');
      this.loadingMessage = 'Connecting to room...';
      this.ensureSocketConnection();
      this.isLoading = false; 
      console.log('🎉 Room loaded successfully');
    } else {
      console.log('❌ Fallback: redirecting to join page');
      this.isLoading = false;
      this.router.navigate(['/join', this.roomCode]);
    }
  }
  private redirectToLandingWithError(message: string): void {
    this.isLoading = false;
    
    this.notificationService.error(message, 5000);
    
    this.router.navigate(['/']);
  }
  private async checkLocalStorageForUser(roomCode: string): Promise<any> {
    const sessionData = SecureStorageService.getUserSession();
    
    if (!sessionData || sessionData.roomCode !== roomCode) {
      return null;
    }

    try {
      const response = await this.roomService.getUserInfo(roomCode, sessionData.userId).toPromise();
      
      if (response.success && response.data) {
        return {
          user: response.data,
          roomCode: roomCode,
          timestamp: sessionData.timestamp
        };
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      SecureStorageService.clearUserSession();
    }
    
    return null;
  }

  private ensureSocketConnection(): void {
    const currentUser = this.roomStateService.getUser();
    if (currentUser && this.roomCode) {
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
