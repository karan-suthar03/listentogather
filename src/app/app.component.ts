import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs/operators';
import {RoomService} from './room.service';
import {RoomStateService} from './room-state.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'listentogether';
  showLanding = true; // Show landing page by default

  // Form data
  createUserName = '';
  joinUserName = '';
  joinRoomCode = '';

  constructor(private router: Router, private route: ActivatedRoute, private roomService: RoomService, private roomStateService: RoomStateService) {
  }

  ngOnInit() {
    // Listen to route changes to determine if we should show landing or room
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      const navigationEnd = event as NavigationEnd;
      this.showLanding = navigationEnd.url === '/';
    });

    // Check initial route
    this.showLanding = this.router.url === '/';
  }

  // Landing page methods
  onCreateRoom(userName: string) {
    if (!userName.trim()) return;

    this.roomService.createRoom(userName.trim()).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.room) {
          const roomCode = response.data.room.code;

          // Set room state
          this.roomStateService.setRoom(response.data.room);
          this.roomStateService.setUser(response.data.user);
          this.roomStateService.setInRoom(true);

          this.router.navigate(['/room', roomCode]);
        } else {
          // TODO: Show error notification
          alert('Failed to create room. Please try again.');
        }
      },
      error: (err) => {
        // TODO: Show error notification
        alert('Failed to create room. Please try again.');
      }
    });
  }

  onJoinRoom(roomCode: string, userName: string) {
    if (!roomCode.trim() || !userName.trim()) return;

    const cleanRoomCode = roomCode.trim().toUpperCase();
    const cleanUserName = userName.trim();

    this.roomService.joinRoom(cleanRoomCode, cleanUserName).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.room) {
          // Set room state
          this.roomStateService.setRoom(response.data.room);
          this.roomStateService.setUser(response.data.user);
          this.roomStateService.setInRoom(true);

          // Successfully joined the room
          this.router.navigate(['/room', cleanRoomCode]);
        } else {
          // TODO: Show error notification
          alert('Failed to join room. Please check the room code and try again.');
        }
      },
      error: (err) => {
        // TODO: Show error notification
        if (err.status === 404) {
          alert('Room not found. Please check the room code.');
        } else {
          alert('Failed to join room. Please try again.');
        }
      }
    });
  }

  // Format room code input
  formatRoomCode(event: any) {
    let value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length > 6) {
      value = value.substring(0, 6);
    }
    this.joinRoomCode = value;
    event.target.value = value;
  }

  // Generate a random 6-character room code
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
