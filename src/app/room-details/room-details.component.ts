import {Component, OnDestroy, OnInit} from '@angular/core';
import {Room, User} from '../models/room.model';
import {RoomService} from '../room.service';
import {SocketService} from '../socket.service';
import {RoomStateService} from '../room-state.service';
import {NotificationService} from '../notification.service';
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
  codeCopied: boolean = false;
  linkCopied: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private roomService: RoomService,
    private socketService: SocketService,
    private roomStateService: RoomStateService,
    private notificationService: NotificationService,
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
        this.codeCopied = true;
        setTimeout(() => {
          this.codeCopied = false;
        }, 3000);
      })
      .catch(err => {
        console.error('Failed to copy room code: ', err);
      });
  }

  copyRoomLink(): void {
    const roomLink = `${window.location.origin}/join/${this.roomCode}`;
    navigator.clipboard.writeText(roomLink)
      .then(() => {
        this.linkCopied = true;
        setTimeout(() => {
          this.linkCopied = false;
        }, 3000);
      })
      .catch(err => {
        console.error('Failed to copy room link: ', err);
      });
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

    const hostChangedSub = this.socketService.onHostChanged().subscribe((data) => {
      console.log('👑 Host changed:', data);

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

    this.notificationService.error(message, 5000);
    this.router.navigate(['/']);
  }
}
