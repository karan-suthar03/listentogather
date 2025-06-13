import { Component, OnInit } from '@angular/core';

interface User {
  id: string;
  name: string;
}

@Component({
  selector: 'app-room-details',
  templateUrl: './room-details.component.html',
  styleUrls: ['./room-details.component.css']
})
export class RoomDetailsComponent implements OnInit {
  roomCode: string = 'XYZ123'; 
  youtubeUrl: string = '';
  users: User[] = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
  ]; 
  isRoomAdmin: boolean = true; 
  currentUserId: string = '1'; 

  constructor() { }

  ngOnInit(): void {
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
