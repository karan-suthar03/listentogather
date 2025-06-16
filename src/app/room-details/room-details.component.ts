import {Component, OnDestroy, OnInit} from '@angular/core';
import {Room, User} from '../models/room.model';
import {QueueItem, QueueService} from '../queue.service';
import {RoomService} from '../room.service';
import {SocketService} from '../socket.service';
import {RoomStateService} from '../room-state.service';
import {NotificationService} from '../notification.service';
import {WorkingStateService} from '../working-state.service';
import {MusicService} from '../music.service';
import {Subscription} from 'rxjs';
import {Router} from '@angular/router';
import {SecureStorageService} from '../services/secure-storage.service';

@Component({
  selector: 'app-room-details',
  templateUrl: './room-details.component.html',
  styleUrls: ['./room-details.component.css']
})
export class RoomDetailsComponent implements OnInit, OnDestroy {
  room: Room | null = null;
  user: User | null = null;
  roomCode: string = '';
  users: User[] = [];
  isRoomAdmin: boolean = false;
  currentUserId: string = '';
  youtubeUrl: string = '';
  isAddingToQueue: boolean = false;
  addToQueueSuccess: boolean = false;
  isRoomWorking: boolean = false;
  roomWorkingMessage: string = '';

  queueItems: QueueItem[] = [];
  currentTrackIndex: number = -1;
  private subscriptions: Subscription[] = [];

  constructor(
    private roomService: RoomService,
    private socketService: SocketService,
    private roomStateService: RoomStateService,
    private notificationService: NotificationService,
    private queueService: QueueService,
    private workingStateService: WorkingStateService,
    private router: Router,
    private musicService: MusicService
  ) {
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.roomStateService.getCurrentRoom().subscribe(room => {
        if (room) {
          this.room = room;
          this.roomCode = room.code;
          this.users = room.members;
          this.isRoomAdmin = this.user?.isHost || false;
          this.loadQueue();
        }
      })
    );
    this.subscriptions.push(
      this.roomStateService.getCurrentUser().subscribe(user => {
        if (user) {
          this.user = user;
          this.currentUserId = user.id;
          this.isRoomAdmin = user.isHost;
        }
      })
    );
    this.setupSocketListeners();

    this.subscriptions.push(
      this.queueService.queue$.subscribe(queueData => {
        this.queueItems = queueData.queue;
        this.currentTrackIndex = queueData.currentTrackIndex;
      })
    );

    this.subscriptions.push(
      this.workingStateService.workingState$.subscribe(workingState => {
        this.isRoomWorking = workingState.isWorking;
        this.roomWorkingMessage = workingState.workingMessage;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());

    if (this.roomCode) {
      this.socketService.leaveRoom(this.roomCode);
    }
    this.socketService.disconnect();
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode)
      .then(() => {
      })
      .catch(err => {
        console.error('Failed to copy room code: ', err);
      });
  }

  addVideoToQueue(): void {
    if (this.youtubeUrl.trim() && this.roomCode && !this.isAddingToQueue && !this.isRoomWorking) {
      this.isAddingToQueue = true;

      const url = this.youtubeUrl.trim();
      const isSpotify = this.isSpotifyUrl(url);
      const isYouTube = this.isYouTubeUrl(url);

      let processingMessage = 'Processing URL...';
      if (isSpotify) {
        if (url.includes('/playlist/')) {
          processingMessage = 'Processing Spotify playlist...';
        } else {
          processingMessage = 'Processing Spotify track...';
        }
      } else if (isYouTube) {
        processingMessage = 'Processing YouTube video...';
      }

      this.workingStateService.setLocalWorking(true, processingMessage);

      const songData: any = {
        title: 'Loading...',
        artist: 'Fetching info...',
        duration: 0,
        coverUrl: '',
        mp3Url: ''
      };

      if (isSpotify) {
        songData.spotifyUrl = url;
      } else if (isYouTube) {
        songData.youtubeUrl = url;
      } else {
        songData.youtubeUrl = url;
      }

      const addedByName = this.user?.name || this.roomStateService.getUser()?.name || 'Unknown User';

      this.queueService.addToQueue(this.roomCode, songData, addedByName).subscribe({
        next: (response) => {
          let successMessage = 'Added to queue!';
          if (response.source === 'spotify') {
            if (response.type === 'playlist') {
              successMessage = `Added ${response.tracksAdded} tracks from Spotify playlist "${response.playlistName}" to queue!`;
              if (response.tracksSkipped && response.tracksSkipped > 0) {
                successMessage += ` (${response.tracksSkipped} songs skipped due to queue limit)`;
              }
            } else {
              successMessage = 'Added Spotify track to queue!';
            }
          } else if (response.source === 'youtube') {
            successMessage = 'Added YouTube video to queue!';
          }

          this.youtubeUrl = '';
          this.isAddingToQueue = false;
          this.addToQueueSuccess = true;

          this.workingStateService.setLocalWorking(false, '');

          if (response.type === 'playlist') {
            this.notificationService.success(successMessage, 5000);
          } else {
            setTimeout(() => {
              this.addToQueueSuccess = false;
            }, 3000);
          }
        },
        error: (error) => {
          console.error('Error adding to queue:', error);
          this.isAddingToQueue = false;

          this.workingStateService.setLocalWorking(false, '');

          let errorMessage = 'Failed to add to queue. Please try again.';
          if (error.error && error.error.details) {
            errorMessage = `Failed to add to queue: ${error.error.details}`;
          }

          alert(errorMessage);
        }
      });
    }
  }

  kickUser(userId: string): void {
    this.users = this.users.filter(user => user.id !== userId);
  }

  endRoom(): void {
    if (confirm('Are you sure you want to end the room? This action cannot be undone.')) {
    }
  }

