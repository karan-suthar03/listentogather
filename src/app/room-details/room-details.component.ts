import { Component, OnInit, OnDestroy } from '@angular/core';
import { Room, User } from '../models/room.model';
import { QueueItem } from '../queue.service';
import { RoomService } from '../room.service';
import { SocketService } from '../socket.service';
import { RoomStateService } from '../room-state.service';
import { NotificationService } from '../notification.service';
import { QueueService } from '../queue.service';
import { WorkingStateService } from '../working-state.service';
import { Subscription } from 'rxjs';

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
  
  // Queue management
  queueItems: QueueItem[] = [];
  currentTrackIndex: number = -1;
  
  // New properties for join/create flow
  isInRoom: boolean = false;
  joinRoomCode: string = '';
  userName: string = '';
  
  // Socket subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private roomService: RoomService, 
    private socketService: SocketService,
    private roomStateService: RoomStateService,
    private notificationService: NotificationService,
    private queueService: QueueService,
    private workingStateService: WorkingStateService
  ) { }

  ngOnInit(): void {
    // Start with buttons only - no auto room creation
    this.setupSocketListeners();
    
    // Subscribe to current user from room state service
    this.subscriptions.push(
      this.roomStateService.getCurrentUser().subscribe(user => {
        this.user = user;
      })
    );
    
    // Subscribe to queue updates from the queue service
    this.subscriptions.push(
      this.queueService.queue$.subscribe(queueData => {
        this.queueItems = queueData.queue;
        this.currentTrackIndex = queueData.currentTrackIndex;
      })
    );

    // Subscribe to working state
    this.subscriptions.push(
      this.workingStateService.workingState$.subscribe(workingState => {
        this.isRoomWorking = workingState.isWorking;
        this.roomWorkingMessage = workingState.workingMessage;
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Leave room and disconnect socket
    if (this.roomCode) {
      this.socketService.leaveRoom(this.roomCode);
    }
    this.socketService.disconnect();
  }

  private setupSocketListeners(): void {
    // Listen for room updates
    const roomUpdateSub = this.socketService.onRoomUpdate().subscribe((room: Room) => {
      this.room = room;
      this.users = room.members;
      this.roomStateService.setRoom(room);
      
    });
    this.subscriptions.push(roomUpdateSub);

    // Listen for user joined events
    const userJoinedSub = this.socketService.onUserJoined().subscribe((data) => {
      this.users = data.room.members;
      this.roomStateService.setRoom(data.room);
      
      // Show notification if it's not the current user
      if (data.user.id !== this.currentUserId) {
        this.notificationService.info(`${data.user.name} joined the room`, 2000);
      }
    });
    this.subscriptions.push(userJoinedSub);

    // Listen for user left events
    const userLeftSub = this.socketService.onUserLeft().subscribe((data) => {
      this.users = data.room.members;
      this.roomStateService.setRoom(data.room);
      
      // Show notification if it's not the current user
      if (data.user.id !== this.currentUserId) {
        this.notificationService.info(`${data.user.name} left the room`, 2000);
      }
    });
    this.subscriptions.push(userLeftSub);

    // Listen for participant list updates
    const participantListSub = this.socketService.onParticipantList().subscribe((participants) => {
      this.users = participants;
    });
    this.subscriptions.push(participantListSub);
  }

  createRoom(): void {
    if (!this.userName.trim()) {
      alert('Please enter your name');
      return;
    }
    
    this.roomService.createRoom(this.userName).subscribe({
      next: (res) => {
        this.room = res.data.room;
        this.user = res.data.user;
        this.roomCode = res.data.room.code;
        this.users = res.data.room.members;
        this.isRoomAdmin = res.data.user.isHost;
        this.currentUserId = res.data.user.id;
        this.isInRoom = true;
        
        // Update shared state
        this.roomStateService.setRoom(res.data.room);
        this.roomStateService.setUser(res.data.user);
        this.roomStateService.setInRoom(true);
        
        // Join the room via socket for real-time updates
        this.socketService.joinRoom(this.roomCode, res.data.user);
        
        // Request current participant list
        this.socketService.getParticipants(this.roomCode);
        
        // Load queue for the room
        this.loadQueue();
      },
      error: (err) => {
        console.error('Error creating room:', err);
        alert('Failed to create room. Please try again.');
      }
    });
  }

  joinRoom(): void {
    if (!this.userName.trim()) {
      alert('Please enter your name');
      return;
    }
    
    if (!this.joinRoomCode.trim()) {
      alert('Please enter room code');
      return;
    }
    
    this.roomService.joinRoom(this.joinRoomCode, this.userName).subscribe({
      next: (res) => {
        this.room = res.data.room;
        this.user = res.data.user;
        this.roomCode = res.data.room.code;
        this.users = res.data.room.members;
        this.isRoomAdmin = res.data.user.isHost;
        this.currentUserId = res.data.user.id;
        this.isInRoom = true;
        
        // Update shared state
        this.roomStateService.setRoom(res.data.room);
        this.roomStateService.setUser(res.data.user);
        this.roomStateService.setInRoom(true);
        
        // Join the room via socket for real-time updates
        this.socketService.joinRoom(this.roomCode, res.data.user);
        
        // Request current participant list
        this.socketService.getParticipants(this.roomCode);
        
        // Load queue for the room
        this.loadQueue();
      },
      error: (err) => {
        console.error('Error joining room:', err);
        alert('Failed to join room. Please check the room code and try again.');
      }
    });
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
      // Set loading state
      this.isAddingToQueue = true;
      
      // Detect URL type and set appropriate processing message
      const url = this.youtubeUrl.trim();
      const isSpotify = this.isSpotifyUrl(url);
      const isYouTube = this.isYouTubeUrl(url);
      
      let processingMessage = 'Processing URL...';
      if (isSpotify) {
        // Check if it's a Spotify playlist
        if (url.includes('/playlist/')) {
          processingMessage = 'Processing Spotify playlist...';
        } else {
          processingMessage = 'Processing Spotify track...';
        }
      } else if (isYouTube) {
        processingMessage = 'Processing YouTube video...';
      }
      
      // Set local working state (will be overridden by server response)
      this.workingStateService.setLocalWorking(true, processingMessage);
      
      // Prepare song data for server
      const songData: any = {
        title: 'Loading...',
        artist: 'Fetching info...',
        duration: 0,
        coverUrl: '',
        mp3Url: ''
      };
      
      // Add URL to appropriate field
      if (isSpotify) {
        songData.spotifyUrl = url;
      } else if (isYouTube) {
        songData.youtubeUrl = url;
      } else {
        // Try as YouTube URL by default
        songData.youtubeUrl = url;
      }

      const addedByName = this.user?.name || this.roomStateService.getUser()?.name || 'Unknown User';
      
      this.queueService.addToQueue(this.roomCode, songData, addedByName).subscribe({
        next: (response) => {
          // Show success message with source info
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
            // Hide success message after 3 seconds for single tracks
            setTimeout(() => {
              this.addToQueueSuccess = false;
            }, 3000);
          }
          
          // No need to manually refresh - socket will handle updates
        },
        error: (error) => {
          console.error('Error adding to queue:', error);
          this.isAddingToQueue = false;
          
          // Clear working state on error
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
          this.loadQueue(); // Refresh queue
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

  // Helper methods for URL detection
  isYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
    return youtubeRegex.test(url);
  }

  isSpotifyUrl(url: string): boolean {
    const spotifyRegex = /^(https?:\/\/)?(open\.)?spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/;
    return spotifyRegex.test(url);
  }
}
