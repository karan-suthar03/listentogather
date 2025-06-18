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
  private readonly LAYOUT_CHANGE_DEBOUNCE = 2000; // 2 seconds minimum between layout changes
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
    /**
     * Room Access Flow:
     * 1. Check screen size for responsive layout
     * 2. Set up queue subscription for real-time updates
     * 3. Set up room deletion and error listeners
     * 4. Set up HTTP error handling
     * 5. Set loading timeout (10 seconds)
     * 6. Get room code from URL parameters
     * 7. Validate if room exists on server
     * 8. If room exists:
     *    - Check if user has valid session in local storage for this room
     *    - If valid session exists: restore user state and connect to server
     *    - If no valid session: redirect to join page
     * 9. If room doesn't exist: redirect to landing page
     */
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
    // Gracefully leave room before component destruction
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
    // Trigger change detection to ensure proper rendering
    this.cdr.detectChanges();
  }

  onDesktopTabChange(tab: 'search' | 'room' | 'queue') {
    console.log('💻 Desktop/Tablet tab changed to:', tab);
    if (tab === 'search' || tab === 'room') {
      this.desktopTab = tab;
      // Trigger change detection to ensure proper rendering
      this.cdr.detectChanges();
    }
    // Ignore 'queue' tab for desktop/tablet as it's not supported
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any) {
    // Clear any existing timeouts
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = setTimeout(() => {
      const wasDesktop = this.isDesktop;
      const wasMobile = this.isMobile;
      const wasTablet = this.isTablet;

      this.checkScreenSize();

      // Only log and process significant layout changes
      const layoutChanged = (wasDesktop && !this.isDesktop) ||
        (wasMobile && !this.isMobile) ||
        (wasTablet && !this.isTablet);
      if (layoutChanged) {
        const from = wasDesktop ? 'desktop' : wasMobile ? 'mobile' : 'tablet';
        const to = this.isDesktop ? 'desktop' : this.isMobile ? 'mobile' : 'tablet';

        console.log('📱 Layout changed:', {from, to});

        // Handle the layout change gracefully
        this.handleLayoutChange(from, to);

        // Trigger change detection for layout changes
        this.cdr.detectChanges();
      }

    }, 500); // Debounce resize events
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: any) {
    // Gracefully leave room before page unload
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
            // Room doesn't exist, redirect to landing page after clearing any stored session
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
            // Room doesn't exist, redirect to landing page after clearing any stored session
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

    // First check if we have a valid session in local storage for this room
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

      // Validate user is still in the room
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

    // Clear user session when redirecting due to room issues
    SecureStorageService.clearUserSession();

    // Clear room state
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

        // Also get room details to ensure we have complete room data
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
    // Skip socket operations during layout changes to prevent interference
    if (this.isLayoutChanging) {
      console.log('🔄 Skipping socket connection check during layout change');
      setTimeout(() => this.ensureSocketConnection(), 1000);
      return;
    }

    const currentUser = this.roomStateService.getUser();
    if (currentUser && this.roomCode && !this.isJoiningRoom) {
      // Wait for socket to be connected before joining
      if (this.socketService.isConnected()) {
        this.joinRoomSocket(currentUser);
      } else {
        console.log('🔄 Socket not connected, waiting...');
        // Wait up to 5 seconds for connection
        let attempts = 0;
        const checkConnection = setInterval(() => {
          attempts++;
          if (this.socketService.isConnected()) {
            clearInterval(checkConnection);
            this.joinRoomSocket(currentUser);
          } else if (attempts >= 50) { // 5 seconds
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
      // Reset joining flag after sync, but don't reset other reconnection state
      // as we'll wait for participant list confirmation
      this.isJoiningRoom = false;
    }, 1000);

    // Start heartbeat to ensure we stay connected
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Check connection every 30 seconds
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

      // Handle client-initiated disconnects during layout changes
      if (reason === 'io client disconnect') {
        if (this.isLayoutChanging) {
          console.log('🔄 Client disconnect detected during layout change, will reconnect after layout stabilizes');
          // Don't show reconnecting indicator immediately, but schedule reconnection
          setTimeout(() => {
            if (!this.socketService.isConnected() && this.roomCode) {
              console.log('🔄 Reconnecting socket after layout change');
              this.initiateReconnection();
            }
          }, 1500); // Wait for layout to stabilize
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
      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.isReconnecting = true;
        this.cdr.detectChanges();

        // Set a timeout to automatically clear reconnecting state if it gets stuck
        if (this.reconnectingTimeout) {
          clearTimeout(this.reconnectingTimeout);
        }
        this.reconnectingTimeout = setTimeout(() => {
          console.warn('⚠️ Reconnecting timeout reached, clearing reconnecting state');
          this.resetReconnectionState();
        }, 10000); // 10 seconds timeout
      });

      if (this.roomCode && !this.isLoading) {
        setTimeout(() => {
          this.validateRoomStillExists();
        }, 1000);
      }
    });
    this.subscriptions.push(disconnectSub);    // Add reconnection handler to automatically rejoin room
    const reconnectSub = this.socketService.onSocketConnect().subscribe(() => {
      console.log('🔌 Socket reconnected, attempting to rejoin room');

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
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
          // Add a small delay to ensure server is ready
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
    this.subscriptions.push(reconnectSub);    // Add layout reconnect success handler
    const layoutReconnectSub = this.socketService.onLayoutReconnectSuccess().subscribe((data) => {
      console.log('📱 Layout reconnect successful:', data);
      // Clear any reconnecting state
      if (this.isReconnecting) {
        this.isReconnecting = false;
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.push(layoutReconnectSub);

    // Add participant list listener to confirm we're properly connected
    const participantListSub = this.socketService.onParticipantList().subscribe((participants) => {
      console.log('👥 Received participant list, connection confirmed');

      // Reset reconnect attempts on successful participant list
      this.reconnectAttempts = 0;
      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.isReconnecting = false;
        this.isJoiningRoom = false; // Reset joining flag when we receive confirmation
        if (this.reconnectingTimeout) {
          clearTimeout(this.reconnectingTimeout);
          this.reconnectingTimeout = null;
        }
        this.cdr.detectChanges();
      });

      // Verify that we're actually in the participant list
      const currentUser = this.roomStateService.getUser();
      if (currentUser) {
        const isInParticipantList = participants.some(p => p.id === currentUser.id);
        if (!isInParticipantList && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.warn('⚠️ User not found in participant list, attempting to rejoin');
          this.reconnectAttempts++;
          // Small delay before attempting to rejoin
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

    // Only update if there's actually a change to prevent unnecessary updates
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
      // Clear session if validation fails
      SecureStorageService.clearUserSession();
      return false;
    }
  }

  /**
   * Validates if the user has a valid session in local storage for the given room code
   */
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
        // Clear invalid session
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

    // Prevent rapid layout changes
    if (now - this.lastLayoutChangeTime < this.LAYOUT_CHANGE_DEBOUNCE) {
      console.log('📱 Debouncing rapid layout change');
      return;
    }

    this.lastLayoutChangeTime = now;
    console.log(`📱 Handling layout change from ${from} to ${to}`);
    console.log('🔌 Socket status before layout change:', this.socketService.getSocketStatus());

    // Mark that we're handling a layout change
    this.isLayoutChanging = true;

    // Clear any existing layout change timeout
    if (this.layoutChangeTimeout) {
      clearTimeout(this.layoutChangeTimeout);
    }

    // Set timeout to clear layout changing flag and handle reconnection if needed
    this.layoutChangeTimeout = setTimeout(() => {
      this.isLayoutChanging = false;
      console.log('📱 Layout change complete, socket operations resumed');
      console.log('🔌 Socket status after layout change:', this.socketService.getSocketStatus());

      // Check if socket is still connected after layout change
      if (!this.socketService.isConnected() && this.roomCode) {
        const currentUser = this.roomStateService.getUser();
        if (currentUser) {
          console.log('🔄 Socket disconnected after layout change, using layout change reconnect');
          this.socketService.layoutChangeReconnect(this.roomCode, currentUser, `layout-change-${from}-to-${to}`);
        }
      } else if (this.socketService.isConnected() && this.roomCode) {
        // Even if connected, send a layout change reconnect to ensure sync
        const currentUser = this.roomStateService.getUser();
        if (currentUser) {
          console.log('🔄 Sending layout change sync after reconnection');
          this.socketService.layoutChangeReconnect(this.roomCode, currentUser, `layout-change-${from}-to-${to}`);
        }
      }
    }, 1500); // Give more time for layout to stabilize
  }

  private initiateReconnection(): void {
    console.log('🔄 Initiating socket reconnection...');

    // Show reconnecting indicator
    this.isReconnecting = true;
    this.cdr.detectChanges();

    // If we're in the middle of a layout change, use the special reconnect method
    if (this.isLayoutChanging && this.roomCode) {
      const currentUser = this.roomStateService.getUser();
      if (currentUser) {
        console.log('🔄 Using layout change reconnect during layout transition');
        this.socketService.layoutChangeReconnect(this.roomCode, currentUser, 'forced-reconnect-during-layout-change');
        return;
      }
    }

    // Force socket reconnection
    this.socketService.forceReconnect();

    // Set timeout to clear reconnecting state if needed
    if (this.reconnectingTimeout) {
      clearTimeout(this.reconnectingTimeout);
    }
    this.reconnectingTimeout = setTimeout(() => {
      console.warn('⚠️ Reconnection timeout reached, clearing reconnecting state');
      this.resetReconnectionState();
    }, 10000);
  }
}
