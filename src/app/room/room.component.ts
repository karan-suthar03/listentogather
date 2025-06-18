import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {RoomStateService} from '../room-state.service';
import {SocketService} from '../socket.service';
import {RoomService} from '../room.service';
import {NotificationService} from '../notification.service';
import {MusicService} from '../music.service';
import {QueueItem, QueueService} from '../queue.service';
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
  mobileTab: 'search' | 'queue' | 'room' = 'search';
  desktopTab: 'search' | 'room' = 'search';
  queueCount = 0;
  isMobile = false;
  isTablet = false;
  isDesktop = false;
  queueItems: QueueItem[] = [];
  currentTrackIndex: number = -1;
  currentlyPlayingId?: number | string;

  isLoading = true;
  loadingMessage = 'Loading room...';

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private roomStateService: RoomStateService,
    private socketService: SocketService,
    private roomService: RoomService,
    private notificationService: NotificationService,
    private musicService: MusicService,
    private queueService: QueueService
  ) {
  }

  ngOnInit() {
    this.checkScreenSize();

    const queueSub = this.queueService.queue$.subscribe(queueData => {
      this.queueCount = queueData.queue.length;
      this.queueItems = queueData.queue;
      this.currentTrackIndex = queueData.currentTrackIndex;

      if (queueData.currentTrackIndex >= 0 && queueData.queue[queueData.currentTrackIndex]) {
        const currentTrack = queueData.queue[queueData.currentTrackIndex];
        this.currentlyPlayingId = currentTrack.id;
      } else {
        this.currentlyPlayingId = undefined;
      }
    });
    this.subscriptions.push(queueSub);

    this.setupRoomDeletionListeners();

    this.setupHttpErrorHandling();

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
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  returnToLanding() {
    this.router.navigate(['/']);
  }

  onMobileTabChange(tab: 'search' | 'queue' | 'room') {
    this.mobileTab = tab;
  }

  onDesktopTabChange(tab: 'search' | 'queue' | 'room') {
    if (tab === 'search' || tab === 'room') {
      this.desktopTab = tab;
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any) {
    this.checkScreenSize();
  }

  onRemoveFromQueue(id: number | string) {
    const index = this.queueItems.findIndex(item =>
      String(item.id) === String(id)
    );

    if (index >= 0 && this.roomCode) {
      this.queueService.removeFromQueue(this.roomCode, index).subscribe({
        next: (response) => {
          console.log('Successfully removed from queue');
        },
        error: (error) => {
          console.error('Error removing from queue:', error);
        }
      });
    }
  }

  onPlayNext(item: any) {
    const index = this.queueItems.findIndex(queueItem =>
      String(queueItem.id) === String(item.id)
    );

    if (index >= 0 && this.roomCode) {
      const user = this.roomStateService.getUser();
      if (user && item.downloadStatus === 'completed') {
        this.socketService.playTrackAtIndex(this.roomCode, user.id, index);
      }
    }
  }

  private validateRoomExists(roomCode: string): void {
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
  }

  private async proceedWithRoomAccess(): Promise<void> {
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

      this.loadQueue();

      console.log('🎵 Requesting immediate music sync after joining room...');
      this.socketService.requestSync(this.roomCode);

      setTimeout(() => {
        console.log('🎵 Requesting backup music sync...');
        this.socketService.requestSync(this.roomCode);
      }, 1000);
    }
  }

  private setupRoomDeletionListeners(): void {
    const roomDeletedSub = this.socketService.onRoomDeleted().subscribe((data) => {
      console.log('🗑️ Room deleted:', data);
      this.handleRoomDeleted(data.message || 'Room has been deleted');
    });
    this.subscriptions.push(roomDeletedSub);

    const forceDisconnectSub = this.socketService.onForceDisconnect().subscribe((data) => {
      console.log('🚪 Force disconnect:', data);
      this.handleRoomDeleted(data.message || 'You have been disconnected from the room');
    });
    this.subscriptions.push(forceDisconnectSub);
    const errorSub = this.socketService.onError().subscribe((error) => {
      console.log('❌ Socket error:', error);
      if (error.message.includes('Room not found') || error.message.includes('room not found')) {
        this.handleRoomDeleted('Room not found or has been deleted');
      } else if (error.message.includes('User not in room')) {
        this.router.navigate(['/']);
      }
    });
    this.subscriptions.push(errorSub);

    const disconnectSub = this.socketService.onSocketDisconnect().subscribe((reason: string) => {
      console.log('🔌 Socket disconnected:', reason);
      if (this.roomCode && !this.isLoading) {
        setTimeout(() => {
          this.validateRoomStillExists();
        }, 1000);
      }
    });
    this.subscriptions.push(disconnectSub);
  }

  private setupHttpErrorHandling(): void {
    console.log('📡 HTTP error handling setup complete');
  }

  private validateRoomStillExists(): void {
    if (!this.roomCode) return;

    this.roomService.getRoomDetails(this.roomCode).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.handleRoomDeleted('Room no longer exists');
        }
      },
      error: (error) => {
        if (error.status === 404) {
          this.handleRoomDeleted('Room not found or has been deleted');
        }
      }
    });
  }

  private handleRoomDeleted(message: string): void {
    console.log('🏠 Handling room deletion, redirecting to landing page');

    this.musicService.destroy();

    this.roomStateService.setRoom(null);
    this.roomStateService.setUser(null);
    this.roomStateService.setInRoom(false);

    try {
      SecureStorageService.clearUserSession();
    } catch (error) {
      console.error('Error clearing user session:', error);
    }

    this.socketService.disconnect();
    this.redirectToLandingWithError(message);
  }

  private loadQueue(): void {
    if (this.roomCode) {
      this.queueService.getQueue(this.roomCode).subscribe({
        next: (queueData) => {
          this.queueService.updateQueue(queueData);
        },
        error: (error) => {
          console.error('Error loading queue:', error);
        }
      });
    }
  }

  private checkScreenSize() {
    const width = window.innerWidth;
    this.isMobile = width < 1024;
    this.isTablet = width >= 1024 && width < 1280;
    this.isDesktop = width >= 1280;
  }
}
