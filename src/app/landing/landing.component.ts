import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {RoomService} from '../room.service';
import {RoomStateService} from '../room-state.service';
import {NotificationService} from '../notification.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent {
  roomCode = '';
  isCreatingRoom = false;
  isJoiningRoom = false;
  roomCreated = false;
  roomJoined = false;

  constructor(
    private router: Router,
    private roomService: RoomService,
    private roomStateService: RoomStateService,
    private notificationService: NotificationService
  ) {
  }

  createRoom() {
    if (this.isCreatingRoom || this.roomCreated) {
      return;
    }

    this.isCreatingRoom = true;

    const userName = 'Host';
    this.roomService.createRoom(userName).subscribe({
      next: (response) => {
        if (response.success) {
          this.roomCreated = true;

          this.roomStateService.setRoom(response.data.room);
          this.roomStateService.setUser(response.data.user);
          this.roomStateService.setInRoom(true);

          this.notificationService.show('Room created successfully! Redirecting...', 'success');

          this.router.navigate(['/room', response.data.room.code]);
        } else {
          this.isCreatingRoom = false;
          this.notificationService.show(response.message || 'Failed to create room', 'error');
        }
      },
      error: (error) => {
        this.isCreatingRoom = false;
        console.error('Error creating room:', error);
        this.notificationService.show('Failed to create room. Please try again.', 'error');
      }
    });
  }

  joinRoom() {
    if (!this.roomCode.trim() || this.isJoiningRoom || this.roomJoined) return;

    this.isJoiningRoom = true;

    const userName = 'User';
    this.roomService.joinRoom(this.roomCode, userName).subscribe({
      next: (response) => {
        if (response.success) {
          this.roomJoined = true;

          this.roomStateService.setRoom(response.data.room);
          this.roomStateService.setUser(response.data.user);
          this.roomStateService.setInRoom(true);

          this.notificationService.show('Successfully joined room! Redirecting...', 'success');

          this.router.navigate(['/room', response.data.room.code]);
        } else {
          this.isJoiningRoom = false;
          this.notificationService.show(response.message || 'Failed to join room', 'error');
        }
      },
      error: (error) => {
        this.isJoiningRoom = false;
        console.error('Error joining room:', error);

        if (error.status === 404) {
          this.notificationService.show('Room not found. Please check the room code.', 'error');
        } else if (error.status === 400) {
          this.notificationService.show('Invalid room code format.', 'error');
        } else {
          this.notificationService.show('Failed to join room. Please try again.', 'error');
        }
      }
    });
  }

  onRoomCodeInput(event: any) {
    let value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length > 6) {
      value = value.substring(0, 6);
    }
    this.roomCode = value;
    event.target.value = value;
  }
}