  trackByUserId(index: number, user: User): string {
    return user.id;
  }

  trackByQueueId(index: number, item: QueueItem): string {
    return item.id;
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  loadQueue(): void {
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

  removeFromQueue(index: number): void {
    if (this.roomCode && index >= 0 && index < this.queueItems.length) {

      this.queueService.removeFromQueue(this.roomCode, index).subscribe({
        next: (response) => {
          this.loadQueue();
        },
        error: (error) => {
          console.error('🗑️ Error removing from queue:', error);
        }
      });
    }
  }

  playTrack(index: number): void {
    if (!this.user || !this.roomCode) {
      return;
    }

    const item = this.queueItems[index];
    if (!item || item.downloadStatus !== 'completed') {
      return;
    }

    this.socketService.playTrackAtIndex(this.roomCode, this.user.id, index);
  }

  isYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
    return youtubeRegex.test(url);
  }

  isSpotifyUrl(url: string): boolean {
    const spotifyRegex = /^(https?:\/\/)?(open\.)?spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/;
    return spotifyRegex.test(url);
  }

  private setupSocketListeners(): void {
    const roomUpdateSub = this.socketService.onRoomUpdate().subscribe((room: Room) => {
      this.room = room;
      this.users = room.members;
      this.roomStateService.setRoom(room);

    });
    this.subscriptions.push(roomUpdateSub);

    const userJoinedSub = this.socketService.onUserJoined().subscribe((data) => {
      this.users = data.room.members;
      this.roomStateService.setRoom(data.room);

      if (data.user.id !== this.currentUserId) {
        this.notificationService.info(`${data.user.name} joined the room`, 2000);
      }
    });
    this.subscriptions.push(userJoinedSub);

    const userLeftSub = this.socketService.onUserLeft().subscribe((data) => {
      this.users = data.room.members;
      this.roomStateService.setRoom(data.room);

      if (data.user.id !== this.currentUserId) {
        const reason = (data as any).reason;
        const message = reason === 'timeout'
          ? `${data.user.name} was disconnected`
          : `${data.user.name} left the room`;
        this.notificationService.info(message, 2000);
      }
    });
    this.subscriptions.push(userLeftSub);

    const userDisconnectedSub = this.socketService.onUserDisconnected().subscribe((data) => {
      this.users = data.room.members;
      this.roomStateService.setRoom(data.room);

      if (data.userId !== this.currentUserId) {
        this.notificationService.warning(`${data.user.name} disconnected (will be removed in 1 minute)`, 3000);
      }
    });
    this.subscriptions.push(userDisconnectedSub);

    const userReconnectedSub = this.socketService.onUserReconnected().subscribe((data) => {
      this.users = data.room.members;
      this.roomStateService.setRoom(data.room);

      if (data.userId !== this.currentUserId) {
        this.notificationService.success(`${data.user.name} reconnected`, 2000);
      }
    });
    this.subscriptions.push(userReconnectedSub);

    const participantListSub = this.socketService.onParticipantList().subscribe((participants) => {
      this.users = participants;
    });
    this.subscriptions.push(participantListSub);

    // Room deletion handlers
    const roomDeletedSub = this.socketService.onRoomDeleted().subscribe((data) => {
      console.log('🗑️ Room deleted:', data);
      this.handleRoomDeleted(data.message || 'Room has been deleted');
    });
    this.subscriptions.push(roomDeletedSub);

    const forceDisconnectSub = this.socketService.onForceDisconnect().subscribe((data) => {
      console.log('🚪 Force disconnect:', data);
      this.handleRoomDeleted(data.message || 'You have been disconnected from the room');
    });
    this.subscriptions.push(forceDisconnectSub);    const errorSub = this.socketService.onError().subscribe((error) => {
      console.log('❌ Socket error:', error);
      if (error.message.includes('Room not found') || error.message.includes('room not found')) {
        this.handleRoomDeleted('Room not found or has been deleted');
      } else if (error.message.includes('User not in room')) {
        // Redirect to landing page when user is not in room
        this.router.navigate(['/']);
      }
    });this.subscriptions.push(errorSub);

    const hostChangedSub = this.socketService.onHostChanged().subscribe((data) => {
      console.log('👑 Host changed:', data);
      
      // Show notification about host change
      let message = '';
      switch (data.reason) {
        case 'host-left':
          message = `${data.newHost.name} is now the host (previous host left)`;
          break;
        case 'first-user-in-empty-room':
          message = `${data.newHost.name} joined as the host`;
          break;
        case 'manual-transfer':
          message = `Host transferred to ${data.newHost.name}`;
          break;
        default:
          message = `${data.newHost.name} is now the host`;
      }
      
      this.notificationService.show(message, 'info');
      
      // Update local user's host status if needed
      if (this.user && this.user.id === data.newHost.id) {
        this.user.isHost = true;
        this.roomStateService.setUser(this.user);
      } else if (this.user && data.previousHost && this.user.id === data.previousHost.id) {
        this.user.isHost = false;
        this.roomStateService.setUser(this.user);
      }
    });
    this.subscriptions.push(hostChangedSub);
  }

  private handleRoomDeleted(message: string): void {
    console.log('🏠 Handling room deletion, redirecting to landing page');

    // Stop music playback immediately
    this.musicService.destroy();

    // Clear room state
    this.roomStateService.setRoom(null);
    this.roomStateService.setUser(null);
    this.roomStateService.setInRoom(false);

    // Clear local storage
    try {
      SecureStorageService.clearUserSession();
    } catch (error) {
      console.error('Error clearing user session:', error);
    }

    // Disconnect socket
    this.socketService.disconnect();

    // Show notification and redirect
    this.notificationService.error(message, 5000);
    this.router.navigate(['/']);
  }
}
