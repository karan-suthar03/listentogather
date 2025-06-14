import { Component, OnInit, OnDestroy } from '@angular/core';
import { WorkingStateService } from '../working-state.service';
import { Subscription } from 'rxjs';

interface ChatMessage {
  id: number;
  username: string;
  message: string;
  timestamp: Date;
  isCurrentUser: boolean;
}

@Component({
  selector: 'app-main-panel',
  templateUrl: './main-panel.component.html',
  styleUrls: ['./main-panel.component.css']
})
export class MainPanelComponent implements OnInit, OnDestroy {
  isRoomWorking: boolean = false;
  roomWorkingMessage: string = '';
  private subscriptions: Subscription[] = [];

  messages: ChatMessage[] = [
    {
      id: 1,
      username: 'Alice',
      message: 'Hey everyone! Love this song!',
      timestamp: new Date(Date.now() - 300000),
      isCurrentUser: false
    },
    {
      id: 2,
      username: 'You',
      message: 'Same here! Great choice 🎵',
      timestamp: new Date(Date.now() - 180000),
      isCurrentUser: true
    },
    {
      id: 3,
      username: 'Bob',
      message: 'Can we add some rock music to the queue?',
      timestamp: new Date(Date.now() - 60000),
      isCurrentUser: false
    }
  ];

  newMessage: string = '';
  currentUser: string = 'You';

  constructor(private workingStateService: WorkingStateService) { }

  ngOnInit(): void {
    // Subscribe to working state
    this.subscriptions.push(
      this.workingStateService.workingState$.subscribe(workingState => {
        this.isRoomWorking = workingState.isWorking;
        this.roomWorkingMessage = workingState.workingMessage;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  sendMessage(): void {
    if (this.newMessage.trim()) {
      const message: ChatMessage = {
        id: this.messages.length + 1,
        username: this.currentUser,
        message: this.newMessage.trim(),
        timestamp: new Date(),
        isCurrentUser: true
      };
      
      this.messages.push(message);
      this.newMessage = '';
      
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    const chatContainer = document.querySelector('.chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  trackByMessageId(index: number, message: ChatMessage): number {
    return message.id;
  }
}