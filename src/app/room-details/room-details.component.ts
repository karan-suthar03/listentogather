import { Component, OnInit, OnDestroy } from '@angular/core';
import { Room, User } from '../models/room.model';
import { RoomService } from '../room.service';
import { SocketService } from '../socket.service';
import { RoomStateService } from '../room-state.service';
import { NotificationService } from '../notification.service';
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
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    // Start with buttons only - no auto room creation
    this.setupSocketListeners();
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
      
      console.log('Room updated, participants:', room.members.length);
    });
    this.subscriptions.push(roomUpdateSub);

    // Listen for user joined events
    const userJoinedSub = this.socketService.onUserJoined().subscribe((data) => {
      console.log('User joined:', data.user.name);
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
      console.log('User left:', data.user.name);
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
      console.log('Participant list updated:', participants.length, 'users');
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
        this.room = res.room;
        this.user = res.user;
        this.roomCode = res.room.code;
        this.users = res.room.members;
        this.isRoomAdmin = res.user.isHost;
        this.currentUserId = res.user.id;
        this.isInRoom = true;
        
        // Update shared state
        this.roomStateService.setRoom(res.room);
        this.roomStateService.setUser(res.user);
        this.roomStateService.setInRoom(true);
        
        // Join the room via socket for real-time updates
        this.socketService.joinRoom(this.roomCode, res.user);
        
        // Request current participant list
        this.socketService.getParticipants(this.roomCode);
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
        this.room = res.room;
        this.user = res.user;
        this.roomCode = res.room.code;
        this.users = res.room.members;
        this.isRoomAdmin = res.user.isHost;
        this.currentUserId = res.user.id;
        this.isInRoom = true;
        
        // Update shared state
        this.roomStateService.setRoom(res.room);
        this.roomStateService.setUser(res.user);
        this.roomStateService.setInRoom(true);
        
        // Join the room via socket for real-time updates
        this.socketService.joinRoom(this.roomCode, res.user);
        
        // Request current participant list
        this.socketService.getParticipants(this.roomCode);
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
        console.log('Room code copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy room code: ', err);
      });
  }

  addVideoToQueue(): void {
    if (this.youtubeUrl.trim()) {
      console.log('Adding video to queue:', this.youtubeUrl);
      this.youtubeUrl = ''; 
    }
  }

  kickUser(userId: string): void {
    console.log('Kicking user:', userId);
    this.users = this.users.filter(user => user.id !== userId);
  }

  endRoom(): void {
    if (confirm('Are you sure you want to end the room? This action cannot be undone.')) {
      console.log('Ending room...');
    }
  }

  trackByUserId(index: number, user: User): string {
    return user.id;
  }
}
