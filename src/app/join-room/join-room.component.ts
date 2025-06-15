import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RoomService } from '../room.service';
import { RoomStateService } from '../room-state.service';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-join-room',
  templateUrl: './join-room.component.html',
  styleUrls: ['./join-room.component.css']
})
export class JoinRoomComponent implements OnInit {
  roomCode = '';
  userName = '';
  isJoining = false;
  roomDetails: any = null;
  loadingRoomDetails = true;
  roomNotFound = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private roomService: RoomService,
    private roomStateService: RoomStateService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.roomCode = params['roomCode'] || '';
      if (!this.roomCode) {
        this.router.navigate(['/']);
      } else {
        this.loadRoomDetails();
      }
    });
  }

  loadRoomDetails() {
    this.loadingRoomDetails = true;
    this.roomNotFound = false;
    
    this.roomService.getRoomDetails(this.roomCode).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.roomDetails = response.data;
          this.loadingRoomDetails = false;
        } else {
          this.roomNotFound = true;
          this.loadingRoomDetails = false;
        }
      },
      error: (error) => {
        console.error('Error loading room details:', error);
        this.roomNotFound = true;
        this.loadingRoomDetails = false;
        if (error.status === 404) {
          this.notificationService.show('Room not found. Please check the room code.', 'error');
        } else {
          this.notificationService.show('Failed to load room details.', 'error');
        }
      }
    });
  }

  onJoinRoom() {
    if (!this.userName.trim() || this.isJoining) return;

    this.isJoining = true;
    const cleanUserName = this.userName.trim();

    this.roomService.joinRoom(this.roomCode, cleanUserName).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.room) {
          this.roomStateService.setRoom(response.data.room);
          this.roomStateService.setUser(response.data.user);
          this.roomStateService.setInRoom(true);
          localStorage.setItem('listentogether_user', JSON.stringify({
            user: response.data.user,
            room: response.data.room,
            roomCode: this.roomCode,
            timestamp: Date.now()
          }));

          this.router.navigate(['/room', this.roomCode]);
        } else {
          this.isJoining = false;
          this.notificationService.show('Failed to join room. Please check the room code and try again.', 'error');
        }
      },
      error: (err) => {
        this.isJoining = false;
        if (err.status === 404) {
          this.notificationService.show('Room not found. Please check the room code.', 'error');
        } else {
          this.notificationService.show('Failed to join room. Please try again.', 'error');
        }
      }
    });
  }
  goToLanding() {
    this.router.navigate(['/']);
  }

  getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  getMemberCount(): number {
    return this.roomDetails?.members?.length || 0;
  }

  getHostName(): string {
    const host = this.roomDetails?.members?.find((member: any) => member.isHost);
    return host?.name || 'Unknown';
  }
}
