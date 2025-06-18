import {ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit} from '@angular/core';
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
  selector: 'app-room', templateUrl: './room.component.html',
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
  isReconnecting = false;
  private isLayoutChanging = false;
  private layoutChangeTimeout: any;
  private lastLayoutChangeTime = 0;
  private readonly LAYOUT_CHANGE_DEBOUNCE = 2000;
  private subscriptions: Subscription[] = [];
  private resizeTimeout: any;
  private heartbeatInterval: any;
  private isJoiningRoom = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectingTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private roomStateService: RoomStateService,
    private socketService: SocketService,
    private roomService: RoomService,
    private notificationService: NotificationService,
    private musicService: MusicService,
    private queueService: QueueService,
    private cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    this.checkScreenSize();    const queueSub = this.queueService.queue$.subscribe(queueData => {
      console.log('🎵 Room component received queue data:', queueData.queue.map(item => ({
        id: item.id,
        title: item.title,
        downloadStatus: item.downloadStatus,
        downloadProgress: item.downloadProgress
      })));

      this.queueCount = queueData.queue.length;
      this.queueItems = queueData.queue;
      this.currentTrackIndex = queueData.currentTrackIndex;

      if (queueData.currentTrackIndex >= 0 && queueData.queue[queueData.currentTrackIndex]) {
        const currentTrack = queueData.queue[queueData.currentTrackIndex];
        this.currentlyPlayingId = currentTrack.id;
      } else {
        this.currentlyPlayingId = undefined;
      }

      this.cdr.detectChanges();
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
    if (this.roomCode) {
      this.socketService.leaveRoom(this.roomCode);
    }

    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    if (this.layoutChangeTimeout) {
      clearTimeout(this.layoutChangeTimeout);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.reconnectingTimeout) {
      clearTimeout(this.reconnectingTimeout);
    }
  }

  returnToLanding() {
    this.router.navigate(['/']);
  }

  onMobileTabChange(tab: 'search' | 'queue' | 'room') {
    console.log('📱 Mobile tab changed to:', tab);
    this.mobileTab = tab;
    this.cdr.detectChanges();
  }

  onDesktopTabChange(tab: 'search' | 'room' | 'queue') {
    console.log('💻 Desktop/Tablet tab changed to:', tab);
    if (tab === 'search' || tab === 'room') {
      this.desktopTab = tab;
      this.cdr.detectChanges();
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any) {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = setTimeout(() => {
      const wasDesktop = this.isDesktop;
      const wasMobile = this.isMobile;
      const wasTablet = this.isTablet;

      this.checkScreenSize();

      const layoutChanged = (wasDesktop && !this.isDesktop) ||
        (wasMobile && !this.isMobile) ||
        (wasTablet && !this.isTablet);
      if (layoutChanged) {
        const from = wasDesktop ? 'desktop' : wasMobile ? 'mobile' : 'tablet';
        const to = this.isDesktop ? 'desktop' : this.isMobile ? 'mobile' : 'tablet';

        console.log('📱 Layout changed:', {from, to});

        this.handleLayoutChange(from, to);

        this.cdr.detectChanges();
      }

    }, 500);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: any) {
    if (this.roomCode) {
      this.socketService.leaveRoom(this.roomCode);
    }
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
            console.log('✅ Room exists, proceeding with access validation');
            this.loadingMessage = 'Loading room...';
            this.proceedWithRoomAccess();
          } else {
            console.log('❌ Room does not exist or is invalid');
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
            console.log('❌ Room not found (404)');
            this.redirectToLandingWithError('Room not found or has ended');
          } else {
            console.log('❌ Error connecting to room');
            this.redirectToLandingWithError('Unable to connect to room. Please try again.');
          }
        }, remainingTime);
      }
    });
  }

  private async proceedWithRoomAccess(): Promise<void> {
    this.loadingMessage = 'Checking user session...';
    console.log('🔍 Proceeding with room access for room:', this.roomCode);

    const localStorageValid = this.validateLocalStorageSession(this.roomCode);
    console.log('💾 Local storage session valid:', localStorageValid);

    if (!localStorageValid) {
      console.log('❌ No valid session in local storage, redirecting to join page');
      this.isLoading = false;
      this.router.navigate(['/join', this.roomCode]);
      return;
    }

    const currentUser = this.roomStateService.getUser();
    console.log('👤 Current user from state:', currentUser);

    if (this.roomCode && !currentUser) {
      console.log('📂 No current user in state, restoring from local storage...');
      const savedUserData = await this.checkLocalStorageForUser(this.roomCode);
      console.log('💾 Saved user data:', savedUserData);

      if (savedUserData) {
        console.log('✅ User exists in room, restoring session and connecting to server');
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
        console.log('🚪 User not found in room, redirecting to join page');
        this.isLoading = false;
        this.router.navigate(['/join', this.roomCode]);
      }
    } else if (currentUser && this.roomCode) {
      console.log('🔌 User exists in state, validating user is still in room and connecting');
      this.loadingMessage = 'Validating session...';

      const isUserInRoom = await this.validateUserInRoom(this.roomCode, currentUser.id);
      if (isUserInRoom) {
        console.log('✅ User validated in room, connecting to server');
        this.loadingMessage = 'Connecting to room...';
        this.ensureSocketConnection();
        this.isLoading = false;
        console.log('🎉 Room loaded successfully');
      } else {
        console.log('❌ User not in room, redirecting to join page');
        this.isLoading = false;
        this.router.navigate(['/join', this.roomCode]);
      }
    } else {
      console.log('❌ Fallback: redirecting to join page');
      this.isLoading = false;
      this.router.navigate(['/join', this.roomCode]);
    }
  }

  private redirectToLandingWithError(message: string): void {
    this.isLoading = false;

    SecureStorageService.clearUserSession();

    this.roomStateService.setRoom(null);
    this.roomStateService.setUser(null);
    this.roomStateService.setInRoom(false);

    this.notificationService.error(message, 5000);

    this.router.navigate(['/']);
  }

  private async checkLocalStorageForUser(roomCode: string): Promise<any> {
    const sessionData = SecureStorageService.getUserSession();

    if (!sessionData || sessionData.roomCode !== roomCode) {
      console.log('❌ No valid session data for room:', roomCode);
      return null;
    }

    try {
      console.log('🔍 Validating user session with server...');
      const response = await this.roomService.getUserInfo(roomCode, sessionData.userId).toPromise();

      if (response.success && response.data) {
        console.log('✅ User session validated successfully');

        const roomResponse = await this.roomService.getRoomDetails(roomCode).toPromise();

        return {
          user: response.data,
          room: roomResponse.success ? roomResponse.data : null,
          roomCode: roomCode,
          timestamp: sessionData.timestamp
        };
      } else {
        console.log('❌ User session validation failed');
        SecureStorageService.clearUserSession();
        return null;
      }
    } catch (error: any) {
      console.error('Error fetching user info:', error);
      if (error?.status === 404) {
        console.log('❌ User or room not found, clearing session');
      } else {
        console.log('❌ Server error during validation, clearing session');
      }
      SecureStorageService.clearUserSession();
      return null;
    }
  }

  private ensureSocketConnection(): void {
    if (this.isLayoutChanging) {
      console.log('🔄 Skipping socket connection check during layout change');
      setTimeout(() => this.ensureSocketConnection(), 1000);
      return;
    }

    const currentUser = this.roomStateService.getUser();
    if (currentUser && this.roomCode && !this.isJoiningRoom) {
      if (this.socketService.isConnected()) {
        this.joinRoomSocket(currentUser);
      } else {
        console.log('🔄 Socket not connected, waiting...');
        let attempts = 0;
        const checkConnection = setInterval(() => {
          attempts++;
          if (this.socketService.isConnected()) {
            clearInterval(checkConnection);
            this.joinRoomSocket(currentUser);
          } else if (attempts >= 50) {
            clearInterval(checkConnection);
            console.warn('⚠️ Socket connection timeout, attempting to join anyway');
            this.joinRoomSocket(currentUser);
          }
        }, 100);
      }
    }
  }

  private joinRoomSocket(currentUser: any): void {
    if (this.isJoiningRoom) {
      console.log('🔄 Already joining room, skipping duplicate join attempt');
      return;
    }

    this.isJoiningRoom = true;
    console.log('🚪 Joining room via socket...', this.roomCode, currentUser.name);

    this.socketService.joinRoom(this.roomCode, currentUser);
    this.socketService.getParticipants(this.roomCode);

    this.loadQueue();

    console.log('🎵 Requesting immediate music sync after joining room...');
    this.socketService.requestSync(this.roomCode);

    setTimeout(() => {
      console.log('🎵 Requesting backup music sync...');
      this.socketService.requestSync(this.roomCode);
      this.isJoiningRoom = false;
    }, 1000);

    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.roomCode && this.socketService.isConnected()) {
        this.socketService.getParticipants(this.roomCode);
      }
    }, 30000);
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

      if (reason === 'io client disconnect') {
        if (this.isLayoutChanging) {
          console.log('🔄 Client disconnect detected during layout change, will reconnect after layout stabilizes');
          setTimeout(() => {
            if (!this.socketService.isConnected() && this.roomCode) {
              console.log('🔄 Reconnecting socket after layout change');
              this.initiateReconnection();
            }
          }, 1500);
          return;
        } else {
          console.log('🔄 Client disconnect detected (likely window resize), will attempt reconnection');
          setTimeout(() => {
            if (!this.socketService.isConnected() && this.roomCode) {
              this.initiateReconnection();
            }
          }, 1000);
          return;
        }
      }
      setTimeout(() => {
        this.isReconnecting = true;
        this.cdr.detectChanges();

        if (this.reconnectingTimeout) {
          clearTimeout(this.reconnectingTimeout);
        }
        this.reconnectingTimeout = setTimeout(() => {
          console.warn('⚠️ Reconnecting timeout reached, clearing reconnecting state');
          this.resetReconnectionState();
        }, 10000);
      });

      if (this.roomCode && !this.isLoading) {
        setTimeout(() => {
          this.validateRoomStillExists();
        }, 1000);
      }
    });
    this.subscriptions.push(disconnectSub);
    const reconnectSub = this.socketService.onSocketConnect().subscribe(() => {
      console.log('🔌 Socket reconnected, attempting to rejoin room');

      this.reconnectAttempts = 0;
      setTimeout(() => {
        this.isReconnecting = false;
        if (this.reconnectingTimeout) {
          clearTimeout(this.reconnectingTimeout);
          this.reconnectingTimeout = null;
        }
        this.cdr.detectChanges();
      });

      if (this.roomCode && !this.isLoading && !this.isJoiningRoom) {
        const currentUser = this.roomStateService.getUser();
        if (currentUser) {
          console.log('🔄 Auto-rejoining room after reconnection');
          setTimeout(() => {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              this.ensureSocketConnection();
            } else {
              console.warn('⚠️ Max reconnect attempts reached, stopping automatic reconnection');
              this.isReconnecting = false;
              this.cdr.detectChanges();
            }
          }, 500);
        }
      }
    });
    this.subscriptions.push(reconnectSub);
    const layoutReconnectSub = this.socketService.onLayoutReconnectSuccess().subscribe((data) => {
      console.log('📱 Layout reconnect successful:', data);
      if (this.isReconnecting) {
        this.isReconnecting = false;
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.push(layoutReconnectSub);

    const participantListSub = this.socketService.onParticipantList().subscribe((participants) => {
      console.log('👥 Received participant list, connection confirmed');

      this.reconnectAttempts = 0;
      setTimeout(() => {
        this.isReconnecting = false;
        this.isJoiningRoom = false;
        if (this.reconnectingTimeout) {
          clearTimeout(this.reconnectingTimeout);
          this.reconnectingTimeout = null;
        }
        this.cdr.detectChanges();
      });

      const currentUser = this.roomStateService.getUser();
      if (currentUser) {
        const isInParticipantList = participants.some(p => p.id === currentUser.id);
        if (!isInParticipantList && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.warn('⚠️ User not found in participant list, attempting to rejoin');
          this.reconnectAttempts++;
          setTimeout(() => {
            this.ensureSocketConnection();
          }, 1000);
        }
      }
    });
    this.subscriptions.push(participantListSub);
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
    const newIsMobile = width < 1024;
    const newIsTablet = width >= 1024 && width < 1280;
    const newIsDesktop = width >= 1280;

    if (this.isMobile !== newIsMobile || this.isTablet !== newIsTablet || this.isDesktop !== newIsDesktop) {
      this.isMobile = newIsMobile;
      this.isTablet = newIsTablet;
      this.isDesktop = newIsDesktop;
    }
  }

  private resetReconnectionState(): void {
    this.isReconnecting = false;
    this.isJoiningRoom = false;
    this.reconnectAttempts = 0;
    if (this.reconnectingTimeout) {
      clearTimeout(this.reconnectingTimeout);
      this.reconnectingTimeout = null;
    }
    this.cdr.detectChanges();
  }

  private async validateUserInRoom(roomCode: string, userId: string): Promise<boolean> {
    try {
      const response = await this.roomService.getUserInfo(roomCode, userId).toPromise();
      return response.success && response.data;
    } catch (error) {
      console.error('Error validating user in room:', error);
      SecureStorageService.clearUserSession();
      return false;
    }
  }

  private validateLocalStorageSession(roomCode: string): boolean {
    try {
      const sessionData = SecureStorageService.getUserSession();

      if (!sessionData) {
        console.log('❌ No session data found in local storage');
        return false;
      }

      if (sessionData.roomCode !== roomCode) {
        console.log('❌ Session room code does not match current room:', {
          sessionRoom: sessionData.roomCode,
          currentRoom: roomCode
        });
        SecureStorageService.clearUserSession();
        return false;
      }

      console.log('✅ Valid session found for room:', roomCode);
      return true;
    } catch (error) {
      console.error('Error validating local storage session:', error);
      SecureStorageService.clearUserSession();
      return false;
    }
  }

  private handleLayoutChange(from: string, to: string): void {
    const now = Date.now();

    if (now - this.lastLayoutChangeTime < this.LAYOUT_CHANGE_DEBOUNCE) {
      console.log('📱 Debouncing rapid layout change');
      return;
    }

    this.lastLayoutChangeTime = now;
    console.log(`📱 Handling layout change from ${from} to ${to}`);
    console.log('🔌 Socket status before layout change:', this.socketService.getSocketStatus());

    this.isLayoutChanging = true;

    if (this.layoutChangeTimeout) {
      clearTimeout(this.layoutChangeTimeout);
    }

    this.layoutChangeTimeout = setTimeout(() => {
      this.isLayoutChanging = false;
      console.log('📱 Layout change complete, socket operations resumed');
      console.log('🔌 Socket status after layout change:', this.socketService.getSocketStatus());

      if (!this.socketService.isConnected() && this.roomCode) {
        const currentUser = this.roomStateService.getUser();
        if (currentUser) {
          console.log('🔄 Socket disconnected after layout change, using layout change reconnect');
          this.socketService.layoutChangeReconnect(this.roomCode, currentUser, `layout-change-${from}-to-${to}`);
        }
      } else if (this.socketService.isConnected() && this.roomCode) {
        const currentUser = this.roomStateService.getUser();
        if (currentUser) {
          console.log('🔄 Sending layout change sync after reconnection');
          this.socketService.layoutChangeReconnect(this.roomCode, currentUser, `layout-change-${from}-to-${to}`);
        }
      }
    }, 1500);
  }

  private initiateReconnection(): void {
    console.log('🔄 Initiating socket reconnection...');

    this.isReconnecting = true;
    this.cdr.detectChanges();

    if (this.isLayoutChanging && this.roomCode) {
      const currentUser = this.roomStateService.getUser();
      if (currentUser) {
        console.log('🔄 Using layout change reconnect during layout transition');
        this.socketService.layoutChangeReconnect(this.roomCode, currentUser, 'forced-reconnect-during-layout-change');
        return;
      }
    }

    this.socketService.forceReconnect();

    if (this.reconnectingTimeout) {
      clearTimeout(this.reconnectingTimeout);
    }
    this.reconnectingTimeout = setTimeout(() => {
      console.warn('⚠️ Reconnection timeout reached, clearing reconnecting state');
      this.resetReconnectionState();
    }, 10000);
  }
}
